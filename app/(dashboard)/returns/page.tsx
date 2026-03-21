'use client'

import { useState, useEffect, Suspense } from 'react'
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
  const [form, setForm] = useState({ reason: '', notes: '', refund_amount: '' })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    const [r, me] = await Promise.all([
      fetch('/api/returns').then(res => res.json()),
      fetch('/api/auth/me').then(res => res.json()),
    ])
    setReturns(Array.isArray(r) ? r : [])
    setUserRole(me?.role ?? 'employee')
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Pre-fill from query param (e.g. coming from invoice detail page)
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
      const inv = data.find((i: any) =>
        i.invoice_number.toLowerCase() === invoiceSearch.toLowerCase() ||
        i.id === invoiceSearch
      )
      if (inv) {
        setFoundInvoice(inv)
        setForm(f => ({ ...f, refund_amount: String(inv.total) }))
      } else {
        toast.error('Invoice not found')
        setFoundInvoice(null)
      }
    } catch { toast.error('Search failed') }
    setSearching(false)
  }

  // Auto-search when dialog opens with pre-filled invoice number
  useEffect(() => {
    if (newDialogOpen && invoiceSearch && !foundInvoice) {
      searchInvoice()
    }
  }, [newDialogOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!foundInvoice) return
    setSubmitting(true)
    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: foundInvoice.id, reason: form.reason, notes: form.notes, refund_amount: parseFloat(form.refund_amount) || 0 }),
    })
    if (res.ok) {
      toast.success('Return created')
      setNewDialogOpen(false)
      setFoundInvoice(null)
      setInvoiceSearch('')
      setForm({ reason: '', notes: '', refund_amount: '' })
      load()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setSubmitting(false)
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
                <TableHead>Status</TableHead>
                {userRole === 'owner' && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>{returns.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.invoice_number}</TableCell>
                  <TableCell>{r.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{r.reason}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmt(Number(r.refund_amount))}</TableCell>
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
      <Dialog open={newDialogOpen} onOpenChange={open => { setNewDialogOpen(open); if (!open) { setFoundInvoice(null); setInvoiceSearch(''); setForm({ reason: '', notes: '', refund_amount: '' }) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Create Return</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <div className="flex gap-2">
                <Input value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} placeholder="e.g. INV-202601-1234" onKeyDown={e => e.key === 'Enter' && searchInvoice()} />
                <Button type="button" variant="outline" onClick={searchInvoice} disabled={searching}>Search</Button>
              </div>
            </div>
            {foundInvoice && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p className="font-medium">{foundInvoice.customer_name}</p>
                <p className="text-muted-foreground">Total: {fmt(foundInvoice.total)} · Status: {foundInvoice.status}</p>
              </div>
            )}
            {foundInvoice && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Reason *</Label><Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Refund Amount</Label><Input type="number" step="0.01" value={form.refund_amount} onChange={e => setForm({ ...form, refund_amount: e.target.value })} /></div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting} className="bg-accent hover:bg-accent/90">Submit Return</Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
