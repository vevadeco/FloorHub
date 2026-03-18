import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(request)
    const body = await request.json()
    const { amount, payment_method = 'cash', reference_number = '', notes = '', date } = body

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const invResult = await sql`SELECT * FROM invoices WHERE id = ${params.id}`
    if (!invResult.rows[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const paymentId = generateId()
    await sql`
      INSERT INTO manual_payments (id, invoice_id, amount, payment_method, reference_number, notes, date, created_by)
      VALUES (${paymentId}, ${params.id}, ${parseFloat(amount)}, ${payment_method}, ${reference_number}, ${notes}, ${date}, ${authUser.user_id})
    `

    // Check if total paid >= invoice total, mark as paid
    const paymentsResult = await sql`SELECT SUM(amount) as total_paid FROM manual_payments WHERE invoice_id = ${params.id}`
    const totalPaid = parseFloat(paymentsResult.rows[0].total_paid || '0')
    const invoiceTotal = parseFloat(invResult.rows[0].total)

    if (totalPaid >= invoiceTotal) {
      await sql`UPDATE invoices SET status = 'paid', updated_at = NOW() WHERE id = ${params.id}`
      const { calculateCommission } = await import('@/lib/commissions')
      await calculateCommission(params.id)
    }

    const result = await sql`SELECT * FROM manual_payments WHERE id = ${paymentId}`
    return NextResponse.json({ ...result.rows[0], amount: parseFloat(result.rows[0].amount) }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    const result = await sql`SELECT * FROM manual_payments WHERE invoice_id = ${params.id} ORDER BY created_at DESC`
    return NextResponse.json(result.rows.map((r: Record<string, unknown>) => ({ ...r, amount: parseFloat(r.amount as string) })))
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    const body = await request.json()
    const { payment_id } = body
    if (!payment_id) return NextResponse.json({ error: 'payment_id is required' }, { status: 400 })

    const result = await sql`DELETE FROM manual_payments WHERE id = ${payment_id} AND invoice_id = ${params.id} RETURNING id`
    if (!result.rows[0]) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    // Recalculate invoice status after deletion
    const paymentsResult = await sql`SELECT SUM(amount) as total_paid FROM manual_payments WHERE invoice_id = ${params.id}`
    const totalPaid = parseFloat(paymentsResult.rows[0].total_paid || '0')
    const invResult = await sql`SELECT total, status FROM invoices WHERE id = ${params.id}`
    if (invResult.rows[0] && invResult.rows[0].status === 'paid') {
      const invoiceTotal = parseFloat(invResult.rows[0].total)
      if (totalPaid < invoiceTotal) {
        await sql`UPDATE invoices SET status = 'sent', updated_at = NOW() WHERE id = ${params.id}`
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
