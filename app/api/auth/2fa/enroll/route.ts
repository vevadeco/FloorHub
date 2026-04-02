import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { sql } from '@/lib/db'
import { getAuthUser, AuthError } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    // Check if 2FA is already enabled — defensive fallback if column not yet migrated
    let totpEnabled = false
    try {
      const userResult = await sql`
        SELECT COALESCE(totp_enabled, false) AS totp_enabled FROM users WHERE id = ${authUser.user_id}
      `
      totpEnabled = userResult.rows[0]?.totp_enabled === true
    } catch {
      totpEnabled = false
    }
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
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
