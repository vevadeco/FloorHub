import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)

    const [products, customers, leads, newLeads, revenue, pending, expenses, recentInv, recentLeads] = await Promise.all([
      sql`SELECT COUNT(*) as v FROM products`,
      sql`SELECT COUNT(*) as v FROM customers`,
      sql`SELECT COUNT(*) as v FROM leads`,
      sql`SELECT COUNT(*) as v FROM leads WHERE status='new'`,
      sql`SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE is_estimate=FALSE AND status='paid'`,
      sql`SELECT COUNT(*) as v FROM invoices WHERE is_estimate=FALSE AND status IN ('draft','sent')`,
      sql`SELECT COALESCE(SUM(amount),0) as v FROM expenses`,
      sql`SELECT id, invoice_number, customer_name, total, status, created_at FROM invoices ORDER BY created_at DESC LIMIT 5`,
      sql`SELECT id, name, status, source, project_type, created_at FROM leads ORDER BY created_at DESC LIMIT 5`,
    ])

    const totalRevenue = Number(revenue.rows[0].v)
    const totalExpenses = Number(expenses.rows[0].v)

    return NextResponse.json({
      products_count: Number(products.rows[0].v),
      customers_count: Number(customers.rows[0].v),
      leads_count: Number(leads.rows[0].v),
      new_leads_count: Number(newLeads.rows[0].v),
      total_revenue: totalRevenue,
      pending_invoices: Number(pending.rows[0].v),
      total_expenses: totalExpenses,
      net_income: totalRevenue - totalExpenses,
      recent_invoices: recentInv.rows,
      recent_leads: recentLeads.rows,
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
