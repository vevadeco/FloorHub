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

    return NextResponse.json(invoices.rows.map((r: any) => ({
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
  let step = 'init'
  try {
    step = 'migration'
    try {
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_install_job BOOLEAN NOT NULL DEFAULT FALSE`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS min_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.0`
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS min_floor_price NUMERIC(10,2) NOT NULL DEFAULT 0.0`
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_type TEXT`
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS scheduled_date DATE`
    } catch (migErr) {
      console.error('[invoices POST] migration warning:', migErr)
    }

    step = 'auth'
    const authUser = await getAuthUser(request)

    step = 'parse_body'
    const body = await request.json()
    const {
      customer_id,
      customer_name,
      customer_email = '',
      customer_phone = '',
      customer_address = '',
      items = [],
      subtotal,
      tax_rate = 0,
      tax_amount = 0,
      discount = 0,
      total,
      notes = '',
      status = 'draft',
      is_estimate = false,
      is_install_job = false,
      job_type = null,
      scheduled_date = null,
    } = body

    if (!customer_name || !items.length) {
      return NextResponse.json({ error: 'Customer name and items are required' }, { status: 400 })
    }

    // Derive is_install_job from job_type for backward compatibility
    const effectiveIsInstallJob = job_type === 'installation' ? true : is_install_job

    step = 'min_price_check'
    let globalMinFloorPrice = 0
    try {
      const settingsRow = await sql`SELECT min_floor_price FROM settings WHERE id='company_settings'`
      globalMinFloorPrice = parseFloat(settingsRow.rows[0]?.min_floor_price ?? '0')
    } catch { /* ignore */ }

    for (const item of items) {
      if (item.product_id) {
        try {
          const prod = await sql`SELECT min_selling_price, cost_price FROM products WHERE id = ${item.product_id}`
          const prodMin = parseFloat(prod.rows[0]?.min_selling_price ?? '0')
          const costPrice = parseFloat(prod.rows[0]?.cost_price ?? '0')
          // If product has its own min_selling_price, use it; otherwise cost_price + global margin
          const minPrice = prodMin > 0 ? prodMin : (costPrice + globalMinFloorPrice)
          if (minPrice > 0 && item.unit_price < minPrice) {
            return NextResponse.json({
              error: `Price for "${item.product_name}" cannot be below minimum selling price of $${minPrice.toFixed(2)}/sqft`
            }, { status: 400 })
          }
        } catch {
          // column may not exist yet — skip
        }
      }
    }

        const invoiceId = generateId()
    const invoiceNumber = generateInvoiceNumber(is_estimate)
    const cid = customer_id || generateId()

    step = 'upsert_customer'
    await sql`
      INSERT INTO customers (id, name, email, phone, address)
      VALUES (${cid}, ${customer_name}, ${customer_email}, ${customer_phone}, ${customer_address})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address
    `

    step = 'insert_invoice'
    await sql`
      INSERT INTO invoices (
        id, invoice_number, customer_id, customer_name, customer_email,
        customer_phone, customer_address, subtotal, tax_rate, tax_amount,
        discount, total, notes, status, is_estimate, is_install_job,
        job_type, scheduled_date, created_by
      ) VALUES (
        ${invoiceId}, ${invoiceNumber}, ${cid}, ${customer_name}, ${customer_email},
        ${customer_phone}, ${customer_address}, ${subtotal}, ${tax_rate}, ${tax_amount},
        ${discount}, ${total}, ${notes}, ${status}, ${is_estimate}, ${effectiveIsInstallJob},
        ${job_type}, ${scheduled_date}, ${authUser.user_id}
      )
    `

    step = 'insert_items'
    for (const item of items) {
      const boxes = Math.ceil(item.sqft_needed / item.sqft_per_box)
      const itemId = generateId()
      await sql`
        INSERT INTO invoice_items (
          id, invoice_id, product_id, product_name,
          sqft_needed, sqft_per_box, boxes_needed, unit_price, total_price
        ) VALUES (
          ${itemId}, ${invoiceId}, ${item.product_id}, ${item.product_name},
          ${item.sqft_needed}, ${item.sqft_per_box}, ${boxes}, ${item.unit_price}, ${item.total_price}
        )
      `
    }

    step = 'commission'
    if (status === 'paid') {
      const { calculateCommission } = await import('@/lib/commissions')
      await calculateCommission(invoiceId)
    }

    step = 'fetch_result'
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
      items: itemsResult.rows.map((i: any) => ({
        ...i,
        sqft_needed: parseFloat(i.sqft_needed),
        sqft_per_box: parseFloat(i.sqft_per_box),
        unit_price: parseFloat(i.unit_price),
        total_price: parseFloat(i.total_price),
      })),
    }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[invoices POST] failed at step="${step}":`, msg)
    return NextResponse.json({ error: `[${step}] ${msg}` }, { status: 500 })
  }
}
