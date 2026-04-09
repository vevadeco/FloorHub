'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Search, Users, Wallet, Loader2 } from 'lucide-react'

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const emptyForm = { name: '', email: '', phone: '', address: '', city: '', state: '', zip_code: '', notes: '' }

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [ledger, setLedger] = useState<any[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  const load = () => fetch('/api/customers').then(r => r.json()).then(setCustomers).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const hasAnyCredit = customers.some(c => parseFloat(c.store_credit_balance) > 0)

  const loadLedger = (customerId: string) => {
    setLedgerLoading(true)
    fetch(`/api/customers/${customerId}/store-credit`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLedger(d.ledger ?? []) })
      .finally(() => setLedgerLoading(false))
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setLedger([]); setDialogOpen(true) }
  const openEdit = (c: any) => {
    setEditing(c)
    setForm({ name: c.name, email: c.email, phone: c.phone, address: c.address, city: c.city, state: c.state, zip_code: c.zip_code, notes: c.notes })
    setLedger([])
    if (parseFloat(c.store_credit_balance) > 0) loadLedger(c.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = editing
      ? await fetch(`/api/customers/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      : await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success(editing ? 'Customer updated' : 'Customer created'); setDialogOpen(false); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer?')) return
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Customer deleted'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Customers</h1><p className="text-muted-foreground mt-1">Manage your customer database</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Customer</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-2"><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
                <div className="space-y-2"><Label>ZIP</Label><Input value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="bg-accent hover:bg-accent/90">{editing ? 'Update' : 'Create'}</Button></div>
            </form>
            {editing && (parseFloat(editing.store_credit_balance) > 0 || ledger.length > 0) && (
              <div className="border-t pt-4 mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm">Store Credit</span>
                  </div>
                  <span className="font-semibold text-green-600 tabular-nums">{fmt(parseFloat(editing.store_credit_balance) || 0)}</span>
                </div>
                {ledgerLoading ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : ledger.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.map((entry: any) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-xs text-muted-foreground">{fmtDate(entry.created_at)}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className={entry.transaction_type === 'credit' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                {entry.transaction_type}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-xs text-right tabular-nums font-medium ${entry.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                              {entry.transaction_type === 'credit' ? '+' : '-'}{fmt(entry.amount)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{entry.description || `${entry.reference_type} #${entry.reference_id.slice(0, 8)}`}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div></CardContent></Card>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : filtered.length === 0 ? <div className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No customers found</h3></div>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>City</TableHead>{hasAnyCredit && <TableHead className="text-right">Store Credit</TableHead>}<TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.email}</TableCell>
                <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                <TableCell className="text-muted-foreground">{c.city}</TableCell>
                {hasAnyCredit && <TableCell className="text-right tabular-nums">{parseFloat(c.store_credit_balance) > 0 ? <span className="text-green-600 font-medium">{fmt(parseFloat(c.store_credit_balance))}</span> : <span className="text-muted-foreground">—</span>}</TableCell>}
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
