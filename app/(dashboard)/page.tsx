'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, Users, Target, DollarSign, FileText, TrendingUp, TrendingDown, ArrowRight, Plus } from 'lucide-react'

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v ?? 0)
const fmtFull = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/stats').then(r => r.json()).then(setStats).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-4 bg-muted rounded w-1/2 mb-2" /><div className="h-8 bg-muted rounded w-1/3" /></CardContent></Card>
        ))}
      </div>
    </div>
  )

  const netProfit = stats?.net_profit ?? 0
  const grossProfit = stats?.gross_profit ?? 0
  const profitMargin = stats?.profit_margin ?? 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your business overview.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/invoices"><FileText className="h-4 w-4 mr-2" />New Invoice</Link></Button>
          <Button className="bg-accent hover:bg-accent/90" asChild><Link href="/leads"><Plus className="h-4 w-4 mr-2" />Add Lead</Link></Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profit">Profit</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Revenue Collected', value: fmt(stats?.total_revenue), icon: DollarSign, color: 'bg-green-100 text-green-600' },
              { title: 'Net Income', value: fmt(stats?.net_income), icon: stats?.net_income >= 0 ? TrendingUp : TrendingDown, color: stats?.net_income >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600' },
              { title: 'New Leads', value: stats?.new_leads_count ?? 0, icon: Target, color: 'bg-orange-100 text-orange-600' },
              { title: 'Pending Invoices', value: stats?.pending_invoices ?? 0, icon: FileText, color: 'bg-blue-100 text-blue-600' },
            ].map(({ title, value, icon: Icon, color }) => (
              <Card key={title} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div><p className="text-sm text-muted-foreground font-medium">{title}</p><p className="text-2xl font-bold mt-1 tabular-nums">{value}</p></div>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}><Icon className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Products in Stock', value: stats?.products_count ?? 0, icon: Package, color: 'bg-purple-100 text-purple-600' },
              { title: 'Total Customers', value: stats?.customers_count ?? 0, icon: Users, color: 'bg-indigo-100 text-indigo-600' },
              { title: 'Total Expenses', value: fmt(stats?.total_expenses), icon: DollarSign, color: 'bg-rose-100 text-rose-600' },
            ].map(({ title, value, icon: Icon, color }) => (
              <Card key={title}><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground font-medium">{title}</p><p className="text-2xl font-bold mt-1 tabular-nums">{value}</p></div><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}><Icon className="h-5 w-5" /></div></div></CardContent></Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-heading text-lg">Recent Invoices</CardTitle>
                <Button variant="ghost" size="sm" asChild><Link href="/invoices" className="text-accent">View All <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
              </CardHeader>
              <CardContent>
                {stats?.recent_invoices?.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recent_invoices.map((inv: any) => (
                      <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                        <div><p className="font-medium text-sm">{inv.invoice_number}</p><p className="text-xs text-muted-foreground">{inv.customer_name}</p></div>
                        <div className="text-right"><p className="font-medium text-sm tabular-nums">{fmt(inv.total)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : inv.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-700'}`}>{inv.status}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : <p className="text-center py-8 text-muted-foreground text-sm">No invoices yet</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-heading text-lg">Recent Leads</CardTitle>
                <Button variant="ghost" size="sm" asChild><Link href="/leads" className="text-accent">View All <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
              </CardHeader>
              <CardContent>
                {stats?.recent_leads?.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recent_leads.map((lead: any) => (
                      <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                        <div><p className="font-medium text-sm">{lead.name}</p><p className="text-xs text-muted-foreground">{lead.project_type || lead.source}</p></div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${lead.status === 'new' ? 'bg-orange-100 text-orange-700' : lead.status === 'won' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-700'}`}>{lead.status}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-center py-8 text-muted-foreground text-sm">No leads yet</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profit Tab */}
        <TabsContent value="profit" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Revenue Collected</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums text-green-600">{fmtFull(stats?.total_revenue)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Actual payments received</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100 text-green-600"><DollarSign className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Gross Profit</p>
                    <p className={`text-2xl font-bold mt-1 tabular-nums ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtFull(grossProfit)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Revenue minus cost of goods</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${grossProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {grossProfit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Total Expenses</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums text-rose-600">{fmtFull(stats?.total_expenses)}</p>
                    <p className="text-xs text-muted-foreground mt-1">All recorded expenses</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-rose-100 text-rose-600"><TrendingDown className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Net Profit</p>
                    <p className={`text-2xl font-bold mt-1 tabular-nums ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtFull(netProfit)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Gross profit minus expenses</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {netProfit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit margin bar */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Profit Margin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall margin on collected revenue</span>
                <span className={`font-bold text-lg tabular-nums ${profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {profitMargin.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${profitMargin >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(Math.abs(profitMargin), 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2 text-center text-sm border-t">
                <div>
                  <p className="text-muted-foreground">Revenue</p>
                  <p className="font-semibold tabular-nums">{fmtFull(stats?.total_revenue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cost of Goods</p>
                  <p className="font-semibold tabular-nums">{fmtFull((stats?.total_revenue ?? 0) - grossProfit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gross Profit</p>
                  <p className={`font-semibold tabular-nums ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtFull(grossProfit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Profit Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Revenue Collected', value: stats?.total_revenue ?? 0, positive: true },
                  { label: 'Cost of Goods Sold', value: -((stats?.total_revenue ?? 0) - grossProfit), positive: false },
                  { label: 'Gross Profit', value: grossProfit, positive: grossProfit >= 0, bold: true },
                  { label: 'Total Expenses', value: -(stats?.total_expenses ?? 0), positive: false },
                  { label: 'Net Profit', value: netProfit, positive: netProfit >= 0, bold: true },
                ].map(({ label, value, positive, bold }) => (
                  <div key={label} className={`flex justify-between items-center py-2 ${bold ? 'border-t font-bold' : 'text-sm'}`}>
                    <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
                    <span className={`tabular-nums ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {value < 0 ? `(${fmtFull(Math.abs(value))})` : fmtFull(value)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
