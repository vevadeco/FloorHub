export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)

    const { id } = params
    const body = await request.json()
    const { exempt } = body

    if (typeof exempt !== 'boolean') {
      return NextResponse.json({ error: 'exempt must be a boolean' }, { status: 400 })
    }

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_exempt BOOLEAN NOT NULL DEFAULT FALSE`

    const result = await sql`
      UPDATE users SET totp_exempt = ${exempt} WHERE id = ${id}
      RETURNING id, name, totp_exempt
    `

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('[totp-exempt]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
