'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { RotateCcw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
}

interface ReturnItem {
  product_name: string
  sqft_needed: number
  unit_price: number
  return_sqft: number
  return_total: number
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <ReturnsContent />
    </Suspense>
  )
}

function ReturnsContent() {
  const searchParams = useSearchParams()
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('employee')
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [foundInvoice, setFoundInvoice] = useState<any>(null)
  const [searching, setSearching] = useState(false)
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])
  const [form, setForm] = useState({ reason: '', notes: '', transaction_reference: '' })
  const [submitting, setSubmitting] = useState(false)
  const [restockingPercentage, setRestockingPercentage] = useState(20)
  const [waiveRestocking, setWaiveRestocking] = useState(false)
  const [refundMethod, setRefundMethod] = useState<'original_payment' | 'store_credit'>('original_payment')
  const [storeCreditConfirmation, setStoreCreditConfirmation] = useState<{ amount: number } | null>(null)

  const load = async () => {
    const [r, me, settings] = await Promise.all([
      fetch('/api/returns').then(res => res.json()),
      fetch('/api/auth/me').then(res => res.json()),
      fetch('/api/settings').then(res => res.json()),
    ])
    setReturns(Array.isArray(r) ? r : [])
    setUserRole(me?.role ?? 'employee')
    if (settings?.restocking_charge_percentage != null) {
      setRestockingPercentage(Number(settings.restocking_charge_percentage))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const inv = searchParams.get('invoice')
    if (inv) {
      setInvoiceSearch(inv)
      setNewDialogOpen(true)
    }
  }, [])

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) return
    setSearching(true)
    try {
      const res = await fetch('/api/invoices?is_estimate=false')
      const data = await res.json()
      const match = data.find((i: any) =>
        i.invoice_number.toLowerCase() === invoiceSearch.toLowerCase() ||
        i.id === invoiceSearch
      )
      if (!match) { toast.error('Invoice not found'); setFoundInvoice(null); setSearching(false); return }

      // Fetch full invoice with items
      const full = await fetch(`/api/invoices/${match.id}`).then(r => r.json())
      setFoundInvoice(full)
      // Pre-populate return items from invoice line items
      setReturnItems((full.items ?? []).map((item: any) => ({
        product_name: item.product_name,
        sqft_needed: item.sqft_needed,
        unit_price: item.unit_price,
        return_sqft: item.sqft_needed, // default to full qty
        return_total: item.total_price,
      })))
    } catch { toast.error('Search failed') }
    setSearching(false)
  }

  useEffect(() => {
    if (newDialogOpen && invoiceSearch && !foundInvoice) {
      searchInvoice()
    }
  }, [newDialogOpen])

  const updateReturnSqft = (idx: number, sqft: number) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const clamped = Math.max(0, Math.min(sqft, item.sqft_needed))
      return { ...item, return_sqft: clamped, return_total: Math.round(clamped * item.unit_price * 100) / 100 }
    }))
  }

  const totals = useMemo(() => {
    const refund = returnItems.reduce((s, i) => s + i.return_total, 0)
    const restocking = waiveRestocking ? 0 : Math.round(refund * (restockingPercentage / 100) * 100) / 100
    const net = Math.round((refund - restocking) * 100) / 100
    return { refund, restocking, net }
  }, [returnItems, restockingPercentage, waiveRestocking])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!foundInvoice) return
    if (!form.reason.trim()) { toast.error('Reason is required'); return }
    setSubmitting(true)
    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: foundInvoice.id,
        reason: form.reason,
        notes: form.notes,
        transaction_reference: form.transaction_reference,
        items: returnItems,
        waive_restocking: waiveRestocking,
        refund_method: refundMethod,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (refundMethod === 'store_credit') {
        const netAmount = Number(data.net_refund ?? totals.net)
        setStoreCreditConfirmation({ amount: netAmount })
      }
      toast.success('Return created')
      setNewDialogOpen(false)
      resetDialog()
      load()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setSubmitting(false)
  }

  const resetDialog = () => {
    setFoundInvoice(null)
    setInvoiceSearch('')
    setReturnItems([])
    setForm({ reason: '', notes: '', transaction_reference: '' })
    setWaiveRestocking(false)
    setRefundMethod('original_payment')
  }

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/returns/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (res.ok) { toast.success('Status updated'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this return?')) return
    const res = await fetch(`/api/returns/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); load() }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Returns</h1>
          <p className="text-muted-foreground mt-1">Manage product returns — allowed within 30 days of invoice completion</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90" onClick={() => setNewDialogOpen(true)}>
          <RotateCcw className="h-4 w-4 mr-2" />New Return
        </Button>
      </div>

      <Card><CardContent className="p-0">
        {loading
          ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : returns.length === 0
            ? <div className="p-12 text-center"><RotateCcw className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No returns yet</h3></div>
            : <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead className="text-right">Restocking</TableHead>
                <TableHead className="text-right">Net Refund</TableHead>
                <TableHead>Ref #</TableHead>
                <TableHead>Status</TableHead>
                {userRole === 'owner' && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>{returns.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.invoice_number}</TableCell>
                  <TableCell>{r.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[160px] truncate">{r.reason}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(Number(r.refund_amount))}</TableCell>
                  <TableCell className="text-right tabular-nums text-orange-600">-{fmt(Number(r.restocking_fee))}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-green-600">{fmt(Number(r.net_refund))}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.transaction_reference || '—'}</TableCell>
                  <TableCell>
                    {userRole === 'owner'
                      ? <Select value={r.status} onValueChange={(v: string) => updateStatus(r.id, v)}>
                          <SelectTrigger className={cn('h-7 text-xs w-28 border-0 px-2', statusColors[r.status] ?? statusColors.pending)}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['pending', 'approved', 'rejected', 'completed'].map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      : <Badge className={cn('text-xs', statusColors[r.status] ?? statusColors.pending)}>{r.status}</Badge>}
                  </TableCell>
                  {userRole === 'owner' && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}</TableBody>
            </Table></div>}
      </CardContent></Card>

      {/* New Return Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={open => { setNewDialogOpen(open); if (!open) resetDialog() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Create Return</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Invoice search */}
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <div className="flex gap-2">
                <Input value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} placeholder="e.g. INV-202601-1234" onKeyDown={e => e.key === 'Enter' && searchInvoice()} />
                <Button type="button" variant="outline" onClick={searchInvoice} disabled={searching}>
                  {searching ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>

            {foundInvoice && (
              <>
                {/* Invoice summary */}
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                  <p className="font-medium">{foundInvoice.customer_name}</p>
                  <p className="text-muted-foreground">Invoice total: {fmt(foundInvoice.total)} · Status: {foundInvoice.status}</p>
                </div>

                {/* Line items with adjustable return qty */}
                <div className="space-y-2">
                  <Label>Items to Return</Label>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Orig Sq Ft</TableHead>
                          <TableHead className="text-right">Price/sqft</TableHead>
                          <TableHead className="text-right w-32">Return Sq Ft</TableHead>
                          <TableHead className="text-right">Return Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm">{item.sqft_needed.toFixed(2)}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm">{fmt(item.unit_price)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={item.sqft_needed}
                                value={item.return_sqft}
                                onChange={e => updateReturnSqft(idx, parseFloat(e.target.value) || 0)}
                                className="w-28 text-right h-8 text-sm ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm font-medium">{fmt(item.return_total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Totals summary */}
                <div className="p-3 bg-muted/30 rounded-lg space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Return subtotal</span>
                    <span className="tabular-nums">{fmt(totals.refund)}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>Restocking fee ({waiveRestocking ? 'waived' : `${restockingPercentage}%`})</span>
                    <span className="tabular-nums">-{fmt(totals.restocking)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1.5">
                    <span>Net refund to customer</span>
                    <span className="tabular-nums text-green-600">{fmt(totals.net)}</span>
                  </div>
                </div>

                {/* Waive Restocking Fee */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="waive-restocking"
                    checked={waiveRestocking}
                    onCheckedChange={(checked) => setWaiveRestocking(checked === true)}
                  />
                  <Label htmlFor="waive-restocking" className="text-sm font-normal cursor-pointer">
                    Waive Restocking Fee
                  </Label>
                </div>

                {/* Refund Method */}
                <div className="space-y-2">
                  <Label>Refund Method</Label>
                  <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as 'original_payment' | 'store_credit')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original_payment">Original Payment</SelectItem>
                      <SelectItem value="store_credit">Store Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Reason *</Label>
                    <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Transaction Reference #</Label>
                    <Input value={form.transaction_reference} onChange={e => setForm({ ...form, transaction_reference: e.target.value })} placeholder="e.g. REF-12345" />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting || totals.net <= 0} className="bg-accent hover:bg-accent/90">
                      {submitting ? 'Submitting...' : `Submit Return — ${fmt(totals.net)} net refund`}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Store Credit Confirmation Dialog */}
      <Dialog open={storeCreditConfirmation !== null} onOpenChange={(open) => { if (!open) setStoreCreditConfirmation(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">Store Credit Issued</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              A store credit of <span className="font-semibold text-green-600">{fmt(storeCreditConfirmation?.amount ?? 0)}</span> has been issued to the customer&apos;s account.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setStoreCreditConfirmation(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
