export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

function generateInvoiceNumber(): string {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `INV-${yyyymm}-${seq}`
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(request)
    const estResult = await sql`SELECT * FROM invoices WHERE id = ${params.id}`
    const estimate = estResult.rows[0]
    if (!estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    if (!estimate.is_estimate) return NextResponse.json({ error: 'Invoice is not an estimate' }, { status: 400 })

    const newId = generateId()
    const invoiceNumber = generateInvoiceNumber()

    await sql`
      INSERT INTO invoices (id, invoice_number, customer_id, customer_name, customer_email, customer_phone, customer_address, subtotal, tax_rate, tax_amount, discount, total, notes, status, is_estimate, created_by)
      VALUES (${newId}, ${invoiceNumber}, ${estimate.customer_id}, ${estimate.customer_name}, ${estimate.customer_email}, ${estimate.customer_phone}, ${estimate.customer_address}, ${estimate.subtotal}, ${estimate.tax_rate}, ${estimate.tax_amount}, ${estimate.discount}, ${estimate.total}, ${estimate.notes}, 'draft', false, ${authUser.user_id})
    `

    // Copy items
    const itemsResult = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${params.id}`
    for (const item of itemsResult.rows) {
      const itemId = generateId()
      await sql`
        INSERT INTO invoice_items (id, invoice_id, product_id, product_name, sqft_needed, sqft_per_box, boxes_needed, unit_price, total_price)
        VALUES (${itemId}, ${newId}, ${item.product_id}, ${item.product_name}, ${item.sqft_needed}, ${item.sqft_per_box}, ${item.boxes_needed}, ${item.unit_price}, ${item.total_price})
      `
    }

    const result = await sql`SELECT * FROM invoices WHERE id = ${newId}`
    const inv = result.rows[0]
    return NextResponse.json({
      ...inv,
      subtotal: parseFloat(inv.subtotal),
      tax_rate: parseFloat(inv.tax_rate),
      tax_amount: parseFloat(inv.tax_amount),
      discount: parseFloat(inv.discount),
      total: parseFloat(inv.total),
    }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
