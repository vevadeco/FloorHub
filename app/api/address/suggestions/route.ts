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
    let apiKey = process.env.GOOGLE_MAPS_API_KEY ?? ''
    try {
      const settingsResult = await sql`SELECT google_maps_api_key FROM settings WHERE id='company_settings'`
      const dbKey = settingsResult.rows[0]?.google_maps_api_key
      if (dbKey) apiKey = dbKey
    } catch { /* column may not exist yet — env var fallback is fine */ }

    if (!apiKey) return NextResponse.json([])

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=address&components=country:us&key=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[address/suggestions] Google API error:', data.status)
      return NextResponse.json([])
    }

    const suggestions = (data.predictions ?? []).map((p: any) => ({
      full_address: p.description,
      place_id: p.place_id,
    }))

    return NextResponse.json(suggestions)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json([])
  }
}
