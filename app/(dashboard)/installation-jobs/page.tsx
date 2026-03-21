'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Wrench, Mail, Calendar, User, DollarSign, ChevronLeft, ChevronRight, List } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function InstallationJobsPage() {
  const [invoices, setInvoices] = useState<InstallInvoice[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InstallInvoice | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

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

  // Build a map of install_date -> invoices for the calendar
  const dateMap = useMemo(() => {
    const map: Record<string, InstallInvoice[]> = {}
    for (const inv of invoices) {
      if (inv.job?.install_date) {
        const d = inv.job.install_date // YYYY-MM-DD
        if (!map[d]) map[d] = []
        map[d].push(inv)
      }
    }
    return map
  }, [invoices])

  // Calendar grid
  const calendarDays = useMemo(() => {
    const { year, month } = calMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [calMonth])

  const todayStr = new Date().toISOString().split('T')[0]

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Installation Jobs</h1>
          <p className="text-muted-foreground mt-1">Invoices marked as installation jobs</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>
            <List className="h-4 w-4 mr-1" />List
          </Button>
          <Button variant={view === 'calendar' ? 'default' : 'outline'} size="sm" onClick={() => setView('calendar')}>
            <Calendar className="h-4 w-4 mr-1" />Calendar
          </Button>
        </div>
      </div>

      {view === 'list' ? (
        invoices.length === 0 ? (
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
        )
      ) : (
        /* Calendar View */
        <Card>
          <CardContent className="p-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => setCalMonth(m => {
                const d = new Date(m.year, m.month - 1)
                return { year: d.getFullYear(), month: d.getMonth() }
              })}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-semibold text-lg">{MONTHS[calMonth.month]} {calMonth.year}</h2>
              <Button variant="ghost" size="icon" onClick={() => setCalMonth(m => {
                const d = new Date(m.year, m.month + 1)
                return { year: d.getFullYear(), month: d.getMonth() }
              })}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={idx} className="bg-muted/30 min-h-[80px]" />
                const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const jobs = dateMap[dateStr] ?? []
                const isToday = dateStr === todayStr
                const isBooked = jobs.length > 0

                return (
                  <div
                    key={idx}
                    className={cn(
                      'bg-background min-h-[80px] p-1.5 text-sm',
                      isBooked && 'bg-red-50',
                    )}
                  >
                    <span className={cn(
                      'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1',
                      isToday ? 'bg-accent text-accent-foreground' : 'text-foreground',
                    )}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {jobs.map(inv => (
                        <button
                          key={inv.id}
                          onClick={() => openDialog(inv)}
                          className="w-full text-left text-xs px-1 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 truncate"
                          title={`${inv.invoice_number} — ${inv.customer_name}`}
                        >
                          {inv.customer_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200" />
              Booked date
            </div>
          </CardContent>
        </Card>
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
