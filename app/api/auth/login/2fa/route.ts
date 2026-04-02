import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { authenticator } from 'otplib'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db'
import { signToken, setAuthCookie } from '@/lib/auth'
import type { Role } from '@/types'

export const runtime = 'nodejs'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'floorhub-dev-secret-change-in-production'
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tempToken, code } = body

    if (!tempToken) {
      return NextResponse.json({ error: 'tempToken is required' }, { status: 400 })
    }

    // Verify the tempToken
    let payload: { user_id?: string; purpose?: string }
    try {
      const { payload: p } = await jwtVerify(tempToken, JWT_SECRET)
      payload = p as { user_id?: string; purpose?: string }
    } catch {
      return NextResponse.json({ error: 'Challenge expired, please log in again' }, { status: 401 })
    }

    if (payload.purpose !== '2fa-challenge' || !payload.user_id) {
      return NextResponse.json({ error: 'Invalid challenge token' }, { status: 401 })
    }

    const userId = payload.user_id as string

    // Look up user's TOTP secret (only if enabled)
    const totpResult = await sql`
      SELECT secret FROM user_totp WHERE user_id = ${userId} AND enabled = true
    `
    const totpRow = totpResult.rows[0]

    let verified = false

    // Try TOTP verification first
    if (totpRow && code) {
      authenticator.options = { window: 1 }
      verified = authenticator.verify({ token: code, secret: totpRow.secret as string })
    }

    // If TOTP failed, try backup codes
    if (!verified && code) {
      const backupResult = await sql`
        SELECT id, code_hash FROM user_backup_codes
        WHERE user_id = ${userId} AND used = false
      `
      for (const row of backupResult.rows) {
        const match = await bcrypt.compare(code as string, row.code_hash as string)
        if (match) {
          await sql`UPDATE user_backup_codes SET used = true WHERE id = ${row.id}`
          verified = true
          break
        }
      }
    }

    if (!verified) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
    }

    // Look up full user
    const userResult = await sql`
      SELECT id, email, name, role, commission_rate FROM users WHERE id = ${userId}
    `
    const user = userResult.rows[0]

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const token = await signToken({
      user_id: user.id as string,
      email: user.email as string,
      role: user.role as Role,
      name: user.name as string,
    })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        commission_rate: parseFloat(user.commission_rate as string),
      },
    })
    setAuthCookie(response, token)
    return response
  } catch (error) {
    console.error('[login/2fa]', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
