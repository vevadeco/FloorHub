export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)

    const customerResult = await sql`
      SELECT id, store_credit_balance FROM customers WHERE id = ${params.id}
    `
    if (customerResult.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const balance = parseFloat(customerResult.rows[0].store_credit_balance) || 0

    const ledgerResult = await sql`
      SELECT id, customer_id, transaction_type, amount, reference_type, reference_id, description, created_at
      FROM store_credit_ledger
      WHERE customer_id = ${params.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      balance,
      ledger: ledgerResult.rows.map(row => ({
        ...row,
        amount: parseFloat(row.amount),
      })),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
