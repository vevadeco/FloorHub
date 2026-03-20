'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Wrench, Mail, Calendar, User } from 'lucide-react'
import { toast } from 'sonner'

interface InstallJob {
  id: string
  invoice_number: string
  customer_name: string
  status: string
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

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function InstallationJobsPage() {
  const [jobs, setJobs] = useState<InstallJob[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InstallJob | null>(null)
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

  useEffect(() => {
    Promise.all([
      fetch('/api/installation-jobs').then(r => r.json()),
      fetch('/api/contractors').then(r => r.json()),
    ]).then(([j, c]) => {
      setJobs(Array.isArray(j) ? j : [])
      setContractors(Array.isArray(c) ? c : [])
    }).finally(() => setLoading(false))
  }, [])

  const openDialog = (job: InstallJob) => {
    setSelected(job)
    setForm({
      contractor_id: job.job?.contractor_id ?? '',
      contractor_name: job.job?.contractor_name ?? '',
      contractor_email: job.job?.contractor_email ?? '',
      install_date: job.job?.install_date ?? '',
      notes: job.job?.notes ?? '',
      status: job.job?.status ?? 'pending',
    })
    setDialogOpen(true)
  }

  const handleContractorChange = (id: string) => {
    const c = contractors.find(x => x.id === id)
    setForm(f => ({
      ...f,
      contractor_id: id,
      contractor_name: c?.name ?? '',
      contractor_email: c?.email ?? '',
    }))
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
      setJobs(prev => prev.map(j => j.id === selected.id ? { ...j, job: updated } : j))
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
        <p className="text-muted-foreground mt-1">Invoices with installation line items</p>
      </div>

      {jobs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No installation jobs found. Add an "install" line item to an invoice to see it here.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {jobs.map(job => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{job.invoice_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[job.job?.status ?? 'pending']}`}>
                        {job.job?.status ?? 'pending'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{job.customer_name}</p>
                    {job.job?.contractor_name && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><Wrench className="h-3 w-3" />{job.job.contractor_name}</p>
                    )}
                    {job.job?.install_date && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{job.job.install_date}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openDialog(job)}>
                    {job.job ? 'Edit Job' : 'Assign Job'}
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
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</SelectItem>
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
