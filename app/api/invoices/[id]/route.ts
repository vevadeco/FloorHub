export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'
import { calculateCommission } from '@/lib/commissions'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    const result = await sql`SELECT * FROM invoices WHERE id = ${params.id}`
    if (!result.rows[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const inv = result.rows[0]
    const itemsResult = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${params.id}`
    return NextResponse.json({
      ...inv,
      subtotal: parseFloat(inv.subtotal),
      tax_rate: parseFloat(inv.tax_rate),
      tax_amount: parseFloat(inv.tax_amount),
      discount: parseFloat(inv.discount),
      total: parseFloat(inv.total),
      items: itemsResult.rows.map((i: any) => ({
        ...i,
        sqft_needed: parseFloat(i.sqft_needed),
        sqft_per_box: parseFloat(i.sqft_per_box),
        unit_price: parseFloat(i.unit_price),
        total_price: parseFloat(i.total_price),
      }))
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    const body = await request.json()
    const {
      status, notes,
      customer_name, customer_email, customer_phone, customer_address,
      subtotal, tax_rate, tax_amount, discount, total,
      job_type, scheduled_date,
      items // optional: full item replacement
    } = body

    const prevResult = await sql`SELECT status, created_at FROM invoices WHERE id = ${params.id}`
    if (!prevResult.rows[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const prevStatus = prevResult.rows[0].status

    // Lazy migration: ensure completed_at, job_type, scheduled_date columns exist
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_type TEXT`
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS scheduled_date DATE`

    // 30-day edit window check (only when editing items/financials, not just status)
    if (items !== undefined) {
      const createdAt = new Date(prevResult.rows[0].created_at)
      const daysDiff = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysDiff > 30) {
        return NextResponse.json({ error: 'Invoices can only be edited within 30 days of creation' }, { status: 403 })
      }
    }

    await sql`
      UPDATE invoices SET
        status = COALESCE(${status ?? null}, status),
        notes = COALESCE(${notes ?? null}, notes),
        customer_name = COALESCE(${customer_name ?? null}, customer_name),
        customer_email = COALESCE(${customer_email ?? null}, customer_email),
        customer_phone = COALESCE(${customer_phone ?? null}, customer_phone),
        customer_address = COALESCE(${customer_address ?? null}, customer_address),
        subtotal = COALESCE(${subtotal ?? null}, subtotal),
        tax_rate = COALESCE(${tax_rate ?? null}, tax_rate),
        tax_amount = COALESCE(${tax_amount ?? null}, tax_amount),
        discount = COALESCE(${discount ?? null}, discount),
        total = COALESCE(${total ?? null}, total),
        updated_at = NOW()
      WHERE id = ${params.id}
    `

    // Update job_type and scheduled_date only when explicitly provided in the request
    if (job_type !== undefined) {
      await sql`UPDATE invoices SET job_type = ${job_type ?? null} WHERE id = ${params.id}`
    }
    if (scheduled_date !== undefined) {
      await sql`UPDATE invoices SET scheduled_date = ${scheduled_date ?? null} WHERE id = ${params.id}`
    }

    // Replace items if provided
    if (items !== undefined) {
      await sql`DELETE FROM invoice_items WHERE invoice_id = ${params.id}`
      for (const item of items) {
        const boxes = Math.ceil(item.sqft_needed / item.sqft_per_box)
        const itemId = generateId()
        await sql`
          INSERT INTO invoice_items (id, invoice_id, product_id, product_name, sqft_needed, sqft_per_box, boxes_needed, unit_price, total_price)
          VALUES (${itemId}, ${params.id}, ${item.product_id}, ${item.product_name}, ${item.sqft_needed}, ${item.sqft_per_box}, ${boxes}, ${item.unit_price}, ${item.total_price})
        `
      }
    }

    // Trigger commission if transitioning to paid
    if (status === 'paid' && prevStatus !== 'paid') {
      await calculateCommission(params.id)
    }

    // Set completed_at when transitioning to complete
    if (status === 'complete' && prevStatus !== 'complete') {
      await sql`UPDATE invoices SET completed_at = NOW() WHERE id = ${params.id}`
    }

    const result = await sql`SELECT * FROM invoices WHERE id = ${params.id}`
    const itemsResult = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${params.id}`
    const inv = result.rows[0]
    return NextResponse.json({
      ...inv,
      subtotal: parseFloat(inv.subtotal),
      tax_rate: parseFloat(inv.tax_rate),
      tax_amount: parseFloat(inv.tax_amount),
      discount: parseFloat(inv.discount),
      total: parseFloat(inv.total),
      items: itemsResult.rows.map((i: any) => ({
        ...i,
        sqft_needed: parseFloat(i.sqft_needed),
        sqft_per_box: parseFloat(i.sqft_per_box),
        unit_price: parseFloat(i.unit_price),
        total_price: parseFloat(i.total_price),
      }))
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)

    // Clean up related records that don't have ON DELETE CASCADE
    await sql`DELETE FROM manual_payments WHERE invoice_id = ${params.id}`
    await sql`DELETE FROM payment_transactions WHERE invoice_id = ${params.id}`
    await sql`DELETE FROM commissions WHERE invoice_id = ${params.id}`

    const result = await sql`DELETE FROM invoices WHERE id = ${params.id}`
    if (result.rowCount === 0) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    return NextResponse.json({ message: 'Invoice deleted' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
