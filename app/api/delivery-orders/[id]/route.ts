export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    const body = await request.json()
    const { delivery_date, notes, status } = body

    // Check if a delivery_orders row already exists for this invoice
    const existing = await sql`SELECT id FROM delivery_orders WHERE invoice_id = ${params.id}`

    if (existing.rows.length > 0) {
      // Just update — no new do_number needed
      const result = await sql`
        UPDATE delivery_orders SET
          delivery_date = ${delivery_date ?? ''},
          notes = ${notes ?? ''},
          status = ${status ?? 'pending'},
          updated_at = NOW()
        WHERE invoice_id = ${params.id}
        RETURNING *
      `
      const inv = await sql`SELECT customer_address FROM invoices WHERE id = ${params.id}`
      return NextResponse.json({ ...result.rows[0], customer_address: inv.rows[0]?.customer_address || '' })
    }

    // First time — get invoice info
    const inv = await sql`SELECT invoice_number, customer_name, customer_address FROM invoices WHERE id = ${params.id}`
    if (!inv.rows[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    // Generate next do_number atomically using a CTE with FOR UPDATE to prevent race conditions
    const newId = generateId()
    const result = await sql`
      WITH seq AS (
        SELECT COALESCE(MAX(do_number), 0) + 1 AS next_num
        FROM delivery_orders
        FOR UPDATE
      )
      INSERT INTO delivery_orders (id, invoice_id, invoice_number, do_number, delivery_order_id, customer_name, delivery_date, notes, status)
      SELECT
        ${newId},
        ${params.id},
        ${inv.rows[0].invoice_number},
        next_num,
        'DO-' || LPAD(next_num::text, 4, '0'),
        ${inv.rows[0].customer_name},
        ${delivery_date ?? ''},
        ${notes ?? ''},
        ${status ?? 'pending'}
      FROM seq
      RETURNING *
    `

    // Stamp job_type on the invoice
    await sql`UPDATE invoices SET job_type = 'delivery' WHERE id = ${params.id}`

    return NextResponse.json({ ...result.rows[0], customer_address: inv.rows[0].customer_address || '' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[delivery-orders PUT]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
