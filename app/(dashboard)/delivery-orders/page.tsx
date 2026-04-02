'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Truck, Mail, Calendar, User, Download } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { DeliveryOrderListItem } from '@/types'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default function DeliveryOrdersPage() {
  const [orders, setOrders] = useState<DeliveryOrderListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DeliveryOrderListItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [form, setForm] = useState<{
    delivery_date: string
    notes: string
    status: string
    recipient_email: string
  }>({
    delivery_date: '',
    notes: '',
    status: 'pending',
    recipient_email: '',
  })

  const load = () => {
    fetch('/api/delivery-orders')
      .then(r => r.json())
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return orders.filter((o: DeliveryOrderListItem) => {
      const matchSearch = !q ||
        o.customer_name.toLowerCase().includes(q) ||
        (o.job?.delivery_order_id ?? '').toLowerCase().includes(q) ||
        o.invoice_number.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || (o.job?.status ?? 'pending') === statusFilter
      return matchSearch && matchStatus
    })
  }, [orders, search, statusFilter])

  const openDialog = (order: DeliveryOrderListItem) => {
    setSelected(order)
    setForm({
      delivery_date: order.job?.delivery_date ?? '',
      notes: order.job?.notes ?? '',
      status: order.job?.status ?? 'pending',
      recipient_email: '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/delivery-orders/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_date: form.delivery_date,
          notes: form.notes,
          status: form.status,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      const updated = await res.json()
      setOrders(prev => prev.map((o: DeliveryOrderListItem) =>
        o.id === selected.id
          ? { ...o, job: { ...updated, customer_address: o.customer_address } }
          : o
      ))
      toast.success('Delivery order updated')
      setDialogOpen(false)
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!selected) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/delivery-orders/${selected.id}/pdf`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selected.job?.delivery_order_id ?? 'delivery-order'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!selected) return
    if (!form.recipient_email.trim()) {
      toast.error('Please enter a recipient email address')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/delivery-orders/${selected.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_email: form.recipient_email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      toast.success('Delivery order sent successfully')
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Delivery Orders</h1>
          <p className="text-muted-foreground mt-1">Invoices marked as delivery orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by customer name or DO number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {orders.length === 0
              ? 'No delivery orders found. Set an invoice\'s job type to "delivery" to see it here.'
              : 'No delivery orders match your search or filter.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((order: DeliveryOrderListItem) => {
            const jobStatus = order.job?.status ?? 'pending'
            return (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.job?.delivery_order_id && (
                          <span className="font-semibold text-sm bg-muted px-2 py-0.5 rounded">
                            {order.job.delivery_order_id}
                          </span>
                        )}
                        <span className="text-sm text-muted-foreground">{order.invoice_number}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[jobStatus])}>
                          {statusLabels[jobStatus] ?? jobStatus}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />{order.customer_name}
                      </p>
                      {order.customer_address && (
                        <p className="text-xs text-muted-foreground">{order.customer_address}</p>
                      )}
                      {order.job?.delivery_date && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />{order.job.delivery_date}
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openDialog(order)}>
                      {order.job ? 'Edit Order' : 'Set Up Order'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {selected?.job?.delivery_order_id
                ? `Delivery Order — ${selected.job.delivery_order_id}`
                : `Delivery Order — ${selected?.invoice_number}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Delivery Date</Label>
              <Input
                type="date"
                value={form.delivery_date}
                onChange={(e) => setForm(f => ({ ...f, delivery_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: string) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Delivery instructions..."
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Recipient Email</Label>
              <Input
                type="email"
                value={form.recipient_email}
                onChange={(e) => setForm(f => ({ ...f, recipient_email: e.target.value }))}
                placeholder="delivery@company.com"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={downloading || !selected?.job}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading ? 'Generating...' : 'Download PDF'}
            </Button>
            <Button
              variant="outline"
              onClick={handleSendEmail}
              disabled={sending || !form.recipient_email.trim()}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              {sending ? 'Sending...' : 'Send to Delivery Company'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
