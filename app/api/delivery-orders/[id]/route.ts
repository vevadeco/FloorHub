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

    // Ensure sequence exists for atomic DO number generation
    await sql`CREATE SEQUENCE IF NOT EXISTS delivery_orders_do_number_seq`

    // Check if delivery_orders row already exists for this invoice
    const existing = await sql`SELECT id FROM delivery_orders WHERE invoice_id = ${params.id}`

    if (existing.rows.length > 0) {
      const result = await sql`
        UPDATE delivery_orders SET
          delivery_date = ${delivery_date ?? ''},
          notes = ${notes ?? ''},
          status = ${status ?? 'pending'},
          updated_at = NOW()
        WHERE invoice_id = ${params.id}
        RETURNING *
      `
      const row = result.rows[0]
      const inv = await sql`SELECT customer_address FROM invoices WHERE id = ${params.id}`
      return NextResponse.json({ ...row, customer_address: inv.rows[0]?.customer_address || '' })
    } else {
      const inv = await sql`SELECT invoice_number, customer_name, customer_address FROM invoices WHERE id = ${params.id}`
      if (!inv.rows[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

      // Use nextval for atomic, race-condition-free sequence generation
      const seqResult = await sql`SELECT nextval('delivery_orders_do_number_seq') AS next_num`
      const nextNum = Number(seqResult.rows[0].next_num)
      const deliveryOrderId = `DO-${String(nextNum).padStart(4, '0')}`
      const newId = generateId()

      const result = await sql`
        INSERT INTO delivery_orders (id, invoice_id, invoice_number, do_number, delivery_order_id, customer_name, delivery_date, notes, status)
        VALUES (
          ${newId},
          ${params.id},
          ${inv.rows[0].invoice_number},
          ${nextNum},
          ${deliveryOrderId},
          ${inv.rows[0].customer_name},
          ${delivery_date ?? ''},
          ${notes ?? ''},
          ${status ?? 'pending'}
        )
        ON CONFLICT (invoice_id) DO UPDATE SET
          delivery_date = EXCLUDED.delivery_date,
          notes = EXCLUDED.notes,
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING *
      `
      const row = result.rows[0]
      return NextResponse.json({ ...row, customer_address: inv.rows[0].customer_address || '' })
    }
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[delivery-orders PUT]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
