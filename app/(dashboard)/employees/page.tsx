'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash2, Shield, User, Eye, EyeOff, Pencil, Users } from 'lucide-react'

export default function EmployeesPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [commEdit, setCommEdit] = useState<{ id: string; value: string } | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')

  const load = () => fetch('/api/users').then(r => r.json()).then(setUsers).finally(() => setLoading(false))
  useEffect(() => {
    load()
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUserId(d.user_id ?? d.id ?? ''))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    const res = await fetch('/api/users/create-employee', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success('Employee created'); setDialogOpen(false); setForm({ name: '', email: '', password: '' }); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleDelete = async (id: string) => {
    if (id === currentUserId) { toast.error('Cannot delete your own account'); return }
    if (!confirm('Delete this employee?')) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Employee deleted'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const saveCommission = async (id: string) => {
    const rate = parseFloat(commEdit?.value ?? '')
    if (isNaN(rate) || rate < 0 || rate > 100) { toast.error('Rate must be 0–100'); return }
    const res = await fetch(`/api/users/${id}/commission-rate`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commission_rate: rate }) })
    if (res.ok) { toast.success('Commission rate updated'); setCommEdit(null); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Employee Accounts</h1><p className="text-muted-foreground mt-1">Manage employee access to the system</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90"><Plus className="h-4 w-4 mr-2" />Add Employee</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-heading">Create Employee Account</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Password *</Label>
                <div className="relative"><Input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} className="pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div><p className="text-xs text-muted-foreground">Minimum 6 characters</p>
              </div>
              <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="bg-accent hover:bg-accent/90">Create Account</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="bg-blue-50 border-blue-200"><CardContent className="p-4"><div className="flex items-start gap-3"><Shield className="h-5 w-5 text-blue-600 mt-0.5" /><div><h4 className="font-medium text-blue-900">Employee Access</h4><p className="text-sm text-blue-700 mt-1">Employees can only create and view invoices. All other pages are owner-only.</p></div></div></CardContent></Card>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : users.length === 0 ? <div className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No users found</h3></div>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Commission Rate</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{users.map(u => (
              <TableRow key={u.id}>
                <TableCell><div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">{u.role === 'owner' ? <Shield className="h-4 w-4 text-accent" /> : <User className="h-4 w-4 text-muted-foreground" />}</div>
                  <span className="font-medium">{u.name}</span>
                  {u.id === currentUserId && <Badge variant="outline" className="text-xs">You</Badge>}
                </div></TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell><Badge variant="outline" className={u.role === 'owner' ? 'bg-accent/10 text-accent border-accent' : ''}>{u.role}</Badge></TableCell>
                <TableCell>
                  {commEdit?.id === u.id ? (
                    <div className="flex items-center gap-1">
                      <Input type="number" min="0" max="100" step="0.1" value={commEdit.value} onChange={e => setCommEdit({ ...commEdit, value: e.target.value })} className="w-20 h-7 text-sm" />
                      <span className="text-sm text-muted-foreground">%</span>
                      <Button size="sm" className="h-7 text-xs px-2" onClick={() => saveCommission(u.id)}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setCommEdit(null)}>✕</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{Number(u.commission_rate ?? 0).toFixed(1)}%</span>
                      {u.role !== 'owner' && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCommEdit({ id: u.id, value: String(u.commission_rate ?? 0) })}><Pencil className="h-3 w-3" /></Button>}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {u.role !== 'owner' && u.id !== currentUserId && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(u.id)}><Trash2 className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>
    </div>
  )
}
