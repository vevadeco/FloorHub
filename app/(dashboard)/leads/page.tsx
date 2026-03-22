'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Target } from 'lucide-react'

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']
const SOURCES = ['manual', 'facebook', 'website', 'referral', 'other']
const emptyForm = { name: '', email: '', phone: '', source: 'manual', status: 'new', notes: '', project_type: '', estimated_sqft: '', assigned_to: '', assigned_to_name: '' }

const statusColor: Record<string, string> = { new: 'bg-orange-100 text-orange-700', contacted: 'bg-blue-100 text-blue-700', qualified: 'bg-purple-100 text-purple-700', won: 'bg-green-100 text-green-700', lost: 'bg-stone-100 text-stone-700', proposal: 'bg-yellow-100 text-yellow-700' }

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)

  const load = () => fetch('/api/leads').then(r => r.json()).then(setLeads).finally(() => setLoading(false))

  useEffect(() => {
    load()
    fetch('/api/auth/me').then(r => r.json()).then(setCurrentUser)
    fetch('/api/users').then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d.filter((u: any) => u.role === 'employee') : [])).catch(() => {})
  }, [])

  const isOwner = currentUser?.role === 'owner'

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true) }
  const openEdit = (l: any) => {
    setEditing(l)
    setForm({ name: l.name, email: l.email, phone: l.phone, source: l.source, status: l.status, notes: l.notes, project_type: l.project_type, estimated_sqft: l.estimated_sqft, assigned_to: l.assigned_to ?? '', assigned_to_name: l.assigned_to_name ?? '' })
    setDialogOpen(true)
  }

  const handleAssignChange = (employeeId: string) => {
    if (employeeId === 'unassigned') {
      setForm(f => ({ ...f, assigned_to: '', assigned_to_name: '' }))
    } else {
      const emp = employees.find((e: any) => e.id === employeeId)
      setForm(f => ({ ...f, assigned_to: employeeId, assigned_to_name: emp?.name ?? '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = { ...form, estimated_sqft: parseFloat(form.estimated_sqft as string) || 0 }
    const res = editing
      ? await fetch(`/api/leads/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { toast.success(editing ? 'Lead updated' : 'Lead created'); setDialogOpen(false); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Lead deleted'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const filtered = leads.filter(l => statusFilter === 'all' || l.status === statusFilter)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Leads</h1><p className="text-muted-foreground mt-1">Track and manage potential customers</p></div>
        {isOwner && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Lead</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="font-heading">{editing ? 'Edit Lead' : 'Add Lead'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Source</Label><Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Project Type</Label><Input value={form.project_type} onChange={e => setForm({ ...form, project_type: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Est. Sq Ft</Label><Input type="number" step="0.01" value={form.estimated_sqft} onChange={e => setForm({ ...form, estimated_sqft: e.target.value })} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select value={form.assigned_to || 'unassigned'} onValueChange={handleAssignChange}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {employees.map((emp: any) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
                <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="bg-accent hover:bg-accent/90">{editing ? 'Update' : 'Create'}</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : filtered.length === 0 ? <div className="p-12 text-center"><Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No leads found</h3></div>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Source</TableHead><TableHead>Project</TableHead><TableHead>Assigned To</TableHead><TableHead>Status</TableHead>{isOwner && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
            <TableBody>{filtered.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{l.email || l.phone}</TableCell>
                <TableCell className="capitalize">{l.source}</TableCell>
                <TableCell className="text-muted-foreground">{l.project_type}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{l.assigned_to_name || '—'}</TableCell>
                <TableCell><span className={`text-xs px-2 py-1 rounded-full ${statusColor[l.status] ?? 'bg-stone-100 text-stone-700'}`}>{l.status}</span></TableCell>
                {isOwner && <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>}
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>
    </div>
  )
}
