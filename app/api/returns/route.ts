export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    // Lazy migrations for new columns
    await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS restocking_fee NUMERIC(10,2) NOT NULL DEFAULT 0.0`
    await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS net_refund NUMERIC(10,2) NOT NULL DEFAULT 0.0`
    await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS transaction_reference TEXT DEFAULT ''`
    await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`
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
    const {
      invoice_id,
      reason = '',
      notes = '',
      transaction_reference = '',
      items = [], // [{ product_name, sqft_needed, unit_price, return_sqft, return_total }]
    } = body

    if (!invoice_id) return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })

    // Lazy migrations
    await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS restocking_fee NUMERIC(10,2) NOT NULL DEFAULT 0.0`
    await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS net_refund NUMERIC(10,2) NOT NULL DEFAULT 0.0`
    await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS transaction_reference TEXT DEFAULT ''`
    await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`

    // Fetch invoice
    const invResult = await sql`SELECT * FROM invoices WHERE id = ${invoice_id}`
    const inv = invResult.rows[0]
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    if (inv.status !== 'complete') {
      return NextResponse.json({ error: 'Returns are only allowed on completed invoices' }, { status: 400 })
    }

    const completedAt = inv.completed_at ? new Date(inv.completed_at) : new Date(inv.updated_at)
    const daysSinceComplete = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceComplete > 30) {
      return NextResponse.json({ error: 'Returns are only allowed within 30 days of invoice completion' }, { status: 400 })
    }

    // Calculate totals from line items
    const refund_amount = items.reduce((s: number, i: any) => s + (Number(i.return_total) || 0), 0)
    const restocking_fee = Math.round(refund_amount * 0.20 * 100) / 100
    const net_refund = Math.round((refund_amount - restocking_fee) * 100) / 100

    const id = generateId()
    await sql`
      INSERT INTO returns (id, invoice_id, invoice_number, customer_name, reason, notes, refund_amount, restocking_fee, net_refund, transaction_reference, items, status, created_by)
      VALUES (${id}, ${invoice_id}, ${inv.invoice_number}, ${inv.customer_name}, ${reason}, ${notes}, ${refund_amount}, ${restocking_fee}, ${net_refund}, ${transaction_reference}, ${JSON.stringify(items)}, 'pending', ${authUser.user_id})
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
