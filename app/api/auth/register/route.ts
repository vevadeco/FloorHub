import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sql, generateId } from '@/lib/db'
import { signToken, setAuthCookie } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, password, country = 'US' } = body

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Email, name, and password are required' }, { status: 400 })
    }

    // Check if users already exist
    const countResult = await sql`SELECT COUNT(*) as count FROM users`
    const userCount = parseInt(countResult.rows[0].count)

    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Owner already registered. Use employee creation instead.' },
        { status: 403 }
      )
    }

    // License check for owner registration.
    // To ENABLE: set LICENSE_SERVER_URL in your environment variables.
    // To DISABLE: leave LICENSE_SERVER_URL unset (or remove it) — the check is skipped entirely.
    const domain = email.split('@').pop()?.toLowerCase()
    if (!domain) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const licenseServerUrl = process.env.LICENSE_SERVER_URL
    if (licenseServerUrl) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const licenseRes = await fetch(`${licenseServerUrl}/api/check-license`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain }),
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!licenseRes.ok) {
          return NextResponse.json(
            { error: 'Please contact your representative.' },
            { status: 403 }
          )
        }

        const licenseData = await licenseRes.json()
        if (!licenseData.licensed) {
          return NextResponse.json(
            { error: 'Please contact your representative.' },
            { status: 403 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'Please contact your representative.' },
          { status: 503 }
        )
      }
    }

    // Check email not already taken
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const userId = generateId()

    await sql`
      INSERT INTO users (id, email, name, role, password, commission_rate)
      VALUES (${userId}, ${email}, ${name}, 'owner', ${hashedPassword}, 0.0)
    `

    // Create initial settings row with country
    try {
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US'`
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS aws_place_index TEXT DEFAULT ''`
      await sql`
        INSERT INTO settings (id, country) VALUES ('company_settings', ${country})
        ON CONFLICT (id) DO UPDATE SET country = ${country}
      `
    } catch { /* non-fatal */ }

    const token = await signToken({ user_id: userId, email, role: 'owner', name })
    const response = NextResponse.json({
      user: { id: userId, email, name, role: 'owner', commission_rate: 0 }
    })
    setAuthCookie(response, token)
    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
