export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(request)
    const body = await request.json()
    const { amount } = body

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    // Look up the invoice
    const invResult = await sql`SELECT * FROM invoices WHERE id = ${params.id}`
    const invoice = invResult.rows[0]
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Look up the customer
    const custResult = await sql`SELECT * FROM customers WHERE id = ${invoice.customer_id}`
    const customer = custResult.rows[0]
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const creditBalance = parseFloat(customer.store_credit_balance) || 0
    if (amount > creditBalance) {
      return NextResponse.json({ error: 'Amount exceeds customer store credit balance' }, { status: 400 })
    }

    // Calculate outstanding balance: invoice.total - manual_payments - paid payment_transactions
    const invoiceTotal = parseFloat(invoice.total)

    const manualResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total FROM manual_payments WHERE invoice_id = ${params.id}
    `
    const manualPaid = parseFloat(manualResult.rows[0].total) || 0

    const txResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total FROM payment_transactions WHERE invoice_id = ${params.id} AND payment_status = 'paid'
    `
    const txPaid = parseFloat(txResult.rows[0].total) || 0

    const outstanding = Math.round((invoiceTotal - manualPaid - txPaid) * 100) / 100

    if (outstanding <= 0) {
      return NextResponse.json({ error: 'Invoice is already fully paid' }, { status: 400 })
    }

    if (amount > outstanding) {
      return NextResponse.json({ error: 'Amount exceeds invoice outstanding balance' }, { status: 400 })
    }

    // Create a debit store_credit_ledger entry referencing the invoice
    const ledgerId = generateId()
    await sql`
      INSERT INTO store_credit_ledger (id, customer_id, transaction_type, amount, reference_type, reference_id, description, created_at)
      VALUES (${ledgerId}, ${customer.id}, 'debit', ${amount}, 'invoice', ${params.id}, ${`Store credit applied to invoice ${invoice.invoice_number}`}, NOW())
    `

    // Decrease the customer's store_credit_balance
    await sql`
      UPDATE customers SET store_credit_balance = store_credit_balance - ${amount} WHERE id = ${customer.id}
    `

    // Record a manual payment entry for the applied amount
    const paymentId = generateId()
    const today = new Date().toISOString().split('T')[0]
    await sql`
      INSERT INTO manual_payments (id, invoice_id, amount, payment_method, reference_number, notes, date, created_by)
      VALUES (${paymentId}, ${params.id}, ${amount}, 'store_credit', ${ledgerId}, 'Store credit applied', ${today}, ${authUser.user_id})
    `

    // Check if total payments now cover the invoice total
    const newManualResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total FROM manual_payments WHERE invoice_id = ${params.id}
    `
    const newManualPaid = parseFloat(newManualResult.rows[0].total) || 0
    const totalPaid = newManualPaid + txPaid

    if (totalPaid >= invoiceTotal) {
      await sql`UPDATE invoices SET status = 'paid', updated_at = NOW() WHERE id = ${params.id}`
      const { calculateCommission } = await import('@/lib/commissions')
      await calculateCommission(params.id)
    }

    return NextResponse.json({
      success: true,
      amount,
      ledger_id: ledgerId,
      payment_id: paymentId,
      remaining_balance: Math.round((creditBalance - amount) * 100) / 100,
      invoice_paid: totalPaid >= invoiceTotal,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
