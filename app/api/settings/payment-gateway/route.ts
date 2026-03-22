export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

// Returns only the gateway type — no secret keys exposed
export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'none'`
    const result = await sql`SELECT payment_gateway FROM settings WHERE id = 'company_settings'`
    const gateway = result.rows[0]?.payment_gateway || 'none'
    return NextResponse.json({ payment_gateway: gateway })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ payment_gateway: 'none' })
  }
}
