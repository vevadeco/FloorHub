export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const existing = await sql`SELECT id FROM commissions WHERE id=${params.id}`
    if (existing.rows.length === 0) return NextResponse.json({ error: 'Commission not found' }, { status: 404 })
    await sql`UPDATE commissions SET status='unpaid', date_paid=NULL, updated_at=NOW() WHERE id=${params.id}`
    const result = await sql`SELECT * FROM commissions WHERE id=${params.id}`
    return NextResponse.json(result.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
