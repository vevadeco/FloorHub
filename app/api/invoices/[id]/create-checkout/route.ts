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

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-02-24.acacia' })

    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Invoice ${inv.invoice_number}` },
          unit_amount: Math.round(parseFloat(inv.total) * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${baseUrl}/invoices/${params.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/invoices/${params.id}?payment=cancelled`,
      customer_email: inv.customer_email || undefined,
      metadata: { invoice_id: params.id },
    })

    // Record transaction
    const txId = generateId()
    await sql`
      INSERT INTO payment_transactions (id, session_id, amount, currency, status, payment_status, invoice_id, customer_email, metadata)
      VALUES (${txId}, ${session.id}, ${parseFloat(inv.total)}, 'usd', 'pending', 'initiated', ${params.id}, ${inv.customer_email || ''}, ${JSON.stringify({ invoice_id: params.id })})
    `

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
