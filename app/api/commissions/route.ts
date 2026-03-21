export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    // Owners see all; employees see only their own
    let result
    if (user.role === 'owner') {
      result = await sql`SELECT * FROM commissions ORDER BY created_at DESC`
    } else {
      result = await sql`SELECT * FROM commissions WHERE employee_id = ${user.user_id} ORDER BY created_at DESC`
    }
    return NextResponse.json(result.rows)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
