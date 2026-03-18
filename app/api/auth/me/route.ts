export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    const result = await sql`
      SELECT id, email, name, role, commission_rate
      FROM users WHERE id = ${authUser.user_id}
    `
    const user = result.rows[0]
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      commission_rate: parseFloat(user.commission_rate),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
