import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const result = await sql`SELECT COUNT(*) as count FROM users`
    const count = parseInt(result.rows[0].count)
    return NextResponse.json({ setupRequired: count === 0 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
