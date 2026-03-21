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

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('employee')
  const [empFilter, setEmpFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = async () => {
    const [c, me] = await Promise.all([
      fetch('/api/commissions').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
    ])
    setCommissions(Array.isArray(c) ? c : [])
    setUserRole(me?.role ?? 'employee')
    setLoading(false)
  }
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
  const filtered = commissions.filter((c: any) =>
    (empFilter === 'all' || c.employee_id === empFilter) &&
    (statusFilter === 'all' || c.status === statusFilter)
  )
  const totalUnpaid = filtered.filter((c: any) => c.status === 'unpaid').reduce((s: number, c: any) => s + Number(c.commission_amount), 0)
  const totalPaid = filtered.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + Number(c.commission_amount), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Commissions</h1>
        <p className="text-muted-foreground mt-1">
          {userRole === 'owner' ? 'Track and manage employee commission payments' : 'Your earned commissions per invoice'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-yellow-600" /></div>
          <div><p className="text-sm text-muted-foreground">Unpaid</p><p className="text-2xl font-bold">{fmt(totalUnpaid)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-green-600" /></div>
          <div><p className="text-sm text-muted-foreground">Paid</p><p className="text-2xl font-bold">{fmt(totalPaid)}</p></div>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3">
        {userRole === 'owner' && (
          <Select value={empFilter} onValueChange={setEmpFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(([id, name]) => <SelectItem key={id as string} value={id as string}>{name as string}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        {loading
          ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : filtered.length === 0
            ? <div className="p-12 text-center"><DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No commissions found</h3><p className="text-muted-foreground text-sm">Commissions are calculated when invoices are marked as paid.</p></div>
            : <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {userRole === 'owner' && <TableHead>Employee</TableHead>}
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Status</TableHead>
                  {userRole === 'owner' && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    {userRole === 'owner' && <TableCell className="font-medium">{c.employee_name}</TableCell>}
                    <TableCell className="font-mono text-sm">{c.invoice_number}</TableCell>
                    <TableCell className="text-muted-foreground">{c.invoice_date}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Number(c.profit))}</TableCell>
                    <TableCell className="text-right">{Number(c.commission_rate).toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{fmt(Number(c.commission_amount))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(c.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200')}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    {userRole === 'owner' && (
                      <TableCell className="text-right">
                        {c.status === 'unpaid'
                          ? <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs" onClick={() => markPaid(c.id)}>Mark Paid</Button>
                          : <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markUnpaid(c.id)}>Mark Unpaid</Button>}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>}
      </CardContent></Card>
    </div>
  )
}
