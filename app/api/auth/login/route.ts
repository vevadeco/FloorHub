import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { sql } from '@/lib/db'
import { signToken, setAuthCookie } from '@/lib/auth'
import { checkLicense } from '@/lib/license'
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

    // Check if org requires 2FA but user hasn't set it up yet
    try {
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN NOT NULL DEFAULT FALSE`
      const settingsResult = await sql`SELECT require_2fa FROM settings WHERE id = 'company_settings'`
      const require2fa = settingsResult.rows[0]?.require_2fa === true
      if (require2fa) {
        const setupToken = await new SignJWT({ user_id: user.id as string, purpose: '2fa-setup' })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('10m')
          .sign(JWT_SECRET)
        return NextResponse.json({ requires2FASetup: true, setupToken }, { status: 200 })
      }
    } catch {
      // settings column not yet migrated — skip enforcement
    }

    // License check — skip entirely if LICENSE_SERVER_URL is not set
    let licenseResult: Awaited<ReturnType<typeof checkLicense>> | null = null
    if (process.env.LICENSE_SERVER_URL) {
      const domain = (user.email as string).split('@').pop()?.toLowerCase() || ''
      const countResult = await sql`SELECT COUNT(*) as count FROM users`
      const activeUserCount = parseInt(countResult.rows[0].count)
      licenseResult = await checkLicense(domain, activeUserCount)

      if (!licenseResult.licensed) {
        return NextResponse.json(
          { error: 'Your license is no longer active. Please contact your representative.' },
          { status: 403 }
        )
      }
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

    // Set license cookies if license check was performed
    if (licenseResult) {
      if (licenseResult.licensed && licenseResult.status === 'grace_period') {
        response.cookies.set('license_status', 'grace_period', { path: '/' })
        response.cookies.set('license_grace', String(licenseResult.days_remaining), { path: '/' })
        response.cookies.set('license_checked_at', new Date().toISOString(), { path: '/' })
      } else if (licenseResult.licensed && licenseResult.status === 'active') {
        response.cookies.set('license_status', 'active', { path: '/' })
        response.cookies.set('license_checked_at', new Date().toISOString(), { path: '/' })
        response.cookies.delete('license_grace')
      }
    }

    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
