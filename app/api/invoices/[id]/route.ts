import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'
import { sql } from '@/lib/db'
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
      items: itemsResult.rows.map(i => ({
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
    const { status, notes, customer_name, customer_email, customer_phone, customer_address, subtotal, tax_rate, tax_amount, discount, total } = body

    // Check previous status to detect paid transition
    const prevResult = await sql`SELECT status FROM invoices WHERE id = ${params.id}`
    if (!prevResult.rows[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const prevStatus = prevResult.rows[0].status

    await sql`
      UPDATE invoices SET
        status = COALESCE(${status}, status),
        notes = COALESCE(${notes}, notes),
        customer_name = COALESCE(${customer_name}, customer_name),
        customer_email = COALESCE(${customer_email}, customer_email),
        customer_phone = COALESCE(${customer_phone}, customer_phone),
        customer_address = COALESCE(${customer_address}, customer_address),
        subtotal = COALESCE(${subtotal}, subtotal),
        tax_rate = COALESCE(${tax_rate}, tax_rate),
        tax_amount = COALESCE(${tax_amount}, tax_amount),
        discount = COALESCE(${discount}, discount),
        total = COALESCE(${total}, total),
        updated_at = NOW()
      WHERE id = ${params.id}
    `

    // Trigger commission if transitioning to paid
    if (status === 'paid' && prevStatus !== 'paid') {
      await calculateCommission(params.id)
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
      items: itemsResult.rows.map(i => ({
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
