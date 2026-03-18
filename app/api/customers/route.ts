import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const result = await sql`SELECT * FROM customers ORDER BY created_at`
    return NextResponse.json(result.rows)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthUser(request)
    const body = await request.json()
    const { name, email = '', phone = '', address = '', city = '', state = '', zip_code = '', notes = '' } = body
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    const id = generateId()
    await sql`
      INSERT INTO customers (id, name, email, phone, address, city, state, zip_code, notes)
      VALUES (${id}, ${name}, ${email}, ${phone}, ${address}, ${city}, ${state}, ${zip_code}, ${notes})
    `
    const result = await sql`SELECT * FROM customers WHERE id = ${id}`
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
