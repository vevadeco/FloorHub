import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'
import Stripe from 'stripe'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (sessionId) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-12-18.acacia' })
      const session = await stripe.checkout.sessions.retrieve(sessionId)

      if (session.payment_status === 'paid') {
        // Update invoice status
        await sql`UPDATE invoices SET status = 'paid', updated_at = NOW() WHERE id = ${params.id}`
        // Update transaction
        await sql`UPDATE payment_transactions SET status = 'paid', payment_status = 'paid' WHERE session_id = ${sessionId}`
      }

      return NextResponse.json({
        payment_status: session.payment_status,
        status: session.status,
      })
    }

    // Return invoice payment status
    const invResult = await sql`SELECT status FROM invoices WHERE id = ${params.id}`
    if (!invResult.rows[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    return NextResponse.json({ payment_status: invResult.rows[0].status })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
