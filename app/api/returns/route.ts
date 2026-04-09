export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'
import { calculateRestockingFee } from '@/lib/store-credit'
import type { RefundMethod } from '@/types'

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
      waive_restocking = false,
      refund_method = 'original_payment' as RefundMethod,
    } = body

    if (!invoice_id) return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })

    // Validate refund_method
    if (refund_method !== 'original_payment' && refund_method !== 'store_credit') {
      return NextResponse.json({ error: 'refund_method must be "original_payment" or "store_credit"' }, { status: 400 })
    }

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

    // Read restocking_charge_percentage from settings
    const settingsResult = await sql`SELECT restocking_charge_percentage FROM settings LIMIT 1`
    const restockingPercentage = settingsResult.rows[0]
      ? Number(settingsResult.rows[0].restocking_charge_percentage)
      : 20

    // Calculate totals from line items using the configurable percentage and waiver
    const refund_amount = items.reduce((s: number, i: any) => s + (Number(i.return_total) || 0), 0)
    const { restockingFee: restocking_fee, netRefund: net_refund } = calculateRestockingFee(
      refund_amount,
      restockingPercentage,
      Boolean(waive_restocking)
    )

    const id = generateId()
    await sql`
      INSERT INTO returns (id, invoice_id, invoice_number, customer_name, reason, notes, refund_amount, restocking_fee, net_refund, transaction_reference, items, status, created_by, refund_method, waive_restocking)
      VALUES (${id}, ${invoice_id}, ${inv.invoice_number}, ${inv.customer_name}, ${reason}, ${notes}, ${refund_amount}, ${restocking_fee}, ${net_refund}, ${transaction_reference}, ${JSON.stringify(items)}, 'pending', ${authUser.user_id}, ${refund_method}, ${Boolean(waive_restocking)})
    `

    // If refund_method is "store_credit", create a ledger entry and update customer balance
    if (refund_method === 'store_credit') {
      const customerId = inv.customer_id
      if (!customerId) {
        return NextResponse.json({ error: 'Invoice has no associated customer for store credit' }, { status: 400 })
      }

      const ledgerId = generateId()
      const description = `Store credit from return ${id}`

      // Create store_credit_ledger entry (type: credit)
      await sql`
        INSERT INTO store_credit_ledger (id, customer_id, transaction_type, amount, reference_type, reference_id, description)
        VALUES (${ledgerId}, ${customerId}, 'credit', ${net_refund}, 'return', ${id}, ${description})
      `

      // Increase customer's store_credit_balance
      await sql`
        UPDATE customers
        SET store_credit_balance = store_credit_balance + ${net_refund}
        WHERE id = ${customerId}
      `
    }

    const result = await sql`SELECT * FROM returns WHERE id = ${id}`
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[returns POST]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
