import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

function checkAdminSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret')
  return secret === process.env.ADMIN_SECRET
}

export async function GET(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await sql`SELECT domain, added_at FROM licensed_domains ORDER BY added_at DESC`
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { domain } = body

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }

    const normalized = domain.toLowerCase().trim()
    await sql`INSERT INTO licensed_domains (domain) VALUES (${normalized}) ON CONFLICT (domain) DO NOTHING`
    return NextResponse.json({ domain: normalized }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
