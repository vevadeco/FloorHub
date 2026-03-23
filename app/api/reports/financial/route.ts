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

    // Revenue = actual payments received (same as dashboard)
    // manual_payments + stripe payment_transactions with payment_status='paid'
    const manualPayResult = startDate && endDate
      ? await sql`SELECT amount FROM manual_payments WHERE date BETWEEN ${startDate} AND ${endDate}`
      : await sql`SELECT amount FROM manual_payments`

    const stripePayResult = startDate && endDate
      ? await sql`SELECT amount FROM payment_transactions WHERE payment_status='paid' AND DATE(created_at) BETWEEN ${startDate} AND ${endDate}`
      : await sql`SELECT amount FROM payment_transactions WHERE payment_status='paid'`

    const totalRevenue =
      manualPayResult.rows.reduce((s, r) => s + Number(r.amount), 0) +
      stripePayResult.rows.reduce((s, r) => s + Number(r.amount), 0)

    // Pending = invoices not yet paid (draft/sent)
    const pendingResult = startDate && endDate
      ? await sql`SELECT total FROM invoices WHERE is_estimate=FALSE AND status IN ('draft','sent') AND DATE(created_at) BETWEEN ${startDate} AND ${endDate}`
      : await sql`SELECT total FROM invoices WHERE is_estimate=FALSE AND status IN ('draft','sent')`
    const totalPending = pendingResult.rows.reduce((s, r) => s + Number(r.total), 0)

    // Expenses
    const expResult = startDate && endDate
      ? await sql`SELECT category, amount FROM expenses WHERE date BETWEEN ${startDate} AND ${endDate}`
      : await sql`SELECT category, amount FROM expenses`

    const expenseByCategory: Record<string, number> = {}
    for (const e of expResult.rows) {
      expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + Number(e.amount)
    }
    const totalExpenses = Object.values(expenseByCategory).reduce((s, v) => s + v, 0)

    // Payment method breakdown (manual payments only — stripe is its own method)
    const payMethodResult = startDate && endDate
      ? await sql`SELECT payment_method, amount FROM manual_payments WHERE date BETWEEN ${startDate} AND ${endDate}`
      : await sql`SELECT payment_method, amount FROM manual_payments`

    const paymentMethods: Record<string, number> = {}
    for (const p of payMethodResult.rows) {
      paymentMethods[p.payment_method] = (paymentMethods[p.payment_method] ?? 0) + Number(p.amount)
    }
    if (stripePayResult.rows.length > 0) {
      paymentMethods['stripe'] = stripePayResult.rows.reduce((s, r) => s + Number(r.amount), 0)
    }

    const grossProfit = totalRevenue - totalExpenses

    // Gross profit from invoices: (sell_price - cost_price) * sqft for paid invoices
    const invoiceProfit = startDate && endDate
      ? await sql`
          SELECT COALESCE(SUM((ii.unit_price - COALESCE(p.cost_price, 0)) * ii.sqft_needed), 0) as v
          FROM invoice_items ii
          JOIN invoices i ON ii.invoice_id = i.id
          LEFT JOIN products p ON ii.product_id = p.id
          WHERE i.is_estimate = FALSE AND i.status = 'paid'
          AND DATE(i.created_at) BETWEEN ${startDate} AND ${endDate}
        `
      : await sql`
          SELECT COALESCE(SUM((ii.unit_price - COALESCE(p.cost_price, 0)) * ii.sqft_needed), 0) as v
          FROM invoice_items ii
          JOIN invoices i ON ii.invoice_id = i.id
          LEFT JOIN products p ON ii.product_id = p.id
          WHERE i.is_estimate = FALSE AND i.status = 'paid'
        `

    const invoiceGrossProfit = Number(invoiceProfit.rows[0]?.v ?? 0)

    const invCount = await sql`SELECT COUNT(*) FROM invoices WHERE is_estimate=FALSE`
    const paidCount = await sql`SELECT COUNT(*) FROM invoices WHERE is_estimate=FALSE AND status='paid'`
    const expCount = await sql`SELECT COUNT(*) FROM expenses`

    return NextResponse.json({
      total_revenue: totalRevenue,
      total_pending: totalPending,
      total_expenses: totalExpenses,
      gross_profit: grossProfit,
      invoice_gross_profit: invoiceGrossProfit,
      profit_margin: totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0,
      expense_by_category: expenseByCategory,
      payment_methods: paymentMethods,
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
