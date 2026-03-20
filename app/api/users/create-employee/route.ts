export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { sql, generateId } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError, ValidationError } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const body = await request.json()
    const { name, email, password } = body
    if (!name || !email || !password) throw new ValidationError('name, email, and password are required')
    if (password.length < 6) throw new ValidationError('Password must be at least 6 characters')

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing.rows.length > 0) throw new ValidationError('Email already registered')

    const hashed = await bcrypt.hash(password, 10)
    const id = generateId()
    const result = await sql`
      INSERT INTO users (id, email, name, role, password, commission_rate, created_at)
      VALUES (${id}, ${email}, ${name}, 'employee', ${hashed}, 0.0, NOW())
      RETURNING id, email, name, role, commission_rate, created_at`
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
