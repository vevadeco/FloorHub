'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ArrowLeft, Download, Mail, CreditCard, RefreshCw, FileText, Loader2, Banknote, Trash2, Pencil, Plus, RotateCcw, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const paymentMethods = ['cash', 'check', 'bank_transfer', 'card', 'other']

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <InvoiceDetail />
    </Suspense>
  )
}

function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [invoice, setInvoice] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [converting, setConverting] = useState(false)
  const [printingPDF, setPrintingPDF] = useState(false)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paymentGateway, setPaymentGateway] = useState<string>('none')
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'cash', reference_number: '', notes: '', date: new Date().toISOString().split('T')[0] })
  // Edit form state
  const [editCustomer, setEditCustomer] = useState({ name: '', email: '', phone: '', address: '' })
  const [editItems, setEditItems] = useState<any[]>([])
  const [editTaxRate, setEditTaxRate] = useState(0)
  const [editDiscount, setEditDiscount] = useState(0)
  const [editNotes, setEditNotes] = useState('')

  const loadInvoice = () => fetch(`/api/invoices/${id}`).then(r => r.json()).then(setInvoice)
  const loadPayments = () => fetch(`/api/invoices/${id}/manual-payment`).then(r => r.json()).then(d => setPayments(Array.isArray(d) ? d : []))

  useEffect(() => {
    Promise.all([
      loadInvoice(),
      loadPayments(),
      fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : [])),
      fetch('/api/settings/payment-gateway').then(r => r.json()).then(d => setPaymentGateway(d.payment_gateway || 'none')),
    ]).finally(() => setLoading(false))
  }, [id])

  // Check if invoice is within 30-day edit window
  const canEdit = invoice && !invoice.is_estimate && (() => {
    const days = (Date.now() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24)
    return days <= 30
  })()

  // Check if return is allowed: status=complete and within 30 days of completed_at
  const canReturn = invoice && invoice.status === 'complete' && (() => {
    const ref = invoice.completed_at ? new Date(invoice.completed_at) : new Date(invoice.updated_at)
    return (Date.now() - ref.getTime()) / (1000 * 60 * 60 * 24) <= 30
  })()

  const openEditDialog = () => {
    setEditCustomer({ name: invoice.customer_name, email: invoice.customer_email || '', phone: invoice.customer_phone || '', address: invoice.customer_address || '' })
    setEditItems(invoice.items?.map((i: any) => ({ ...i, min_selling_price: 0 })) ?? [])
    setEditTaxRate(invoice.tax_rate)
    setEditDiscount(invoice.discount)
    setEditNotes(invoice.notes || '')
    setEditDialogOpen(true)
  }

  const editCalcs = useMemo(() => {
    const subtotal = editItems.reduce((s, i) => s + (i.total_price || 0), 0)
    const taxAmount = subtotal * (editTaxRate / 100)
    return { subtotal, taxAmount, total: subtotal + taxAmount - editDiscount }
  }, [editItems, editTaxRate, editDiscount])

  const updateEditItem = (idx: number, field: string, value: string) => {
    const next = [...editItems]
    const item = { ...next[idx] }
    if (field === 'product_id') {
      const p = products.find((p: any) => p.id === value)
      if (p) {
        item.product_id = value
        item.product_name = p.name
        item.sqft_per_box = p.sqft_per_box
        item.unit_price = p.selling_price
        item.min_selling_price = p.min_selling_price ?? 0
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
    } else if (field === 'unit_price') {
      item.unit_price = parseFloat(value) || 0
      const sqft = parseFloat(item.sqft_needed) || 0
      item.total_price = sqft * item.unit_price
    }
    next[idx] = item
    setEditItems(next)
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    const payload = {
      customer_name: editCustomer.name,
      customer_email: editCustomer.email,
      customer_phone: editCustomer.phone,
      customer_address: editCustomer.address,
      notes: editNotes,
      tax_rate: editTaxRate,
      tax_amount: editCalcs.taxAmount,
      discount: editDiscount,
      subtotal: editCalcs.subtotal,
      total: editCalcs.total,
      items: editItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        sqft_needed: parseFloat(i.sqft_needed),
        sqft_per_box: i.sqft_per_box,
        boxes_needed: i.boxes_needed,
        unit_price: i.unit_price,
        total_price: i.total_price,
      })),
    }
    const res = await fetch(`/api/invoices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) {
      const updated = await res.json()
      setInvoice(updated)
      toast.success('Invoice updated')
      setEditDialogOpen(false)
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  const handleDownloadPDF = async () => {
    const res = await fetch(`/api/invoices/${id}/pdf`)
    if (!res.ok) { toast.error('Failed to download PDF'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${invoice.invoice_number}.pdf`; a.click()
    URL.revokeObjectURL(url); toast.success('PDF downloaded')
  }

  const handlePrintPDF = async () => {
    setPrintingPDF(true)
    try {
      const res = await fetch(`/api/invoices/${id}/pdf`)
      if (!res.ok) { toast.error('Failed to load PDF for printing'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const tab = window.open(url, '_blank')
      if (tab) {
        tab.addEventListener('load', () => { tab.print(); URL.revokeObjectURL(url) })
      }
    } finally {
      setPrintingPDF(false)
    }
  }

  const handleSendEmail = async () => {
    setSendingEmail(true)
    const res = await fetch(`/api/invoices/${id}/send-email`, { method: 'POST' })
    if (res.ok) toast.success('Email sent')
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
    setSendingEmail(false)
  }

  const handleConvert = async () => {
    setConverting(true)
    const res = await fetch(`/api/invoices/${id}/convert-to-invoice`, { method: 'POST' })
    if (res.ok) { const d = await res.json(); toast.success('Converted to invoice'); router.push(`/invoices/${d.id}`) }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
    setConverting(false)
  }

  const handlePayOnline = async () => {
    const res = await fetch(`/api/invoices/${id}/create-checkout`, { method: 'POST' })
    if (res.ok) { const d = await res.json(); window.location.href = d.url }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch(`/api/invoices/${id}/manual-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payForm, amount: parseFloat(payForm.amount) }) })
    if (res.ok) { toast.success('Payment recorded'); setPayDialogOpen(false); setPayForm({ amount: '', payment_method: 'cash', reference_number: '', notes: '', date: new Date().toISOString().split('T')[0] }); loadInvoice(); loadPayments() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleDeletePayment = async (pid: string) => {
    if (!confirm('Delete this payment?')) return
    const res = await fetch(`/api/invoices/${id}/manual-payment`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_id: pid }) })
    if (res.ok) { toast.success('Payment deleted'); loadInvoice(); loadPayments() }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!invoice) return <div className="text-center py-12"><FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg">Invoice not found</h3><Button variant="link" onClick={() => router.push('/invoices')}>Back to invoices</Button></div>

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const balanceDue = Number(invoice.total) - totalPaid
  const statusColors: Record<string, string> = { paid: 'bg-green-100 text-green-700 border-green-200', sent: 'bg-blue-100 text-blue-700 border-blue-200', cancelled: 'bg-red-100 text-red-700 border-red-200', draft: 'bg-stone-100 text-stone-700 border-stone-200' }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/invoices')}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">{invoice.invoice_number}</h1>
              <Badge variant="outline" className={statusColors[invoice.status] ?? statusColors.draft}>{invoice.status}</Badge>
              {invoice.is_estimate && <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">Estimate</Badge>}
            </div>
            <p className="text-muted-foreground mt-1">Created {fmtDate(invoice.created_at)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" onClick={openEditDialog}><Pencil className="h-4 w-4 mr-2" />Edit</Button>
          )}
          {canReturn && (
            <Button variant="outline" onClick={() => router.push(`/returns?invoice=${invoice.invoice_number}`)}><RotateCcw className="h-4 w-4 mr-2" />Create Return</Button>
          )}
          <Button variant="outline" onClick={handleDownloadPDF}><Download className="h-4 w-4 mr-2" />PDF</Button>
          <Button variant="outline" onClick={handlePrintPDF} disabled={printingPDF}>{printingPDF ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}Print</Button>
          {invoice.customer_email && invoice.status !== 'paid' && <Button variant="outline" onClick={handleSendEmail} disabled={sendingEmail}>{sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}Email</Button>}
          {invoice.is_estimate && <Button variant="outline" onClick={handleConvert} disabled={converting}>{converting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Convert</Button>}
          {!invoice.is_estimate && invoice.status !== 'paid' && <>
            <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
              <DialogTrigger asChild><Button variant="outline"><Banknote className="h-4 w-4 mr-2" />Record Payment</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle className="font-heading">Record Manual Payment</DialogTitle></DialogHeader>
                <form onSubmit={handleRecordPayment} className="space-y-4 mt-4">
                  <div className="space-y-2"><Label>Amount *</Label><Input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} placeholder={balanceDue.toFixed(2)} required /><p className="text-xs text-muted-foreground">Balance due: {fmt(balanceDue)}</p></div>
                  <div className="space-y-2"><Label>Method</Label><Select value={payForm.payment_method} onValueChange={v => setPayForm({ ...payForm, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Reference #</Label><Input value={payForm.reference_number} onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Notes</Label><Textarea value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} rows={2} /></div>
                  <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button><Button type="submit" className="bg-accent hover:bg-accent/90">Record Payment</Button></div>
                </form>
              </DialogContent>
            </Dialog>
            {paymentGateway !== 'none' && (
              <Button className="bg-accent hover:bg-accent/90" onClick={handlePayOnline}><CreditCard className="h-4 w-4 mr-2" />Pay Online</Button>
            )}
          </>}
        </div>
      </div>

      {searchParams.get('payment') === 'success' && <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">Payment processing — please wait a moment and refresh.</div>}
      {searchParams.get('payment') === 'cancelled' && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">Payment cancelled.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Items</CardTitle></CardHeader>
            <CardContent className="p-0"><div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Product</TableHead><TableHead className="text-right">Sq Ft</TableHead><TableHead className="text-right">Boxes</TableHead><TableHead className="text-right">Price/Sq Ft</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{invoice.items?.map((item: any, i: number) => (
                <TableRow key={i}>
                  <TableCell><p className="font-medium">{item.product_name}</p><p className="text-xs text-muted-foreground">{item.sqft_per_box} sq ft/box</p></TableCell>
                  <TableCell className="text-right tabular-nums">{Number(item.sqft_needed).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.boxes_needed}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(item.unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmt(item.total_price)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div></CardContent>
          </Card>

          {!invoice.is_estimate && payments.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-heading text-lg">Payment History</CardTitle></CardHeader>
              <CardContent className="p-0"><div className="overflow-x-auto"><Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{payments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{new Date(p.date).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{p.payment_method?.replace('_', ' ')}</TableCell>
                    <TableCell className="text-muted-foreground">{p.reference_number || '-'}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-green-600">{fmt(p.amount)}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeletePayment(p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div></CardContent>
            </Card>
          )}

          {invoice.notes && <Card><CardHeader><CardTitle className="font-heading text-lg">Notes</CardTitle></CardHeader><CardContent><p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p></CardContent></Card>}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Customer</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{invoice.customer_name}</p>
              {invoice.customer_email && <p className="text-sm text-muted-foreground">{invoice.customer_email}</p>}
              {invoice.customer_phone && <p className="text-sm text-muted-foreground">{invoice.customer_phone}</p>}
              {invoice.customer_address && <p className="text-sm text-muted-foreground">{invoice.customer_address}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{fmt(invoice.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span><span className="tabular-nums">{fmt(invoice.tax_amount)}</span></div>
              {Number(invoice.discount) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="tabular-nums text-green-600">-{fmt(invoice.discount)}</span></div>}
              <div className="border-t pt-3 flex justify-between font-medium text-lg"><span>Total</span><span className="tabular-nums">{fmt(invoice.total)}</span></div>
              {!invoice.is_estimate && <>
                <div className="border-t pt-3 flex justify-between text-sm"><span className="text-muted-foreground">Amount Paid</span><span className="tabular-nums text-green-600">{fmt(totalPaid)}</span></div>
                <div className="flex justify-between font-medium"><span>Balance Due</span><span className={cn('tabular-nums', balanceDue > 0 ? 'text-amber-600' : 'text-green-600')}>{fmt(balanceDue)}</span></div>
              </>}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Invoice — {invoice.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-2">
            {/* Customer */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Customer</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={editCustomer.name} onChange={e => setEditCustomer({ ...editCustomer, name: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={editCustomer.email} onChange={e => setEditCustomer({ ...editCustomer, email: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={editCustomer.phone} onChange={e => setEditCustomer({ ...editCustomer, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={editCustomer.address} onChange={e => setEditCustomer({ ...editCustomer, address: e.target.value })} /></div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Items</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_id: '', product_name: '', sqft_needed: '', sqft_per_box: 0, boxes_needed: 0, unit_price: 0, total_price: 0, min_selling_price: 0 }])}>
                  <Plus className="h-4 w-4 mr-1" />Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {editItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/30 rounded-lg">
                    <div className="col-span-12 md:col-span-3 space-y-1">
                      <Label className="text-xs">Product</Label>
                      <Select value={item.product_id} onValueChange={v => updateEditItem(idx, 'product_id', v)}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      {item.sqft_per_box > 0 && <p className="text-xs text-muted-foreground">{item.sqft_per_box} sq ft/box</p>}
                    </div>
                    <div className="col-span-4 md:col-span-2 space-y-1">
                      <Label className="text-xs">Sq Ft</Label>
                      <Input type="number" step="0.01" value={item.sqft_needed} onChange={e => updateEditItem(idx, 'sqft_needed', e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="col-span-4 md:col-span-2 space-y-1">
                      <Label className="text-xs">Boxes</Label>
                      <Input type="number" min="0" step="1" value={item.boxes_needed || ''} onChange={e => updateEditItem(idx, 'boxes_needed', e.target.value)} placeholder="0" />
                    </div>
                    <div className="col-span-4 md:col-span-2 space-y-1">
                      <Label className="text-xs">Price/sqft</Label>
                      <Input type="number" step="0.01" value={item.unit_price || ''} onChange={e => updateEditItem(idx, 'unit_price', e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="col-span-3 md:col-span-2 space-y-1">
                      <Label className="text-xs">Total</Label>
                      <Input value={fmt(item.total_price || 0)} readOnly className="bg-muted font-medium" />
                    </div>
                    <div className="col-span-1">
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}><span className="text-lg">×</span></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals + Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label>Notes</Label><Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} /></div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label>Tax Rate (%)</Label><Input type="number" step="0.01" value={editTaxRate} onChange={e => setEditTaxRate(parseFloat(e.target.value) || 0)} className="w-24 text-right" /></div>
                <div className="flex items-center justify-between"><Label>Discount ($)</Label><Input type="number" step="0.01" value={editDiscount} onChange={e => setEditDiscount(parseFloat(e.target.value) || 0)} className="w-24 text-right" /></div>
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm"><span>Subtotal:</span><span className="tabular-nums">{fmt(editCalcs.subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span>Tax:</span><span className="tabular-nums">{fmt(editCalcs.taxAmount)}</span></div>
                  <div className="flex justify-between font-medium text-lg border-t pt-2"><span>Total:</span><span className="tabular-nums">{fmt(editCalcs.total)}</span></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={saving} className="bg-accent hover:bg-accent/90">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
