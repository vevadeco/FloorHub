import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { jwtVerify } from 'jose'
import { sql } from '@/lib/db'
import { getAuthUser, AuthError } from '@/lib/auth'

export const runtime = 'nodejs'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'floorhub-dev-secret-change-in-production'
)

// Resolve user from either a session cookie or a setupToken body param
async function resolveUser(request: NextRequest): Promise<{ user_id: string; email: string }> {
  // Try session cookie first
  try {
    const authUser = await getAuthUser(request)
    return authUser
  } catch {
    // Fall through to setupToken
  }
  // Try setupToken from body
  const body = await request.json().catch(() => ({}))
  const { setupToken } = body as { setupToken?: string }
  if (!setupToken) throw new AuthError('Authentication required')
  try {
    const { payload } = await jwtVerify(setupToken, JWT_SECRET)
    const p = payload as { user_id?: string; purpose?: string; email?: string }
    if (p.purpose !== '2fa-setup' || !p.user_id) throw new AuthError('Invalid setup token')
    // Look up email if not in token
    const result = await sql`SELECT email FROM users WHERE id = ${p.user_id}`
    const email = (result.rows[0]?.email as string) ?? ''
    return { user_id: p.user_id, email }
  } catch (e) {
    if (e instanceof AuthError) throw e
    throw new AuthError('Setup token expired, please log in again')
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await resolveUser(request)

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
