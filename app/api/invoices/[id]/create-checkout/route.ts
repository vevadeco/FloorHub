export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'
import Stripe from 'stripe'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)

    const invResult = await sql`SELECT * FROM invoices WHERE id = ${params.id}`
    if (!invResult.rows[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const inv = invResult.rows[0]

    // Run lazy migrations
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'none'`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS square_access_token TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS square_location_id TEXT DEFAULT ''`

    const settingsResult = await sql`SELECT * FROM settings WHERE id = 'company_settings'`
    const settings = settingsResult.rows[0] || {}

    const gateway = settings.payment_gateway || 'none'
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const amountCents = Math.round(parseFloat(inv.total) * 100)

    if (gateway === 'stripe') {
      const stripeKey = settings.stripe_secret_key || process.env.STRIPE_SECRET_KEY || ''
      if (!stripeKey) {
        return NextResponse.json({ error: 'Stripe secret key not configured. Add it in Settings → Payment Gateway.' }, { status: 400 })
      }

      const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' })
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `Invoice ${inv.invoice_number}` },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${baseUrl}/invoices/${params.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/invoices/${params.id}?payment=cancelled`,
        customer_email: inv.customer_email || undefined,
        metadata: { invoice_id: params.id },
      })

      const txId = generateId()
      await sql`
        INSERT INTO payment_transactions (id, session_id, amount, currency, status, payment_status, invoice_id, customer_email, metadata)
        VALUES (${txId}, ${session.id}, ${parseFloat(inv.total)}, 'usd', 'pending', 'initiated', ${params.id}, ${inv.customer_email || ''}, ${JSON.stringify({ invoice_id: params.id })})
      `

      return NextResponse.json({ url: session.url, session_id: session.id })

    } else if (gateway === 'square') {
      const accessToken = settings.square_access_token || ''
      const locationId = settings.square_location_id || ''
      if (!accessToken || !locationId) {
        return NextResponse.json({ error: 'Square access token and location ID are required. Add them in Settings → Payment Gateway.' }, { status: 400 })
      }

      // Use Square Payment Links API (no SDK needed)
      const squareEnv = accessToken.startsWith('EAAAl') ? 'connect' : 'connect'
      const squareBase = accessToken.startsWith('sandbox') || accessToken.includes('sandbox')
        ? 'https://connect.squareupsandbox.com'
        : 'https://connect.squareup.com'

      const idempotencyKey = generateId()
      const res = await fetch(`${squareBase}/v2/online-checkout/payment-links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-01-18',
        },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          order: {
            location_id: locationId,
            line_items: [{
              name: `Invoice ${inv.invoice_number}`,
              quantity: '1',
              base_price_money: { amount: amountCents, currency: 'USD' },
            }],
          },
          checkout_options: {
            redirect_url: `${baseUrl}/invoices/${params.id}?payment=success`,
          },
          pre_populated_data: inv.customer_email ? { buyer_email: inv.customer_email } : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        const msg = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || 'Square error'
        return NextResponse.json({ error: `Square: ${msg}` }, { status: 502 })
      }

      const paymentLink = data.payment_link?.url
      const txId = generateId()
      await sql`
        INSERT INTO payment_transactions (id, session_id, amount, currency, status, payment_status, invoice_id, customer_email, metadata)
        VALUES (${txId}, ${data.payment_link?.id || idempotencyKey}, ${parseFloat(inv.total)}, 'usd', 'pending', 'initiated', ${params.id}, ${inv.customer_email || ''}, ${JSON.stringify({ invoice_id: params.id, gateway: 'square' })})
      `

      return NextResponse.json({ url: paymentLink })

    } else {
      return NextResponse.json({ error: 'No payment gateway configured. Set one up in Settings → Payment Gateway.' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
