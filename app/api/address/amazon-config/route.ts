export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

// Returns the Amazon Location Service API key + region for client-side use (Canada only)
export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS amazon_location_api_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS amazon_location_region TEXT DEFAULT 'us-east-2'`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US'`

    const result = await sql`SELECT country, amazon_location_api_key, amazon_location_region FROM settings WHERE id='company_settings'`
    const row = result.rows[0]

    return NextResponse.json({
      country: row?.country ?? 'US',
      apiKey: row?.amazon_location_api_key ?? '',
      region: row?.amazon_location_region ?? 'us-east-2',
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ country: 'US', apiKey: '', region: 'us-east-2' })
  }
}
