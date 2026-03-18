export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql, generateId } from '@/lib/db'
import { getAuthUser, AuthError, ValidationError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const result = category
      ? await sql`SELECT * FROM expenses WHERE category = ${category} ORDER BY created_at DESC`
      : await sql`SELECT * FROM expenses ORDER BY created_at DESC`
    return NextResponse.json(result.rows)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    const body = await request.json()
    const { category, description, amount, payment_method = 'cash', reference_number = '', vendor_name = '', date } = body
    if (!category || !description || !amount || !date) throw new ValidationError('category, description, amount, and date are required')
    const id = generateId()
    const result = await sql`
      INSERT INTO expenses (id, category, description, amount, payment_method, reference_number, vendor_name, date, created_by, created_at)
      VALUES (${id}, ${category}, ${description}, ${amount}, ${payment_method}, ${reference_number}, ${vendor_name}, ${date}, ${user.user_id}, NOW())
      RETURNING *`
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
