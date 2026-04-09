import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { checkAdminAuth } from '@/lib/admin-auth'

const VALID_STATUSES = ['active', 'suspended', 'expired']

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = params
    const body = await request.json()
    const { expires_at, grace_period_days, status, notes } = body

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Check if license exists
    const existing = await sql`SELECT * FROM licenses WHERE id = ${id}`
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    const current = existing.rows[0]

    const result = await sql`
      UPDATE licenses SET
        expires_at = ${expires_at !== undefined ? expires_at : current.expires_at},
        grace_period_days = ${grace_period_days !== undefined ? grace_period_days : current.grace_period_days},
        status = ${status !== undefined ? status : current.status},
        notes = ${notes !== undefined ? notes : current.notes},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = params
    const result = await sql`DELETE FROM licenses WHERE id = ${id} RETURNING *`

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
