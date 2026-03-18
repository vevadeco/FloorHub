import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain } = body

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }

    const normalized = domain.toLowerCase().trim()
    const result = await sql`SELECT id FROM licensed_domains WHERE domain = ${normalized}`
    return NextResponse.json({ licensed: result.rows.length > 0 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
