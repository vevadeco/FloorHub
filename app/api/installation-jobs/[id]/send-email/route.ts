export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'
import { Resend } from 'resend'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)

    // params.id is the invoice_id
    const jobResult = await sql`SELECT * FROM installation_jobs WHERE invoice_id = ${params.id}`
    const job = jobResult.rows[0]
    if (!job) return NextResponse.json({ error: 'Installation job not found' }, { status: 404 })
    if (!job.contractor_email) return NextResponse.json({ error: 'Contractor email is required' }, { status: 400 })

    const invResult = await sql`SELECT * FROM invoices WHERE id = ${params.id}`
    const inv = invResult.rows[0]
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const itemsResult = await sql`
      SELECT * FROM invoice_items WHERE invoice_id = ${params.id} AND LOWER(product_name) LIKE '%install%'
    `
    const settingsResult = await sql`SELECT * FROM settings WHERE id = 'company_settings'`
    const settings = settingsResult.rows[0] || {}
    const companyName = settings.company_name || 'FloorHub'

    const installItems = itemsResult.rows.map((i: any) =>
      `<tr><td style="padding:4px 8px">${i.product_name}</td><td style="padding:4px 8px">${parseFloat(i.sqft_needed).toFixed(2)} sqft</td><td style="padding:4px 8px">$${parseFloat(i.unit_price).toFixed(2)}/sqft</td></tr>`
    ).join('')

    const html = `
      <h2>Work Order — ${inv.invoice_number}</h2>
      <p><strong>Customer:</strong> ${inv.customer_name}</p>
      <p><strong>Address:</strong> ${inv.customer_address || 'N/A'}</p>
      <p><strong>Phone:</strong> ${inv.customer_phone || 'N/A'}</p>
      <p><strong>Install Date:</strong> ${job.install_date || 'TBD'}</p>
      <p><strong>Contractor:</strong> ${job.contractor_name}</p>
      ${job.notes ? `<p><strong>Notes:</strong> ${job.notes}</p>` : ''}
      <h3>Installation Items</h3>
      <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <thead><tr><th style="padding:4px 8px">Item</th><th style="padding:4px 8px">Sq Ft</th><th style="padding:4px 8px">Rate</th></tr></thead>
        <tbody>${installItems}</tbody>
      </table>
      <p style="margin-top:16px">Sent by ${companyName}</p>
    `

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: resendError } = await resend.emails.send({
      from: `${companyName} <onboarding@resend.dev>`,
      to: job.contractor_email,
      subject: `Work Order — ${inv.invoice_number} (${inv.customer_name})`,
      html,
    })

    if (resendError) {
      console.error('Resend error:', resendError)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
    }

    return NextResponse.json({ message: 'Work order sent successfully' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
