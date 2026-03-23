'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, DollarSign } from 'lucide-react'

const CATEGORIES = ['supplier', 'employee', 'contractor', 'utilities', 'rent', 'other']
const METHODS = ['cash', 'check', 'bank_transfer', 'card', 'other']
const emptyForm = { category: 'other', description: '', amount: '', payment_method: 'cash', reference_number: '', vendor_name: '', employee_id: '', date: new Date().toISOString().split('T')[0] }

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)

  const load = () => fetch('/api/expenses').then(r => r.json()).then(setExpenses).finally(() => setLoading(false))
  useEffect(() => {
    load()
    fetch('/api/employees').then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : d.employees ?? []))
  }, [])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true) }
  const openEdit = (e: any) => { setEditing(e); setForm({ category: e.category, description: e.description, amount: e.amount, payment_method: e.payment_method, reference_number: e.reference_number, vendor_name: e.vendor_name, employee_id: e.employee_id ?? '', date: e.date }); setDialogOpen(true) }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const body: any = { ...form, amount: parseFloat(form.amount as string) }
    // If employee category, set vendor_name to employee name for display
    if (form.category === 'employee' && form.employee_id) {
      const emp = employees.find(e => e.id === form.employee_id)
      if (emp) body.vendor_name = emp.name
    }
    const res = editing
      ? await fetch(`/api/expenses/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { toast.success(editing ? 'Expense updated' : 'Expense created'); setDialogOpen(false); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Expense deleted'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const filtered = expenses.filter(e => catFilter === 'all' || e.category === catFilter)
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Expenses</h1><p className="text-muted-foreground mt-1">Track business expenses</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Expense</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">{editing ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Category *</Label><Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
              </div>
              <div className="space-y-2"><Label>Description *</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Payment Method</Label><Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {form.category === 'employee' ? (
                  <div className="space-y-2">
                    <Label>Employee *</Label>
                    <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>{employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2"><Label>Vendor</Label><Input value={form.vendor_name} onChange={e => setForm({ ...form, vendor_name: e.target.value })} /></div>
                )}
                <div className="space-y-2"><Label>Reference #</Label><Input value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="bg-accent hover:bg-accent/90">{editing ? 'Update' : 'Create'}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex items-center gap-3">
        <Select value={catFilter} onValueChange={setCatFilter}><SelectTrigger className="w-40"><SelectValue placeholder="All Categories" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <span className="text-sm text-muted-foreground">Total: <strong>${total.toFixed(2)}</strong></span>
      </div>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : filtered.length === 0 ? <div className="p-12 text-center"><DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No expenses found</h3></div>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Vendor</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground">{e.date}</TableCell>
                <TableCell className="capitalize">{e.category}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell className="text-muted-foreground">{e.vendor_name || (e.category === 'employee' ? e.employee_name : '')}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{e.payment_method?.replace('_', ' ')}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">${Number(e.amount).toFixed(2)}</TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>
    </div>
  )
}
