export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    let user: Record<string, unknown> | undefined
    try {
      const result = await sql`
        SELECT id, email, name, role, commission_rate,
               COALESCE(totp_enabled, false) AS totp_enabled
        FROM users WHERE id = ${authUser.user_id}
      `
      user = result.rows[0]
    } catch {
      const result = await sql`
        SELECT id, email, name, role, commission_rate
        FROM users WHERE id = ${authUser.user_id}
      `
      user = result.rows[0] ? { ...result.rows[0], totp_enabled: false } : undefined
    }
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      commission_rate: parseFloat(user.commission_rate as string),
      totp_enabled: user.totp_enabled ?? false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
