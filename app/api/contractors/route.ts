import { NextRequest, NextResponse } from 'next/server'
import { sql, generateId } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError, ValidationError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const result = await sql`SELECT * FROM contractors ORDER BY created_at DESC`
    return NextResponse.json(result.rows)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const body = await request.json()
    const { name, company = '', phone, email = '', specialty = '', address = '', notes = '', rating = 5 } = body
    if (!name || !phone) throw new ValidationError('name and phone are required')
    const id = generateId()
    const result = await sql`
      INSERT INTO contractors (id, name, company, phone, email, specialty, address, notes, rating, created_at, updated_at)
      VALUES (${id}, ${name}, ${company}, ${phone}, ${email}, ${specialty}, ${address}, ${notes}, ${rating}, NOW(), NOW())
      RETURNING *`
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
