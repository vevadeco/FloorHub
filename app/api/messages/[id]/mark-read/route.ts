export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, AuthError } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    const existing = await sql`SELECT id FROM messages WHERE id=${params.id}`
    if (existing.rows.length === 0) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    await sql`
      UPDATE messages SET read_by = array_append(read_by, ${user.user_id})
      WHERE id=${params.id} AND NOT (${user.user_id} = ANY(read_by))`
    return NextResponse.json({ message: 'Marked as read' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
