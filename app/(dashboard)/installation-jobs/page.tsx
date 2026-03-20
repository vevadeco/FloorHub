'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Wrench, Mail, Calendar, User, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

interface InstallInvoice {
  id: string
  invoice_number: string
  customer_name: string
  customer_address: string
  customer_phone: string
  status: string
  total: number
  created_at: string
  job: {
    id: string
    contractor_id: string
    contractor_name: string
    contractor_email: string
    install_date: string
    notes: string
    status: string
  } | null
}

interface Contractor {
  id: string
  name: string
  email: string
  phone: string
}

const jobStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)

export default function InstallationJobsPage() {
  const [invoices, setInvoices] = useState<InstallInvoice[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InstallInvoice | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const [form, setForm] = useState({
    contractor_id: '',
    contractor_name: '',
    contractor_email: '',
    install_date: '',
    notes: '',
    status: 'pending',
  })

  const load = () => {
    Promise.all([
      fetch('/api/installation-jobs').then(r => r.json()),
      fetch('/api/contractors').then(r => r.json()),
    ]).then(([inv, c]) => {
      setInvoices(Array.isArray(inv) ? inv : [])
      setContractors(Array.isArray(c) ? c : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openDialog = (inv: InstallInvoice) => {
    setSelected(inv)
    setForm({
      contractor_id: inv.job?.contractor_id ?? '',
      contractor_name: inv.job?.contractor_name ?? '',
      contractor_email: inv.job?.contractor_email ?? '',
      install_date: inv.job?.install_date ?? '',
      notes: inv.job?.notes ?? '',
      status: inv.job?.status ?? 'pending',
    })
    setDialogOpen(true)
  }

  const handleContractorChange = (id: string) => {
    const c = contractors.find(x => x.id === id)
    setForm(f => ({ ...f, contractor_id: id, contractor_name: c?.name ?? '', contractor_email: c?.email ?? '' }))
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/installation-jobs/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to save')
      const updated = await res.json()
      setInvoices(prev => prev.map(i => i.id === selected.id ? { ...i, job: updated } : i))
      toast.success('Job updated')
      setDialogOpen(false)
    } catch {
      toast.error('Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  const handleSendEmail = async () => {
    if (!selected) return
    setSending(true)
    try {
      const res = await fetch(`/api/installation-jobs/${selected.id}/send-email`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      toast.success('Work order sent to contractor')
    } catch (e: any) {
      toast.error(e.message || 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Installation Jobs</h1>
        <p className="text-muted-foreground mt-1">Invoices marked as installation jobs</p>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No installation jobs yet. Check "Mark as Installation Job" when creating an invoice.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invoices.map(inv => (
            <Card key={inv.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{inv.invoice_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${jobStatusColors[inv.job?.status ?? 'pending']}`}>
                        {inv.job?.status ?? 'pending'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />{inv.customer_name}
                    </p>
                    {inv.customer_address && (
                      <p className="text-xs text-muted-foreground">{inv.customer_address}</p>
                    )}
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />{fmt(inv.total)}
                    </p>
                    {inv.job?.contractor_name && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Wrench className="h-3 w-3" />{inv.job.contractor_name}
                      </p>
                    )}
                    {inv.job?.install_date && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />{inv.job.install_date}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openDialog(inv)}>
                    {inv.job ? 'Edit Job' : 'Assign Job'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Installation Job — {selected?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Contractor</Label>
              <Select value={form.contractor_id} onValueChange={handleContractorChange}>
                <SelectTrigger><SelectValue placeholder="Select contractor" /></SelectTrigger>
                <SelectContent>
                  {contractors.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Contractor Email</Label>
              <Input
                value={form.contractor_email}
                onChange={e => setForm(f => ({ ...f, contractor_email: e.target.value }))}
                placeholder="contractor@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Install Date</Label>
              <Input
                type="date"
                value={form.install_date}
                onChange={e => setForm(f => ({ ...f, install_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any special instructions..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleSendEmail}
              disabled={sending || !form.contractor_email}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              {sending ? 'Sending...' : 'Send Work Order'}
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
