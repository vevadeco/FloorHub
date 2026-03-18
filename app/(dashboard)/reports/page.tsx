'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

export default function ReportsPage() {
  const [financial, setFinancial] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const loadFinancial = async () => {
    setLoading(true)
    const params = startDate && endDate ? `?start_date=${startDate}&end_date=${endDate}` : ''
    const [fin, txn] = await Promise.all([
      fetch(`/api/reports/financial${params}`).then(r => r.json()),
      fetch(`/api/reports/transactions${params}`).then(r => r.json()),
    ])
    setFinancial(fin); setTransactions(txn.transactions ?? [])
    setLoading(false)
  }

  useEffect(() => { loadFinancial() }, [])

  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Reports</h1><p className="text-muted-foreground mt-1">Financial overview and transaction history</p></div>
      <Card><CardContent className="p-4"><div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" /></div>
        <div className="space-y-1"><Label>End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" /></div>
        <Button onClick={loadFinancial} className="bg-accent hover:bg-accent/90">Apply Filter</Button>
        {(startDate || endDate) && <Button variant="outline" onClick={() => { setStartDate(''); setEndDate(''); setTimeout(loadFinancial, 0) }}>Clear</Button>}
      </div></CardContent></Card>

      <Tabs defaultValue="financial">
        <TabsList><TabsTrigger value="financial">Financial Summary</TabsTrigger><TabsTrigger value="transactions">Transactions</TabsTrigger></TabsList>
        <TabsContent value="financial">
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : financial && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Revenue', value: fmt(financial.total_revenue), color: 'text-green-600' },
                  { label: 'Total Expenses', value: fmt(financial.total_expenses), color: 'text-red-600' },
                  { label: 'Gross Profit', value: fmt(financial.gross_profit), color: financial.gross_profit >= 0 ? 'text-green-600' : 'text-red-600' },
                  { label: 'Profit Margin', value: `${Number(financial.profit_margin).toFixed(1)}%`, color: '' },
                ].map(({ label, value, color }) => (
                  <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>{value}</p></CardContent></Card>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="font-heading text-lg">Expenses by Category</CardTitle></CardHeader>
                  <CardContent><div className="space-y-2">{Object.entries(financial.expense_by_category ?? {}).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between text-sm"><span className="capitalize">{cat}</span><span className="tabular-nums font-medium">{fmt(amt as number)}</span></div>
                  ))}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="font-heading text-lg">Payment Methods</CardTitle></CardHeader>
                  <CardContent><div className="space-y-2">{Object.entries(financial.payment_methods ?? {}).map(([method, amt]) => (
                    <div key={method} className="flex justify-between text-sm"><span className="capitalize">{method.replace('_', ' ')}</span><span className="tabular-nums font-medium">{fmt(amt as number)}</span></div>
                  ))}</div></CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="transactions">
          <Card><CardContent className="p-0">
            {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
              : transactions.length === 0 ? <div className="p-12 text-center text-muted-foreground">No transactions found</div>
              : <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>{transactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{new Date(t.date).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{t.type}</TableCell>
                    <TableCell className="font-mono text-sm">{t.invoice_number}</TableCell>
                    <TableCell>{t.customer_name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{t.payment_method?.replace('_', ' ') ?? t.reference}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-1 rounded-full ${t.status === 'paid' || t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-700'}`}>{t.status}</span></TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(t.amount)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
