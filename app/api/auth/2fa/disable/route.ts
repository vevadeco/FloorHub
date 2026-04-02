import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    const userId = user.user_id

    // Check if 2FA is actually enabled
    const userResult = await sql`
      SELECT totp_enabled FROM users WHERE id = ${userId}
    `
    const userRow = userResult.rows[0]

    if (!userRow || !userRow.totp_enabled) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 })
    }

    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    // Look up TOTP secret
    const totpResult = await sql`
      SELECT secret FROM user_totp WHERE user_id = ${userId} AND enabled = true
    `
    const totpRow = totpResult.rows[0]

    let verified = false

    // Try TOTP verification first
    if (totpRow) {
      authenticator.options = { window: 1 }
      verified = authenticator.verify({ token: code as string, secret: totpRow.secret as string })
    }

    // If TOTP failed, try backup codes
    if (!verified) {
      const backupResult = await sql`
        SELECT id, code_hash FROM user_backup_codes
        WHERE user_id = ${userId} AND used = false
      `
      for (const row of backupResult.rows) {
        const match = await bcrypt.compare(code as string, row.code_hash as string)
        if (match) {
          verified = true
          break
        }
      }
    }

    if (!verified) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // Disable 2FA: update users, delete totp row, delete backup codes
    await sql`UPDATE users SET totp_enabled = false WHERE id = ${userId}`
    await sql`DELETE FROM user_totp WHERE user_id = ${userId}`
    await sql`DELETE FROM user_backup_codes WHERE user_id = ${userId}`

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const { AuthError } = await import('@/lib/auth')
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('[2fa/disable]', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
