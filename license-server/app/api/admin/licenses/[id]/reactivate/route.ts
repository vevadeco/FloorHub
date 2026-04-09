import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { checkAdminAuth } from '@/lib/admin-auth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = params
    const result = await sql`
      UPDATE licenses SET status = 'active', updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
