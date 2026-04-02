import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { sql } from '@/lib/db'
import { getAuthUser, AuthError } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    // Ensure 2FA tables exist (idempotent — safe to run on every request until migration fires)
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE`
    await sql`
      CREATE TABLE IF NOT EXISTS user_totp (
        user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        secret     TEXT NOT NULL,
        enabled    BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS user_backup_codes (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash  TEXT NOT NULL,
        used       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS user_backup_codes_user_id_idx ON user_backup_codes(user_id)`

    // Check if 2FA is already enabled
    const userResult = await sql`
      SELECT COALESCE(totp_enabled, false) AS totp_enabled FROM users WHERE id = ${authUser.user_id}
    `
    const totpEnabled = userResult.rows[0]?.totp_enabled === true
    if (totpEnabled) {
      return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 })
    }

    // Generate a unique TOTP secret
    const secret = authenticator.generateSecret()

    // Upsert a pending enrollment row (enabled = false)
    await sql`
      INSERT INTO user_totp (user_id, secret, enabled)
      VALUES (${authUser.user_id}, ${secret}, false)
      ON CONFLICT (user_id) DO UPDATE
        SET secret = EXCLUDED.secret,
            enabled = false,
            updated_at = NOW()
    `

    // Generate QR code data URI
    const otpauthUri = `otpauth://totp/FloorHub:${authUser.email}?secret=${secret}&issuer=FloorHub`
    const qrUri = await QRCode.toDataURL(otpauthUri)

    return NextResponse.json({ qrUri, secret })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('[2fa/enroll]', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
