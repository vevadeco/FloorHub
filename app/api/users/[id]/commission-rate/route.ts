export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError, ValidationError } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const body = await request.json()
    const { commission_rate } = body
    if (commission_rate === undefined || commission_rate < 0 || commission_rate > 100) {
      throw new ValidationError('commission_rate must be between 0 and 100')
    }
    const result = await sql`
      UPDATE users SET commission_rate=${commission_rate} WHERE id=${params.id}
      RETURNING id, email, name, role, commission_rate, created_at`
    if (result.rows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
