export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

function generateInvoiceNumber(isEstimate: boolean): string {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `${isEstimate ? 'EST' : 'INV'}-${yyyymm}-${seq}`
}

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const { searchParams } = new URL(request.url)
    const isEstimate = searchParams.get('is_estimate')

    let invoices
    if (isEstimate === 'true') {
      invoices = await sql`
        SELECT i.*, u.name as created_by_name
        FROM invoices i LEFT JOIN users u ON i.created_by = u.id
        WHERE i.is_estimate = true ORDER BY i.created_at DESC`
    } else if (isEstimate === 'false') {
      invoices = await sql`
        SELECT i.*, u.name as created_by_name
        FROM invoices i LEFT JOIN users u ON i.created_by = u.id
        WHERE i.is_estimate = false ORDER BY i.created_at DESC`
    } else {
      invoices = await sql`
        SELECT i.*, u.name as created_by_name
        FROM invoices i LEFT JOIN users u ON i.created_by = u.id
        ORDER BY i.created_at DESC`
    }

    return NextResponse.json(invoices.rows.map(r => ({
      ...r,
      subtotal: parseFloat(r.subtotal),
      tax_rate: parseFloat(r.tax_rate),
      tax_amount: parseFloat(r.tax_amount),
      discount: parseFloat(r.discount),
      total: parseFloat(r.total),
    })))
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    const body = await request.json()
    const {
      customer_id, customer_name, customer_email = '', customer_phone = '', customer_address = '',
      items = [], subtotal, tax_rate = 0, tax_amount = 0, discount = 0, total,
      notes = '', status = 'draft', is_estimate = false
    } = body

    if (!customer_name || !items.length) {
      return NextResponse.json({ error: 'Customer name and items are required' }, { status: 400 })
    }

    const invoiceId = generateId()
    const invoiceNumber = generateInvoiceNumber(is_estimate)
    const cid = customer_id || generateId()

    // Upsert customer
    await sql`
      INSERT INTO customers (id, name, email, phone, address)
      VALUES (${cid}, ${customer_name}, ${customer_email}, ${customer_phone}, ${customer_address})
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone, address=EXCLUDED.address
    `

    await sql`
      INSERT INTO invoices (id, invoice_number, customer_id, customer_name, customer_email, customer_phone, customer_address, subtotal, tax_rate, tax_amount, discount, total, notes, status, is_estimate, created_by)
      VALUES (${invoiceId}, ${invoiceNumber}, ${cid}, ${customer_name}, ${customer_email}, ${customer_phone}, ${customer_address}, ${subtotal}, ${tax_rate}, ${tax_amount}, ${discount}, ${total}, ${notes}, ${status}, ${is_estimate}, ${authUser.user_id})
    `

    // Insert items
    for (const item of items) {
      const boxes = Math.ceil(item.sqft_needed / item.sqft_per_box)
      const itemId = generateId()
      await sql`
        INSERT INTO invoice_items (id, invoice_id, product_id, product_name, sqft_needed, sqft_per_box, boxes_needed, unit_price, total_price)
        VALUES (${itemId}, ${invoiceId}, ${item.product_id}, ${item.product_name}, ${item.sqft_needed}, ${item.sqft_per_box}, ${boxes}, ${item.unit_price}, ${item.total_price})
      `
    }

    // Trigger commission if paid
    if (status === 'paid') {
      const { calculateCommission } = await import('@/lib/commissions')
      await calculateCommission(invoiceId)
    }

    const result = await sql`SELECT * FROM invoices WHERE id = ${invoiceId}`
    const itemsResult = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${invoiceId}`
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
    }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
