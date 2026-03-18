import { NextRequest, NextResponse } from 'next/server'
import { sql, generateId } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const existing = await sql`SELECT * FROM commissions WHERE id=${params.id}`
    if (existing.rows.length === 0) return NextResponse.json({ error: 'Commission not found' }, { status: 404 })
    const commission = existing.rows[0]
    const today = new Date().toISOString().split('T')[0]

    await sql`UPDATE commissions SET status='paid', date_paid=${today}, updated_at=NOW() WHERE id=${params.id}`

    // Record as expense so it appears in financial reports
    await sql`
      INSERT INTO expenses (id, category, description, amount, payment_method, reference_number, vendor_name, date, created_by, created_at)
      VALUES (${generateId()}, 'employee', ${`Commission payment - ${commission.employee_name} - ${commission.invoice_number}`},
        ${commission.commission_amount}, 'bank_transfer', '', ${commission.employee_name}, ${today}, ${user.user_id}, NOW())`

    const result = await sql`SELECT * FROM commissions WHERE id=${params.id}`
    return NextResponse.json(result.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
