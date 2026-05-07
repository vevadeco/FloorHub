export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)

    const { id } = params

    // Check user exists
    const userResult = await sql`SELECT id, name, totp_enabled FROM users WHERE id = ${id}`
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Reset 2FA: disable flag, delete TOTP secret, delete backup codes
    await sql`UPDATE users SET totp_enabled = false WHERE id = ${id}`
    await sql`DELETE FROM user_totp WHERE user_id = ${id}`
    await sql`DELETE FROM user_backup_codes WHERE user_id = ${id}`

    return NextResponse.json({ success: true, message: `2FA reset for ${userResult.rows[0].name}` })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('[reset-2fa]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
