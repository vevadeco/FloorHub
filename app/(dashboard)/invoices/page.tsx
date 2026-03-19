'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, FileText, Trash2, Search, Eye, Calculator } from 'lucide-react'

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [estimates, setEstimates] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isEstimate, setIsEstimate] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [items, setItems] = useState<any[]>([])
  const [taxRate, setTaxRate] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')

  const load = async () => {
    const [inv, est, prod, cust] = await Promise.all([
      fetch('/api/invoices?is_estimate=false').then(r => r.json()),
      fetch('/api/invoices?is_estimate=true').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
    ])
    setInvoices(Array.isArray(inv) ? inv : [])
    setEstimates(Array.isArray(est) ? est : [])
    setProducts(Array.isArray(prod) ? prod : [])
    setCustomers(Array.isArray(cust) ? cust : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const calcs = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + (i.total_price || 0), 0)
    const taxAmount = subtotal * (taxRate / 100)
    return { subtotal, taxAmount, total: subtotal + taxAmount - discount }
  }, [items, taxRate, discount])

  const addItem = () => setItems([...items, { product_id: '', product_name: '', sqft_needed: '', sqft_per_box: 0, boxes_needed: 0, unit_price: 0, total_price: 0 }])

  const updateItem = (idx: number, field: string, value: string) => {
    const next = [...items]
    const item = { ...next[idx] }
    if (field === 'product_id') {
      const p = products.find((p: any) => p.id === value)
      if (p) {
        item.product_id = value
        item.product_name = p.name
        item.sqft_per_box = p.sqft_per_box
        item.unit_price = p.selling_price  // price per sq ft
        if (item.sqft_needed) {
          const sqft = parseFloat(item.sqft_needed)
          item.boxes_needed = Math.ceil(sqft / p.sqft_per_box)
          item.total_price = sqft * p.selling_price
        }
      }
    } else if (field === 'sqft_needed') {
      const sqft = parseFloat(value) || 0
      item.sqft_needed = value
      if (item.sqft_per_box > 0 && sqft) {
        item.boxes_needed = Math.ceil(sqft / item.sqft_per_box)
        item.total_price = sqft * item.unit_price
      }
    } else if (field === 'boxes_needed') {
      const boxes = parseInt(value) || 0
      item.boxes_needed = boxes
      if (item.sqft_per_box > 0) {
        item.sqft_needed = boxes * item.sqft_per_box
        item.total_price = item.sqft_needed * item.unit_price
      }
    }
    next[idx] = item; setItems(next)
  }

  const handleCustomerSelect = (id: string) => {
    setSelectedCustomer(id)
    if (id && id !== 'new') { const c = customers.find((c: any) => c.id === id); if (c) setCustomerForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '' }) }
    else setCustomerForm({ name: '', email: '', phone: '', address: '' })
  }

  const resetForm = () => { setSelectedCustomer(''); setCustomerForm({ name: '', email: '', phone: '', address: '' }); setItems([]); setTaxRate(0); setDiscount(0); setNotes('') }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) { toast.error('Add at least one item'); return }
    const payload = { customer_id: selectedCustomer || crypto.randomUUID(), customer_name: customerForm.name, customer_email: customerForm.email, customer_phone: customerForm.phone, customer_address: customerForm.address, items: items.map(i => ({ product_id: i.product_id, product_name: i.product_name, sqft_needed: parseFloat(i.sqft_needed), sqft_per_box: i.sqft_per_box, boxes_needed: i.boxes_needed, unit_price: i.unit_price, total_price: i.total_price })), subtotal: calcs.subtotal, tax_rate: taxRate, tax_amount: calcs.taxAmount, discount, total: calcs.total, notes, status: 'draft', is_estimate: isEstimate }
    const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) { toast.success(`${isEstimate ? 'Estimate' : 'Invoice'} created`); setDialogOpen(false); resetForm(); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) { toast.success('Status updated'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this?')) return
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const statusColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    sent: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
    draft: 'bg-stone-100 text-stone-700',
  }
  const invoiceStatuses = ['draft', 'sent', 'paid', 'cancelled']

  const renderTable = (data: any[]) => (
    <div className="overflow-x-auto"><Table>
      <TableHeader><TableRow className="bg-muted/50"><TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead>Created By</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{data.map(item => (
        <TableRow key={item.id}>
          <TableCell className="font-medium font-mono text-sm">{item.invoice_number}</TableCell>
          <TableCell>{item.customer_name}</TableCell>
          <TableCell className="text-muted-foreground text-sm">{item.created_by_name || '—'}</TableCell>
          <TableCell className="text-muted-foreground">{fmtDate(item.created_at)}</TableCell>
          <TableCell className="text-right tabular-nums font-medium">{fmt(item.total)}</TableCell>
          <TableCell>
            <Select value={item.status} onValueChange={v => handleStatusChange(item.id, v)}>
              <SelectTrigger className={`h-7 text-xs w-28 border-0 px-2 ${statusColors[item.status] ?? statusColors.draft}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {invoiceStatuses.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="text-right"><div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" asChild><Link href={`/invoices/${item.id}`}><Eye className="h-4 w-4" /></Link></Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
          </div></TableCell>
        </TableRow>
      ))}</TableBody>
    </Table></div>
  )

  const filteredInv = invoices.filter(i => i.invoice_number.toLowerCase().includes(search.toLowerCase()) || i.customer_name.toLowerCase().includes(search.toLowerCase()))
  const filteredEst = estimates.filter(i => i.invoice_number.toLowerCase().includes(search.toLowerCase()) || i.customer_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Invoices & Estimates</h1><p className="text-muted-foreground mt-1">Create and manage invoices and estimates</p></div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm() }}>
            <DialogTrigger asChild><Button variant="outline" onClick={() => setIsEstimate(true)}><Calculator className="h-4 w-4 mr-2" />New Estimate</Button></DialogTrigger>
            <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" onClick={() => setIsEstimate(false)}><Plus className="h-4 w-4 mr-2" />New Invoice</Button></DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading">Create {isEstimate ? 'Estimate' : 'Invoice'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                <div className="space-y-4">
                  <h3 className="font-medium">Customer</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Existing Customer</Label>
                      <Select value={selectedCustomer || 'new'} onValueChange={v => handleCustomerSelect(v === 'new' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="Select or new" /></SelectTrigger>
                        <SelectContent><SelectItem value="new">New Customer</SelectItem>{customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Name *</Label><Input value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Email</Label><Input type="email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Phone</Label><Input value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} /></div>
                    <div className="md:col-span-2 space-y-2"><Label>Address</Label><Input value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} /></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between"><h3 className="font-medium">Items</h3><Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Add Item</Button></div>
                  {items.length === 0 ? <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed"><p className="text-muted-foreground mb-2">No items</p><Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Add Item</Button></div>
                    : <div className="space-y-3">{items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/30 rounded-lg">
                        <div className="col-span-12 md:col-span-3 space-y-1"><Label className="text-xs">Product</Label>
                          <Select value={item.product_id} onValueChange={v => updateItem(idx, 'product_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                            <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                          {item.sqft_per_box > 0 && <p className="text-xs text-muted-foreground">{item.sqft_per_box} sq ft/box</p>}
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <Label className="text-xs">Sq Ft Needed</Label>
                          <Input type="number" step="0.01" value={item.sqft_needed} onChange={e => updateItem(idx, 'sqft_needed', e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <Label className="text-xs">Boxes (↑ rounded up)</Label>
                          <Input type="number" min="0" step="1" value={item.boxes_needed || ''} onChange={e => updateItem(idx, 'boxes_needed', e.target.value)} placeholder="0" />
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <Label className="text-xs">Sq Ft (rounded)</Label>
                          <Input value={item.sqft_per_box > 0 ? Number(item.sqft_needed).toFixed(2) : '—'} readOnly className="bg-muted text-xs" />
                        </div>
                        <div className="col-span-3 md:col-span-2 space-y-1"><Label className="text-xs">Total</Label><Input value={fmt(item.total_price || 0)} readOnly className="bg-muted font-medium" /></div>
                        <div className="col-span-1"><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setItems(items.filter((_, i) => i !== idx))}><span className="text-lg">×</span></Button></div>
                      </div>
                    ))}</div>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} /></div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label>Tax Rate (%)</Label><Input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="w-24 text-right" /></div>
                    <div className="flex items-center justify-between"><Label>Discount ($)</Label><Input type="number" step="0.01" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="w-24 text-right" /></div>
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between text-sm"><span>Subtotal:</span><span className="tabular-nums">{fmt(calcs.subtotal)}</span></div>
                      <div className="flex justify-between text-sm"><span>Tax:</span><span className="tabular-nums">{fmt(calcs.taxAmount)}</span></div>
                      <div className="flex justify-between font-medium text-lg border-t pt-2"><span>Total:</span><span className="tabular-nums">{fmt(calcs.total)}</span></div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="bg-accent hover:bg-accent/90">Create {isEstimate ? 'Estimate' : 'Invoice'}</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div></CardContent></Card>
      <Tabs defaultValue="invoices">
        <TabsList><TabsTrigger value="invoices">Invoices ({filteredInv.length})</TabsTrigger><TabsTrigger value="estimates">Estimates ({filteredEst.length})</TabsTrigger></TabsList>
        <TabsContent value="invoices"><Card><CardContent className="p-0">{loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : filteredInv.length === 0 ? <div className="p-12 text-center"><FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No invoices found</h3></div> : renderTable(filteredInv)}</CardContent></Card></TabsContent>
        <TabsContent value="estimates"><Card><CardContent className="p-0">{loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : filteredEst.length === 0 ? <div className="p-12 text-center"><Calculator className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No estimates found</h3></div> : renderTable(filteredEst)}</CardContent></Card></TabsContent>
      </Tabs>
    </div>
  )
}
