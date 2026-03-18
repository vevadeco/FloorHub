import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    const body = await request.json()
    const { current_password, new_password } = body

    if (!current_password || !new_password) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 })
    }

    const result = await sql`SELECT password FROM users WHERE id = ${authUser.user_id}`
    const user = result.rows[0]
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const valid = await bcrypt.compare(current_password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const hashed = await bcrypt.hash(new_password, 10)
    await sql`UPDATE users SET password = ${hashed} WHERE id = ${authUser.user_id}`

    return NextResponse.json({ message: 'Password updated successfully' })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
