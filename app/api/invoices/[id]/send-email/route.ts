import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'
import { generateInvoicePDF } from '@/lib/pdf'
import { Resend } from 'resend'
import type { Invoice, Settings } from '@/types'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)

    const invResult = await sql`SELECT * FROM invoices WHERE id = ${params.id}`
    if (!invResult.rows[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const inv = invResult.rows[0]

    if (!inv.customer_email) {
      return NextResponse.json({ error: 'Customer email is required to send invoice.' }, { status: 400 })
    }

    const itemsResult = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${params.id}`
    const settingsResult = await sql`SELECT * FROM settings WHERE id = 'company_settings'`
    const settings = settingsResult.rows[0] || {}

    const invoice = {
      ...inv,
      subtotal: parseFloat(inv.subtotal),
      tax_rate: parseFloat(inv.tax_rate),
      tax_amount: parseFloat(inv.tax_amount),
      discount: parseFloat(inv.discount),
      total: parseFloat(inv.total),
      items: itemsResult.rows.map(i => ({
        id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        boxes_needed: i.boxes_needed,
        cost_price: i.cost_price ? parseFloat(i.cost_price) : undefined,
        sqft_needed: parseFloat(i.sqft_needed),
        sqft_per_box: parseFloat(i.sqft_per_box),
        unit_price: parseFloat(i.unit_price),
        total_price: parseFloat(i.total_price),
      }))
    } as Invoice

    const settingsObj: Settings = {
      id: settings.id || 'company_settings',
      company_name: settings.company_name || '',
      company_address: settings.company_address || '',
      company_phone: settings.company_phone || '',
      company_email: settings.company_email || '',
      tax_rate: parseFloat(settings.tax_rate || '0'),
      facebook_api_token: settings.facebook_api_token || '',
      facebook_page_id: settings.facebook_page_id || '',
      logo_url: settings.logo_url || '',
      updated_at: settings.updated_at || new Date().toISOString(),
    }

    const pdfBuffer = await generateInvoicePDF(invoice, settingsObj)

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: resendError } = await resend.emails.send({
      from: `${settingsObj.company_name || 'FloorHub'} <onboarding@resend.dev>`,
      to: inv.customer_email,
      subject: `${inv.is_estimate ? 'Estimate' : 'Invoice'} ${inv.invoice_number}`,
      html: `<p>Please find your ${inv.is_estimate ? 'estimate' : 'invoice'} ${inv.invoice_number} attached.</p><p>Total: $${parseFloat(inv.total).toFixed(2)}</p>`,
      attachments: [{
        filename: `${inv.invoice_number}.pdf`,
        content: Buffer.from(pdfBuffer).toString('base64'),
      }],
    })

    if (resendError) {
      console.error('Resend error:', resendError)
      return NextResponse.json({ error: 'Failed to send email.' }, { status: 502 })
    }

    return NextResponse.json({ message: 'Email sent successfully' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
