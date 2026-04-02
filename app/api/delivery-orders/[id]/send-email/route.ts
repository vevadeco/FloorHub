export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'
import { generateDeliveryPDF } from '@/lib/delivery-pdf'
import { Resend } from 'resend'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)

    const body = await request.json()
    const { recipient_email } = body

    if (!recipient_email || !recipient_email.trim()) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
    }

    const settingsResult = await sql`SELECT * FROM settings WHERE id = 'company_settings'`
    const settings = settingsResult.rows[0] || {}

    if (!settings.resend_api_key) {
      return NextResponse.json({ error: 'Resend API key is not configured. Please add it in Settings.' }, { status: 400 })
    }

    const doResult = await sql`SELECT * FROM delivery_orders WHERE invoice_id = ${params.id}`
    const doRow = doResult.rows[0]
    if (!doRow) return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 })

    const invResult = await sql`SELECT * FROM invoices WHERE id = ${params.id}`
    const inv = invResult.rows[0]
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const itemsResult = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${params.id}`
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

    const pdfBuffer = await generateDeliveryPDF(orderData, settings)
    const companyName = settings.company_name || 'FloorHub'
    const fromEmail = settings.resend_from_email || 'onboarding@resend.dev'

    const resend = new Resend(settings.resend_api_key)
    const { error: resendError } = await resend.emails.send({
      from: `${companyName} <${fromEmail}>`,
      to: recipient_email.trim(),
      subject: `Delivery Order ${doRow.delivery_order_id} — ${doRow.customer_name}`,
      html: `
        <h2>Delivery Order — ${doRow.delivery_order_id}</h2>
        <p><strong>Customer:</strong> ${doRow.customer_name}</p>
        <p><strong>Address:</strong> ${inv.customer_address || 'N/A'}</p>
        ${doRow.delivery_date ? `<p><strong>Delivery Date:</strong> ${doRow.delivery_date}</p>` : ''}
        ${doRow.notes ? `<p><strong>Notes:</strong> ${doRow.notes}</p>` : ''}
        <p>Please see the attached delivery order PDF for item details.</p>
        <p style="margin-top:16px">Sent by ${companyName}</p>
      `,
      attachments: [
        {
          filename: `${doRow.delivery_order_id}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    if (resendError) {
      console.error('Resend error:', resendError)
      return NextResponse.json({ error: (resendError as any).message || 'Failed to send email' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[delivery-orders send-email POST]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
