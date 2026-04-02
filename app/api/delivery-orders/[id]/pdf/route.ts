export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'
import { generateDeliveryPDF } from '@/lib/delivery-pdf'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)

    const doResult = await sql`SELECT * FROM delivery_orders WHERE invoice_id = ${params.id}`
    const doRow = doResult.rows[0]
    if (!doRow) return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 })

    const invResult = await sql`SELECT * FROM invoices WHERE id = ${params.id}`
    const inv = invResult.rows[0]
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const itemsResult = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${params.id}`
    const settingsResult = await sql`SELECT * FROM settings WHERE id = 'company_settings'`
    const settings = settingsResult.rows[0] || {}

    const items = itemsResult.rows.map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      sqft_needed: parseFloat(item.sqft_needed),
      sqft_per_box: parseFloat(item.sqft_per_box),
      boxes_needed: parseInt(item.boxes_needed),
      unit_price: parseFloat(item.unit_price),
      total_price: parseFloat(item.total_price),
    }))

    const orderData = {
      delivery_order_id: doRow.delivery_order_id,
      customer_name: doRow.customer_name,
      customer_address: inv.customer_address || '',
      delivery_date: doRow.delivery_date || '',
      notes: doRow.notes || '',
      items,
    }

    const buffer = await generateDeliveryPDF(orderData, settings)

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${doRow.delivery_order_id}.pdf"`,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[delivery-orders pdf GET]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
