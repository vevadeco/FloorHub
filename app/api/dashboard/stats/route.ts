export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)

    const [
      products, customers, leads, newLeads,
      manualPay, stripePay,
      pending, expenses,
      recentInv, recentLeads,
      invoiceProfit,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as v FROM products`,
      sql`SELECT COUNT(*) as v FROM customers`,
      sql`SELECT COUNT(*) as v FROM leads`,
      sql`SELECT COUNT(*) as v FROM leads WHERE status='new'`,
      // Revenue: manual payments (only for existing invoices)
      sql`SELECT COALESCE(SUM(mp.amount),0) as v FROM manual_payments mp WHERE EXISTS (SELECT 1 FROM invoices i WHERE i.id = mp.invoice_id)`,
      // Revenue: stripe payments (only for existing invoices)
      sql`SELECT COALESCE(SUM(pt.amount),0) as v FROM payment_transactions pt WHERE pt.payment_status='paid' AND EXISTS (SELECT 1 FROM invoices i WHERE i.id = pt.invoice_id)`,
      sql`SELECT COUNT(*) as v FROM invoices WHERE is_estimate = false AND status IN ('draft','sent')`,
      sql`SELECT COALESCE(SUM(amount),0) as v FROM expenses`,
      sql`SELECT i.id, i.invoice_number, i.customer_name, i.total, i.status, i.created_at
          FROM invoices i ORDER BY i.created_at DESC LIMIT 5`,
      sql`SELECT id, name, status, source, project_type, created_at FROM leads ORDER BY created_at DESC LIMIT 5`,
      // Gross profit from paid invoice line items: (sell - cost) * sqft
      sql`
        SELECT COALESCE(SUM((ii.unit_price - COALESCE(p.cost_price, 0)) * ii.sqft_needed), 0) as v
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        LEFT JOIN products p ON ii.product_id = p.id
        WHERE i.is_estimate = FALSE AND i.status = 'paid'
      `,
    ])

    const totalRevenue = Number(manualPay.rows[0].v) + Number(stripePay.rows[0].v)
    const totalExpenses = Number(expenses.rows[0].v)
    const grossProfit = Number(invoiceProfit.rows[0].v)
    const netProfit = grossProfit - totalExpenses

    return NextResponse.json({
      products_count: Number(products.rows[0].v),
      customers_count: Number(customers.rows[0].v),
      leads_count: Number(leads.rows[0].v),
      new_leads_count: Number(newLeads.rows[0].v),
      total_revenue: totalRevenue,
      pending_invoices: Number(pending.rows[0].v),
      total_expenses: totalExpenses,
      net_income: totalRevenue - totalExpenses,
      gross_profit: grossProfit,
      net_profit: netProfit,
      profit_margin: totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0,
      recent_invoices: recentInv.rows,
      recent_leads: recentLeads.rows,
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
