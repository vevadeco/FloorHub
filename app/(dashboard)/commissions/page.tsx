'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { TrendingUp, CheckCircle, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [empFilter, setEmpFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = () => fetch('/api/commissions').then(r => r.json()).then(setCommissions).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const markPaid = async (id: string) => {
    const res = await fetch(`/api/commissions/${id}/mark-paid`, { method: 'POST' })
    if (res.ok) { toast.success('Marked as paid'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const markUnpaid = async (id: string) => {
    const res = await fetch(`/api/commissions/${id}/mark-unpaid`, { method: 'POST' })
    if (res.ok) { toast.success('Marked as unpaid'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const employees = Array.from(new Map(commissions.map((c: any) => [c.employee_id, c.employee_name])).entries())
  const filtered = commissions.filter(c => (empFilter === 'all' || c.employee_id === empFilter) && (statusFilter === 'all' || c.status === statusFilter))
  const totalUnpaid = commissions.filter(c => c.status === 'unpaid').reduce((s, c) => s + Number(c.commission_amount), 0)
  const totalPaid = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.commission_amount), 0)

  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Commissions</h1><p className="text-muted-foreground mt-1">Track and manage employee commission payments</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-yellow-600" /></div><div><p className="text-sm text-muted-foreground">Total Unpaid</p><p className="text-2xl font-bold">${totalUnpaid.toFixed(2)}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">Total Paid</p><p className="text-2xl font-bold">${totalPaid.toFixed(2)}</p></div></CardContent></Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <Select value={empFilter} onValueChange={setEmpFilter}><SelectTrigger className="w-48"><SelectValue placeholder="All Employees" /></SelectTrigger><SelectContent><SelectItem value="all">All Employees</SelectItem>{employees.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select>
      </div>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : filtered.length === 0 ? <div className="p-12 text-center"><DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No commissions found</h3><p className="text-muted-foreground text-sm">Commissions are calculated when invoices are marked as paid.</p></div>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Employee</TableHead><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Profit</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Commission</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.employee_name}</TableCell>
                <TableCell className="text-muted-foreground">{c.invoice_number}</TableCell>
                <TableCell className="text-muted-foreground">{c.invoice_date}</TableCell>
                <TableCell className="text-right">${Number(c.profit).toFixed(2)}</TableCell>
                <TableCell className="text-right">{Number(c.commission_rate).toFixed(1)}%</TableCell>
                <TableCell className="text-right font-medium">${Number(c.commission_amount).toFixed(2)}</TableCell>
                <TableCell><Badge variant="outline" className={cn(c.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200')}>{c.status}</Badge></TableCell>
                <TableCell className="text-right">
                  {c.status === 'unpaid'
                    ? <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs" onClick={() => markPaid(c.id)}>Mark Paid</Button>
                    : <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markUnpaid(c.id)}>Mark Unpaid</Button>}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>
    </div>
  )
}
