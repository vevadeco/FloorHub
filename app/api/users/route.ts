import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const result = await sql`SELECT id, email, name, role, commission_rate, created_at FROM users ORDER BY created_at`
    return NextResponse.json(result.rows)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
