export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql, generateId } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError, ValidationError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const result = await sql`SELECT * FROM messages ORDER BY created_at DESC`
    return NextResponse.json(result.rows)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    const body = await request.json()
    const { title, content, priority = 'normal' } = body
    if (!title || !content) throw new ValidationError('title and content are required')

    const creatorResult = await sql`SELECT name FROM users WHERE id=${user.user_id}`
    const creatorName = creatorResult.rows[0]?.name ?? 'Owner'

    const id = generateId()
    const result = await sql`
      INSERT INTO messages (id, title, content, priority, created_by, created_by_name, read_by, created_at)
      VALUES (${id}, ${title}, ${content}, ${priority}, ${user.user_id}, ${creatorName}, '{}', NOW())
      RETURNING *`
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
