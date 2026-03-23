export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError, ValidationError } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    try { await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_id TEXT DEFAULT ''` } catch { /* ignore */ }
    const body = await request.json()
    const { category, description, amount, payment_method = 'cash', reference_number = '', vendor_name = '', employee_id = '', date } = body
    if (!category || !description || !amount || !date) throw new ValidationError('category, description, amount, and date are required')
    const result = await sql`
      UPDATE expenses SET category=${category}, description=${description}, amount=${amount},
        payment_method=${payment_method}, reference_number=${reference_number},
        vendor_name=${vendor_name}, employee_id=${employee_id}, date=${date}
      WHERE id=${params.id} RETURNING *`
    if (result.rows.length === 0) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const result = await sql`DELETE FROM expenses WHERE id=${params.id} RETURNING id`
    if (result.rows.length === 0) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    return NextResponse.json({ message: 'Expense deleted' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
