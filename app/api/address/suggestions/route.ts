export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') ?? ''
    if (query.length < 3) return NextResponse.json([])

    // Prefer key stored in settings DB, fall back to env var
    let apiKey = process.env.GEOAPIFY_API_KEY ?? ''
    try {
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS geoapify_api_key TEXT DEFAULT ''`
      const settingsResult = await sql`SELECT geoapify_api_key FROM settings WHERE id='company_settings'`
      const dbKey = settingsResult.rows[0]?.geoapify_api_key
      if (dbKey) apiKey = dbKey
    } catch { /* fallback to env var */ }

    if (!apiKey) return NextResponse.json([])

    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&filter=countrycode:us&format=json&apiKey=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()

    const suggestions = (data.results ?? []).map((r: any) => ({
      full_address: r.formatted,
    }))

    return NextResponse.json(suggestions)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json([])
  }
}
