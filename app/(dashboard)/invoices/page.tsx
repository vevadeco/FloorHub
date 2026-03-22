'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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

// Address autocomplete using Google Maps Places API
function AddressAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuggestions = useCallback((input: string) => {
    if (!input || input.length < 3) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address/suggestions?query=${encodeURIComponent(input)}`)
        const data = await res.json()
        setSuggestions(Array.isArray(data) ? data.map((d: any) => d.full_address ?? d.description ?? d) : [])
        setOpen(true)
      } catch { setSuggestions([]) }
    }, 300)
  }, [])

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); fetchSuggestions(e.target.value) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Start typing address..."
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-popover border rounded-md shadow-md mt-1 max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li key={i} className="px-3 py-2 text-sm cursor-pointer hover:bg-muted" onMouseDown={() => { onChange(s); setOpen(false) }}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Product search combobox — search by name or SKU
function ProductSearch({ products, value, onSelect }: { products: any[]; value: string; onSelect: (p: any) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = products.find(p => p.id === value)

  const filtered = query.length > 0
    ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase()))
    : products.slice(0, 20)

  return (
    <div className="relative">
      <Input
        value={open ? query : (selected ? `${selected.name} (${selected.sku})` : '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search by name or SKU..."
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 w-full bg-popover border rounded-md shadow-md mt-1 max-h-48 overflow-y-auto">
          {filtered.length === 0
            ? <li className="px-3 py-2 text-sm text-muted-foreground">No products found</li>
            : filtered.map((p: any) => (
              <li key={p.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-muted" onMouseDown={() => { onSelect(p); setOpen(false); setQuery('') }}>
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground ml-2 text-xs">{p.sku}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [estimates, setEstimates] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isEstimate, setIsEstimate] = useState(false)
  const [userRole, setUserRole] = useState<string>('employee')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [items, setItems] = useState<any[]>([])
  const [taxRate, setTaxRate] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [isInstallJob, setIsInstallJob] = useState(false)
  const [defaultTaxRate, setDefaultTaxRate] = useState(0)
  const [minFloorPrice, setMinFloorPrice] = useState(0)

  const load = async () => {
    const [inv, est, prod, cust, me, settingsRes] = await Promise.all([
      fetch('/api/invoices?is_estimate=false').then(r => r.json()),
      fetch('/api/invoices?is_estimate=true').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ])
    setInvoices(Array.isArray(inv) ? inv : [])
    setEstimates(Array.isArray(est) ? est : [])
    setProducts(Array.isArray(prod) ? prod : [])
    setCustomers(Array.isArray(cust) ? cust : [])
    setUserRole(me?.role ?? 'employee')
    const tr = parseFloat(settingsRes?.tax_rate ?? 0)
    const mfp = parseFloat(settingsRes?.min_floor_price ?? 0)
    setDefaultTaxRate(tr)
    setMinFloorPrice(mfp)
    setTaxRate(tr)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const calcs = useMemo(() => {
    const subtotal = items.reduce((s: number, i: any) => s + (i.total_price || 0), 0)
    const taxAmount = subtotal * (taxRate / 100)
    return { subtotal, taxAmount, total: subtotal + taxAmount - discount }
  }, [items, taxRate, discount])

  const addItem = () => setItems([...items, { product_id: '', product_name: '', sqft_needed: '', sqft_per_box: 0, boxes_needed: 0, unit_price: 0, total_price: 0, min_selling_price: 0 }])

  const selectProduct = (idx: number, p: any) => {
    const next = [...items]
    const effectiveMin = (p.min_selling_price ?? 0) > 0 ? p.min_selling_price : minFloorPrice
    const item = { ...next[idx], product_id: p.id, product_name: p.name, sqft_per_box: p.sqft_per_box, unit_price: p.selling_price, min_selling_price: effectiveMin }
    if (item.sqft_needed) {
      const sqft = parseFloat(item.sqft_needed)
      item.boxes_needed = Math.ceil(sqft / p.sqft_per_box)
      item.total_price = sqft * p.selling_price
    }
    next[idx] = item; setItems(next)
  }

  const updateItem = (idx: number, field: string, value: string) => {
    const next = [...items]
    const item = { ...next[idx] }
    if (field === 'sqft_needed') {
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
    } else if (field === 'unit_price') {
      const price = parseFloat(value) || 0
      const minPrice = item.min_selling_price ?? 0
      if (userRole !== 'owner' && minPrice > 0 && price < minPrice) {
        item.unit_price = minPrice
      } else {
        item.unit_price = price
      }
      const sqft = parseFloat(item.sqft_needed) || 0
      item.total_price = sqft * item.unit_price
    }
    next[idx] = item; setItems(next)
  }

  const handleCustomerSelect = (id: string) => {
    setSelectedCustomer(id)
    if (id && id !== 'new') { const c = customers.find((c: any) => c.id === id); if (c) setCustomerForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '' }) }
    else setCustomerForm({ name: '', email: '', phone: '', address: '' })
  }

  const resetForm = () => { setSelectedCustomer(''); setCustomerForm({ name: '', email: '', phone: '', address: '' }); setItems([]); setTaxRate(defaultTaxRate); setDiscount(0); setNotes(''); setIsInstallJob(false) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) { toast.error('Add at least one item'); return }
    const payload = {
      customer_id: selectedCustomer || crypto.randomUUID(),
      customer_name: customerForm.name, customer_email: customerForm.email,
      customer_phone: customerForm.phone, customer_address: customerForm.address,
      items: items.map((i: any) => ({ product_id: i.product_id, product_name: i.product_name, sqft_needed: parseFloat(i.sqft_needed), sqft_per_box: i.sqft_per_box, boxes_needed: i.boxes_needed, unit_price: i.unit_price, total_price: i.total_price })),
      subtotal: calcs.subtotal, tax_rate: taxRate, tax_amount: calcs.taxAmount, discount, total: calcs.total,
      notes, status: 'draft', is_estimate: isEstimate, is_install_job: isInstallJob && !isEstimate,
    }
    const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) { toast.success(`${isEstimate ? 'Estimate' : 'Invoice'} created`); setDialogOpen(false); resetForm(); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/invoices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
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
    complete: 'bg-purple-100 text-purple-700',
  }
  const invoiceStatuses = ['draft', 'sent', 'paid', 'complete', 'cancelled']

  const renderTable = (data: any[]) => (
    <div className="overflow-x-auto"><Table>
      <TableHeader><TableRow className="bg-muted/50"><TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead>Created By</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{data.map((item: any) => (
        <TableRow key={item.id}>
          <TableCell className="font-medium font-mono text-sm">{item.invoice_number}</TableCell>
          <TableCell>{item.customer_name}</TableCell>
          <TableCell className="text-muted-foreground text-sm">{item.created_by_name || '—'}</TableCell>
          <TableCell className="text-muted-foreground">{fmtDate(item.created_at)}</TableCell>
          <TableCell className="text-right tabular-nums font-medium">{fmt(item.total)}</TableCell>
          <TableCell>
            <Select value={item.status} onValueChange={(v: string) => handleStatusChange(item.id, v)}>
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

  const filteredInv = invoices.filter((i: any) => i.invoice_number.toLowerCase().includes(search.toLowerCase()) || i.customer_name.toLowerCase().includes(search.toLowerCase()))
  const filteredEst = estimates.filter((i: any) => i.invoice_number.toLowerCase().includes(search.toLowerCase()) || i.customer_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Invoices & Estimates</h1><p className="text-muted-foreground mt-1">Create and manage invoices and estimates</p></div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={(open: boolean) => { setDialogOpen(open); if (!open) resetForm() }}>
            <DialogTrigger asChild><Button variant="outline" onClick={() => setIsEstimate(true)}><Calculator className="h-4 w-4 mr-2" />New Estimate</Button></DialogTrigger>
            <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" onClick={() => setIsEstimate(false)}><Plus className="h-4 w-4 mr-2" />New Invoice</Button></DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading">Create {isEstimate ? 'Estimate' : 'Invoice'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                {/* Customer */}
                <div className="space-y-4">
                  <h3 className="font-medium">Customer</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Existing Customer</Label>
                      <Select value={selectedCustomer || 'new'} onValueChange={(v: string) => handleCustomerSelect(v === 'new' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="Select or new" /></SelectTrigger>
                        <SelectContent><SelectItem value="new">New Customer</SelectItem>{customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Name *</Label><Input value={customerForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerForm({ ...customerForm, name: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Email</Label><Input type="email" value={customerForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerForm({ ...customerForm, email: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Phone</Label><Input value={customerForm.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerForm({ ...customerForm, phone: e.target.value })} /></div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Address</Label>
                      <AddressAutocomplete value={customerForm.address} onChange={(v: string) => setCustomerForm({ ...customerForm, address: v })} />
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between"><h3 className="font-medium">Items</h3><Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Add Item</Button></div>
                  {items.length === 0
                    ? <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed"><p className="text-muted-foreground mb-2">No items</p><Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Add Item</Button></div>
                    : <div className="space-y-3">{items.map((item: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/30 rounded-lg">
                        <div className="col-span-12 md:col-span-3 space-y-1">
                          <Label className="text-xs">Product</Label>
                          <ProductSearch products={products} value={item.product_id} onSelect={(p: any) => selectProduct(idx, p)} />
                          {item.sqft_per_box > 0 && <p className="text-xs text-muted-foreground">{item.sqft_per_box} sq ft/box</p>}
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <Label className="text-xs">Sq Ft Needed</Label>
                          <Input type="number" step="0.01" value={item.sqft_needed} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'sqft_needed', e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <Label className="text-xs">Boxes (↑ rounded up)</Label>
                          <Input type="number" min="0" step="1" value={item.boxes_needed || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'boxes_needed', e.target.value)} placeholder="0" />
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <Label className="text-xs">
                            Price/sqft
                            {item.min_selling_price > 0 && <span className="text-muted-foreground ml-1">(min ${Number(item.min_selling_price).toFixed(2)})</span>}
                          </Label>
                          <Input
                            type="number" step="0.01"
                            value={item.unit_price || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, 'unit_price', e.target.value)}
                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                              const price = parseFloat(e.target.value) || 0
                              const min = item.min_selling_price ?? 0
                              if (userRole !== 'owner' && min > 0 && price < min) {
                                toast.error(`Minimum price is $${min.toFixed(2)}/sqft`)
                                updateItem(idx, 'unit_price', String(min))
                              }
                            }}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-3 md:col-span-2 space-y-1"><Label className="text-xs">Total</Label><Input value={fmt(item.total_price || 0)} readOnly className="bg-muted font-medium" /></div>
                        <div className="col-span-1"><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setItems(items.filter((_: any, i: number) => i !== idx))}><span className="text-lg">×</span></Button></div>
                      </div>
                    ))}</div>}
                </div>

                {/* Totals + Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} rows={4} /></div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label>Tax Rate (%)</Label><Input type="number" step="0.01" value={taxRate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaxRate(parseFloat(e.target.value) || 0)} className="w-24 text-right" /></div>
                    <div className="flex items-center justify-between"><Label>Discount ($)</Label><Input type="number" step="0.01" value={discount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiscount(parseFloat(e.target.value) || 0)} className="w-24 text-right" /></div>
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between text-sm"><span>Subtotal:</span><span className="tabular-nums">{fmt(calcs.subtotal)}</span></div>
                      <div className="flex justify-between text-sm"><span>Tax:</span><span className="tabular-nums">{fmt(calcs.taxAmount)}</span></div>
                      <div className="flex justify-between font-medium text-lg border-t pt-2"><span>Total:</span><span className="tabular-nums">{fmt(calcs.total)}</span></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  {!isEstimate && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={isInstallJob} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsInstallJob(e.target.checked)} className="h-4 w-4 rounded border-input accent-accent" />
                      <span className="text-sm font-medium">Mark as Installation Job</span>
                    </label>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" className="bg-accent hover:bg-accent/90">Create {isEstimate ? 'Estimate' : 'Invoice'}</Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by customer name or invoice number..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} className="pl-10" /></div></CardContent></Card>

      <Tabs defaultValue="invoices">
        <TabsList><TabsTrigger value="invoices">Invoices ({filteredInv.length})</TabsTrigger><TabsTrigger value="estimates">Estimates ({filteredEst.length})</TabsTrigger></TabsList>
        <TabsContent value="invoices"><Card><CardContent className="p-0">{loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : filteredInv.length === 0 ? <div className="p-12 text-center"><FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No invoices found</h3></div> : renderTable(filteredInv)}</CardContent></Card></TabsContent>
        <TabsContent value="estimates"><Card><CardContent className="p-0">{loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : filteredEst.length === 0 ? <div className="p-12 text-center"><Calculator className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No estimates found</h3></div> : renderTable(filteredEst)}</CardContent></Card></TabsContent>
      </Tabs>
    </div>
  )
}
