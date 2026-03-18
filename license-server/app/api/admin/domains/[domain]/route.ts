import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

function checkAdminSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret')
  return secret === process.env.ADMIN_SECRET
}

export async function DELETE(request: NextRequest, { params }: { params: { domain: string } }) {
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const domain = decodeURIComponent(params.domain).toLowerCase().trim()
    const result = await sql`DELETE FROM licensed_domains WHERE domain = ${domain} RETURNING domain`
    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    }
    return NextResponse.json({ domain: result.rows[0].domain })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
