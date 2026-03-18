import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db'
import { signToken, setAuthCookie } from '@/lib/auth'
import type { Role } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const result = await sql`
      SELECT id, email, name, role, password, commission_rate
      FROM users WHERE email = ${email}
    `
    const user = result.rows[0]

    if (!user || !(await bcrypt.compare(password, user.password as string))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = await signToken({
      user_id: user.id as string,
      email: user.email as string,
      role: user.role as Role,
      name: user.name as string,
    })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        commission_rate: parseFloat(user.commission_rate as string),
      }
    })
    setAuthCookie(response, token)
    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
