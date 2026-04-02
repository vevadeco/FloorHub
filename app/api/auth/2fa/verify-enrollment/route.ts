import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { jwtVerify } from 'jose'
import { sql } from '@/lib/db'
import { getAuthUser, AuthError } from '@/lib/auth'

export const runtime = 'nodejs'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'floorhub-dev-secret-change-in-production'
)

async function resolveUserId(request: NextRequest, body: Record<string, unknown>): Promise<string> {
  try {
    const authUser = await getAuthUser(request)
    return authUser.user_id
  } catch {
    // fall through to setupToken
  }
  const { setupToken } = body as { setupToken?: string }
  if (!setupToken) throw new AuthError('Authentication required')
  try {
    const { payload } = await jwtVerify(setupToken, JWT_SECRET)
    const p = payload as { user_id?: string; purpose?: string }
    if (p.purpose !== '2fa-setup' || !p.user_id) throw new AuthError('Invalid setup token')
    return p.user_id
  } catch (e) {
    if (e instanceof AuthError) throw e
    throw new AuthError('Setup token expired, please log in again')
  }
}

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
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const userId = await resolveUserId(request, body)
    const { code } = body as { code?: string }

    // Check for a pending (not yet enabled) TOTP row
    const totpResult = await sql`
      SELECT secret, enabled FROM user_totp WHERE user_id = ${userId}
    `
    const totpRow = totpResult.rows[0]

    if (!totpRow || totpRow.enabled === true) {
      return NextResponse.json({ error: 'No pending enrollment found' }, { status: 400 })
    }

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Code must be exactly 6 digits' }, { status: 400 })
    }

    // Verify code with ±1 step tolerance
    authenticator.options = { window: 1 }
    const isValid = authenticator.verify({ token: code, secret: totpRow.secret as string })

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
    }

    // Activate 2FA
    await sql`UPDATE user_totp SET enabled = true, updated_at = NOW() WHERE user_id = ${userId}`
    await sql`UPDATE users SET totp_enabled = true WHERE id = ${userId}`

    // Generate 8 backup codes
    const plainCodes: string[] = Array.from({ length: 8 }, generateBackupCode)
    await sql`DELETE FROM user_backup_codes WHERE user_id = ${userId}`
    for (const c of plainCodes) {
      const hash = await bcrypt.hash(c, 10)
      await sql`INSERT INTO user_backup_codes (user_id, code_hash) VALUES (${userId}, ${hash})`
    }

    // If this was a forced setup flow, issue the full session token now
    const { setupToken } = body as { setupToken?: string }
    if (setupToken) {
      const { signToken, setAuthCookie } = await import('@/lib/auth')
      const userResult = await sql`SELECT id, email, name, role FROM users WHERE id = ${userId}`
      const u = userResult.rows[0]
      if (u) {
        const token = await signToken({
          user_id: u.id as string,
          email: u.email as string,
          role: u.role as string,
          name: u.name as string,
        } as Parameters<typeof signToken>[0])
        const response = NextResponse.json({ backupCodes: plainCodes, sessionIssued: true })
        setAuthCookie(response, token)
        return response
      }
    }

    return NextResponse.json({ backupCodes: plainCodes })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('[2fa/verify-enrollment]', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
