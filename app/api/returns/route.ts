export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const result = await sql`SELECT * FROM returns ORDER BY created_at DESC`
    return NextResponse.json(result.rows)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    const body = await request.json()
    const { invoice_id, reason = '', notes = '', refund_amount = 0 } = body

    if (!invoice_id) return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })

    // Ensure returns table exists
    await sql`
      CREATE TABLE IF NOT EXISTS returns (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        invoice_number TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        notes TEXT DEFAULT '',
        refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'pending',
        created_by TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Fetch invoice
    const invResult = await sql`SELECT * FROM invoices WHERE id = ${invoice_id}`
    const inv = invResult.rows[0]
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    // Must be status = complete
    if (inv.status !== 'complete') {
      return NextResponse.json({ error: 'Returns are only allowed on completed invoices' }, { status: 400 })
    }

    // Must be within 30 days of completed_at
    const completedAt = inv.completed_at ? new Date(inv.completed_at) : new Date(inv.updated_at)
    const daysSinceComplete = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceComplete > 30) {
      return NextResponse.json({ error: 'Returns are only allowed within 30 days of invoice completion' }, { status: 400 })
    }

    const id = generateId()
    await sql`
      INSERT INTO returns (id, invoice_id, invoice_number, customer_name, reason, notes, refund_amount, status, created_by)
      VALUES (${id}, ${invoice_id}, ${inv.invoice_number}, ${inv.customer_name}, ${reason}, ${notes}, ${refund_amount}, 'pending', ${authUser.user_id})
    `

    const result = await sql`SELECT * FROM returns WHERE id = ${id}`
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[returns POST]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
