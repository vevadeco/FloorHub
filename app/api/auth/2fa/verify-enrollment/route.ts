import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sql } from '@/lib/db'
import { getAuthUser, AuthError } from '@/lib/auth'

export const runtime = 'nodejs'

function generateBackupCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.randomBytes(10)
  let result = ''
  for (let i = 0; i < 10; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return `${result.slice(0, 5)}-${result.slice(5)}`
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    // Check for a pending (not yet enabled) TOTP row
    const totpResult = await sql`
      SELECT secret, enabled FROM user_totp WHERE user_id = ${authUser.user_id}
    `
    const totpRow = totpResult.rows[0]

    if (!totpRow || totpRow.enabled === true) {
      return NextResponse.json({ error: 'No pending enrollment found' }, { status: 400 })
    }

    // Validate submitted code
    const body = await request.json()
    const { code } = body

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Code must be exactly 6 digits' }, { status: 400 })
    }

    // Verify code with ±1 step tolerance
    authenticator.options = { window: 1 }
    const isValid = authenticator.verify({ token: code, secret: totpRow.secret })

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
    }

    // Activate 2FA
    await sql`
      UPDATE user_totp
      SET enabled = true, updated_at = NOW()
      WHERE user_id = ${authUser.user_id}
    `

    await sql`
      UPDATE users SET totp_enabled = true WHERE id = ${authUser.user_id}
    `

    // Generate 8 backup codes
    const plainCodes: string[] = Array.from({ length: 8 }, generateBackupCode)

    // Delete existing backup codes and insert new hashed ones
    await sql`DELETE FROM user_backup_codes WHERE user_id = ${authUser.user_id}`

    for (const code of plainCodes) {
      const hash = await bcrypt.hash(code, 10)
      await sql`
        INSERT INTO user_backup_codes (user_id, code_hash)
        VALUES (${authUser.user_id}, ${hash})
      `
    }

    return NextResponse.json({ backupCodes: plainCodes })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
