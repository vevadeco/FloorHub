export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const invResult = startDate && endDate
      ? await sql`SELECT status, total FROM invoices WHERE is_estimate=FALSE AND DATE(created_at) BETWEEN ${startDate} AND ${endDate}`
      : await sql`SELECT status, total FROM invoices WHERE is_estimate=FALSE`

    const expResult = startDate && endDate
      ? await sql`SELECT category, amount FROM expenses WHERE date BETWEEN ${startDate} AND ${endDate}`
      : await sql`SELECT category, amount FROM expenses`

    const payResult = startDate && endDate
      ? await sql`SELECT payment_method, amount FROM manual_payments WHERE date BETWEEN ${startDate} AND ${endDate}`
      : await sql`SELECT payment_method, amount FROM manual_payments`

    const totalRevenue = invResult.rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.total), 0)
    const totalPending = invResult.rows.filter(r => ['draft','sent','partial'].includes(r.status)).reduce((s, r) => s + Number(r.total), 0)

    const expenseByCategory: Record<string, number> = {}
    for (const e of expResult.rows) expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + Number(e.amount)
    const totalExpenses = Object.values(expenseByCategory).reduce((s, v) => s + v, 0)

    const paymentMethods: Record<string, number> = {}
    for (const p of payResult.rows) paymentMethods[p.payment_method] = (paymentMethods[p.payment_method] ?? 0) + Number(p.amount)

    const grossProfit = totalRevenue - totalExpenses
    const invCount = await sql`SELECT COUNT(*) FROM invoices WHERE is_estimate=FALSE`
    const paidCount = await sql`SELECT COUNT(*) FROM invoices WHERE is_estimate=FALSE AND status='paid'`
    const expCount = await sql`SELECT COUNT(*) FROM expenses`

    return NextResponse.json({
      total_revenue: totalRevenue, total_pending: totalPending,
      total_expenses: totalExpenses, gross_profit: grossProfit,
      profit_margin: totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0,
      expense_by_category: expenseByCategory, payment_methods: paymentMethods,
      invoice_count: Number(invCount.rows[0].count),
      paid_invoice_count: Number(paidCount.rows[0].count),
      expense_count: Number(expCount.rows[0].count),
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
