'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, HardHat } from 'lucide-react'

const emptyForm = { name: '', company: '', phone: '', email: '', specialty: '', address: '', notes: '', rating: '5' }

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)

  const load = () => fetch('/api/contractors').then(r => r.json()).then(setContractors).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true) }
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c.name, company: c.company, phone: c.phone, email: c.email, specialty: c.specialty, address: c.address, notes: c.notes, rating: String(c.rating) }); setDialogOpen(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = { ...form, rating: parseInt(form.rating) }
    const res = editing
      ? await fetch(`/api/contractors/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/contractors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { toast.success(editing ? 'Contractor updated' : 'Contractor created'); setDialogOpen(false); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contractor?')) return
    const res = await fetch(`/api/contractors/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Contractor deleted'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Contractors</h1><p className="text-muted-foreground mt-1">Manage your contractor network</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Contractor</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">{editing ? 'Edit Contractor' : 'Add Contractor'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Company</Label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
                <div className="space-y-2"><Label>Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Specialty</Label><Input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} /></div>
                <div className="space-y-2"><Label>Rating (1-5)</Label><Input type="number" min="1" max="5" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="bg-accent hover:bg-accent/90">{editing ? 'Update' : 'Create'}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : contractors.length === 0 ? <div className="p-12 text-center"><HardHat className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No contractors found</h3></div>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>Phone</TableHead><TableHead>Specialty</TableHead><TableHead>Rating</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{contractors.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.company}</TableCell>
                <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                <TableCell className="text-muted-foreground">{c.specialty}</TableCell>
                <TableCell>{'★'.repeat(c.rating)}{'☆'.repeat(5 - c.rating)}</TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>
    </div>
  )
}
