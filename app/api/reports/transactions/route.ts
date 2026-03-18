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

    const stripeResult = startDate && endDate
      ? await sql`SELECT * FROM payment_transactions WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate} ORDER BY created_at DESC`
      : await sql`SELECT * FROM payment_transactions ORDER BY created_at DESC`

    const manualResult = startDate && endDate
      ? await sql`SELECT * FROM manual_payments WHERE date BETWEEN ${startDate} AND ${endDate} ORDER BY created_at DESC`
      : await sql`SELECT * FROM manual_payments ORDER BY created_at DESC`

    const transactions = []

    for (const t of stripeResult.rows) {
      let invoiceNumber = '', customerName = ''
      if (t.invoice_id) {
        const inv = await sql`SELECT invoice_number, customer_name FROM invoices WHERE id=${t.invoice_id}`
        if (inv.rows[0]) { invoiceNumber = inv.rows[0].invoice_number; customerName = inv.rows[0].customer_name }
      }
      transactions.push({ id: t.id, type: 'stripe', amount: Number(t.amount), status: t.payment_status,
        invoice_number: invoiceNumber, customer_name: customerName,
        date: t.created_at, reference: t.session_id })
    }

    for (const p of manualResult.rows) {
      let invoiceNumber = '', customerName = ''
      if (p.invoice_id) {
        const inv = await sql`SELECT invoice_number, customer_name FROM invoices WHERE id=${p.invoice_id}`
        if (inv.rows[0]) { invoiceNumber = inv.rows[0].invoice_number; customerName = inv.rows[0].customer_name }
      }
      transactions.push({ id: p.id, type: 'manual', amount: Number(p.amount), status: 'completed',
        invoice_number: invoiceNumber, customer_name: customerName,
        date: p.date, reference: p.reference_number ?? '', payment_method: p.payment_method })
    }

    transactions.sort((a, b) => String(b.date).localeCompare(String(a.date)))
    return NextResponse.json({ transactions })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
