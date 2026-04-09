import { NextRequest, NextResponse } from 'next/server'
import { sql, generateLicenseKey } from '@/lib/db'
import { checkAdminAuth } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sql`SELECT * FROM licenses ORDER BY created_at DESC`
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { domain, expires_at, grace_period_days, notes } = body

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }

    const normalized = domain.toLowerCase().trim()
    const licenseKey = generateLicenseKey()
    const graceDays = grace_period_days ?? 7

    const result = await sql`
      INSERT INTO licenses (domain, license_key, expires_at, grace_period_days, notes)
      VALUES (${normalized}, ${licenseKey}, ${expires_at ?? null}, ${graceDays}, ${notes ?? null})
      RETURNING *
    `

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes('duplicate key')) {
      return NextResponse.json({ error: 'Domain already licensed' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
