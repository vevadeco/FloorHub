'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, TrendingUp, Package, Users, DollarSign } from 'lucide-react'

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
const fmtPct = (v: number) => `${Number(v).toFixed(1)}%`

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  const monthly: any[] = data?.monthly_revenue ?? []
  const topProducts: any[] = data?.top_products ?? []
  const leadConversion = data?.lead_conversion ?? {}
  const expenseBreakdown: any[] = data?.expense_breakdown ?? []

  const maxRevenue = Math.max(...monthly.map((m: any) => Number(m.revenue)), 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Business performance overview</p>
      </div>

      {/* Monthly Revenue */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            Monthly Revenue (Last 12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthly.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No revenue data yet</p>
          ) : (
            <div className="space-y-3">
              {monthly.map((m: any) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-20 shrink-0">{m.month}</span>
                  <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${(Number(m.revenue) / maxRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium tabular-nums w-24 text-right">{fmt(m.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Package className="h-5 w-5 text-accent" />
              Top Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No product data yet</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p: any, i: number) => (
                  <div key={p.product_name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                      <span className="text-sm font-medium truncate">{p.product_name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium tabular-nums">{fmt(p.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{p.units_sold} boxes</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Conversion */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              Lead Conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums">{leadConversion.total_leads ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Leads</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums text-green-600">{leadConversion.converted ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Converted</p>
                </div>
              </div>
              <div className="bg-accent/10 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold tabular-nums text-accent">
                  {fmtPct(leadConversion.conversion_rate ?? 0)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Conversion Rate</p>
              </div>
              {leadConversion.by_source && leadConversion.by_source.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Source</p>
                  {leadConversion.by_source.map((s: any) => (
                    <div key={s.source} className="flex justify-between text-sm">
                      <span className="capitalize text-muted-foreground">{s.source || 'Unknown'}</span>
                      <span className="font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-accent" />
            Expense Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenseBreakdown.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No expense data yet</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {expenseBreakdown.map((e: any) => (
                <div key={e.category} className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium capitalize">{e.category}</p>
                  <p className="text-xl font-bold tabular-nums mt-1">{fmt(e.total)}</p>
                  <p className="text-xs text-muted-foreground">{e.count} transaction{e.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
