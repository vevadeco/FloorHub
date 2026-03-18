export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)

    const monthlyData = []
    const now = new Date()

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

      const [rev, invCount, exp, leadCount, convCount] = await Promise.all([
        sql`SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE is_estimate=FALSE AND status='paid' AND TO_CHAR(created_at,'YYYY-MM')=${monthStr}`,
        sql`SELECT COUNT(*) as v FROM invoices WHERE is_estimate=FALSE AND TO_CHAR(created_at,'YYYY-MM')=${monthStr}`,
        sql`SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE date LIKE ${monthStr + '%'}`,
        sql`SELECT COUNT(*) as v FROM leads WHERE TO_CHAR(created_at,'YYYY-MM')=${monthStr}`,
        sql`SELECT COUNT(*) as v FROM leads WHERE status='won' AND TO_CHAR(created_at,'YYYY-MM')=${monthStr}`,
      ])

      const revenue = Number(rev.rows[0].v)
      const expenses = Number(exp.rows[0].v)
      monthlyData.push({ month: monthLabel, revenue, expenses, profit: revenue - expenses,
        invoices: Number(invCount.rows[0].v), leads: Number(leadCount.rows[0].v),
        converted_leads: Number(convCount.rows[0].v) })
    }

    const topProducts = await sql`
      SELECT ii.product_name, SUM(ii.total_price) as revenue, SUM(ii.boxes_needed) as boxes_sold
      FROM invoice_items ii JOIN invoices i ON ii.invoice_id=i.id
      WHERE i.status='paid' AND i.is_estimate=FALSE
      GROUP BY ii.product_name ORDER BY revenue DESC LIMIT 5`

    const leadsBySource = await sql`SELECT source, COUNT(*) as count FROM leads GROUP BY source`
    const expensesByCategory = await sql`SELECT category, COALESCE(SUM(amount),0) as total FROM expenses GROUP BY category`

    return NextResponse.json({
      monthly_data: monthlyData,
      top_products: topProducts.rows,
      leads_by_source: leadsBySource.rows,
      expenses_by_category: expensesByCategory.rows,
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
