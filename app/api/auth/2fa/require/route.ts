import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)

    const body = await request.json()
    const { require_2fa } = body

    if (typeof require_2fa !== 'boolean') {
      return NextResponse.json({ error: 'require_2fa must be a boolean' }, { status: 400 })
    }

    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN NOT NULL DEFAULT FALSE`
    await sql`
      INSERT INTO settings (id, require_2fa, updated_at)
      VALUES ('company_settings', ${require_2fa}, NOW())
      ON CONFLICT (id) DO UPDATE SET require_2fa = ${require_2fa}, updated_at = NOW()
    `

    return NextResponse.json({ require_2fa })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('[2fa/require]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
