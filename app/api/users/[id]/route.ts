import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError, ValidationError } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    if (params.id === user.user_id) throw new ValidationError('Cannot delete your own account')
    const result = await sql`DELETE FROM users WHERE id=${params.id} RETURNING id`
    if (result.rows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json({ message: 'User deleted' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
