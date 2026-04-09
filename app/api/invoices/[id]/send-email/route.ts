import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'
import { generateInvoicePDF } from '@/lib/pdf'
import { Resend } from 'resend'
import type { Invoice, Settings } from '@/types'

export const runtime = 'nodejs'

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
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_api_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_from_email TEXT DEFAULT ''`
    const settingsResult = await sql`SELECT * FROM settings WHERE id = 'company_settings'`
    const settings = settingsResult.rows[0] || {}

    const invoice = {
      ...inv,
      subtotal: parseFloat(inv.subtotal),
      tax_rate: parseFloat(inv.tax_rate),
      tax_amount: parseFloat(inv.tax_amount),
      discount: parseFloat(inv.discount),
      total: parseFloat(inv.total),
      items: itemsResult.rows.map((i: any) => ({
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
      google_maps_api_key: settings.google_maps_api_key || '',
      geoapify_api_key: settings.geoapify_api_key || '',
      min_floor_price: parseFloat(settings.min_floor_price || '0'),
      country: settings.country || 'US',
      aws_place_index: settings.aws_place_index || '',
      amazon_location_api_key: settings.amazon_location_api_key || '',
      amazon_location_region: settings.amazon_location_region || 'us-east-2',
      resend_api_key: settings.resend_api_key || '',
      resend_from_email: settings.resend_from_email || '',
      payment_gateway: (settings.payment_gateway || 'none') as 'none' | 'stripe' | 'square',
      stripe_secret_key: settings.stripe_secret_key || '',
      stripe_publishable_key: settings.stripe_publishable_key || '',
      square_access_token: settings.square_access_token || '',
      square_location_id: settings.square_location_id || '',
      terms_and_conditions: settings.terms_and_conditions || '',
      restocking_charge_percentage: parseFloat(settings.restocking_charge_percentage || '20'),
      updated_at: settings.updated_at || new Date().toISOString(),
    }

    const resendKey = settingsObj.resend_api_key || process.env.RESEND_API_KEY || ''
    if (!resendKey) {
      return NextResponse.json({ error: 'No Resend API key configured. Add it in Settings → Email (Resend).' }, { status: 400 })
    }

    const pdfBuffer = await generateInvoicePDF(invoice, settingsObj)

    // Use custom from email if set, otherwise fall back to shared Resend domain
    const fromName = settingsObj.company_name || 'FloorHub'
    const fromEmail = settingsObj.resend_from_email || 'delivered@resend.dev'
    const from = `${fromName} <${fromEmail}>`

    const resend = new Resend(resendKey)
    const { data, error: resendError } = await resend.emails.send({
      from,
      to: [inv.customer_email],
      subject: `${inv.is_estimate ? 'Estimate' : 'Invoice'} ${inv.invoice_number}`,
      html: `<p>Please find your ${inv.is_estimate ? 'estimate' : 'invoice'} <strong>${inv.invoice_number}</strong> attached.</p><p>Total: $${parseFloat(inv.total).toFixed(2)}</p>`,
      attachments: [{
        filename: `${inv.invoice_number}.pdf`,
        content: Buffer.from(pdfBuffer).toString('base64'),
      }],
    })

    if (resendError) {
      console.error('Resend error:', JSON.stringify(resendError))
      const msg = (resendError as any).message ?? JSON.stringify(resendError)
      return NextResponse.json({ error: `Email failed: ${msg}` }, { status: 502 })
    }

    console.log('Email sent:', data?.id)
    return NextResponse.json({ message: 'Email sent successfully' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error('send-email error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
