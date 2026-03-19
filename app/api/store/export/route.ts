export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)

    const [
      users, products, customers, invoices, invoice_items,
      leads, expenses, contractors, settings, payment_transactions,
      manual_payments, messages, commissions,
    ] = await Promise.all([
      sql`SELECT * FROM users`,
      sql`SELECT * FROM products`,
      sql`SELECT * FROM customers`,
      sql`SELECT * FROM invoices`,
      sql`SELECT * FROM invoice_items`,
      sql`SELECT * FROM leads`,
      sql`SELECT * FROM expenses`,
      sql`SELECT * FROM contractors`,
      sql`SELECT * FROM settings`,
      sql`SELECT * FROM payment_transactions`,
      sql`SELECT * FROM manual_payments`,
      sql`SELECT * FROM messages`,
      sql`SELECT * FROM commissions`,
    ])

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      tables: {
        users: users.rows,
        products: products.rows,
        customers: customers.rows,
        invoices: invoices.rows,
        invoice_items: invoice_items.rows,
        leads: leads.rows,
        expenses: expenses.rows,
        contractors: contractors.rows,
        settings: settings.rows,
        payment_transactions: payment_transactions.rows,
        manual_payments: manual_payments.rows,
        messages: messages.rows,
        commissions: commissions.rows,
      },
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="floorhub-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
