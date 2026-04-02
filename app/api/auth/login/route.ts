import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
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
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Query user — totp_enabled column added via migration, fall back gracefully if not yet present
    let user: Record<string, unknown> | undefined
    try {
      const result = await sql`
        SELECT id, email, name, role, password, commission_rate,
               COALESCE(totp_enabled, false) AS totp_enabled
        FROM users WHERE email = ${email}
      `
      user = result.rows[0]
    } catch {
      // Column may not exist yet on first deploy — retry without it
      const result = await sql`
        SELECT id, email, name, role, password, commission_rate
        FROM users WHERE email = ${email}
      `
      user = result.rows[0] ? { ...result.rows[0], totp_enabled: false } : undefined
    }

    if (!user || !(await bcrypt.compare(password, user.password as string))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Check 2FA — totp_enabled may be false if column was just added
    const totpEnabled = user.totp_enabled === true

    if (totpEnabled) {
      const tempToken = await new SignJWT({ user_id: user.id as string, purpose: '2fa-challenge' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(JWT_SECRET)

      return NextResponse.json({ requires2FA: true, tempToken }, { status: 200 })
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
      }
    })
    setAuthCookie(response, token)
    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
