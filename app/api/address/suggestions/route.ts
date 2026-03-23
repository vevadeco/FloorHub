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

    // Lazy migrations
    try {
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS geoapify_api_key TEXT DEFAULT ''`
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US'`
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS amazon_location_api_key TEXT DEFAULT ''`
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS amazon_location_region TEXT DEFAULT 'us-east-2'`
    } catch { /* ignore */ }

    let country = 'US'
    let geoapifyKey = process.env.GEOAPIFY_API_KEY ?? ''
    let amazonApiKey = ''
    let amazonRegion = 'us-east-2'

    try {
      const { rows } = await sql`
        SELECT geoapify_api_key, country, amazon_location_api_key, amazon_location_region
        FROM settings WHERE id='company_settings'
      `
      const row = rows[0]
      if (row) {
        if (row.country) country = row.country
        if (row.geoapify_api_key) geoapifyKey = row.geoapify_api_key
        if (row.amazon_location_api_key) amazonApiKey = row.amazon_location_api_key
        if (row.amazon_location_region) amazonRegion = row.amazon_location_region
      }
    } catch { /* fallback to env vars */ }

    if (country === 'CA') {
      return handleAmazonV2(query, amazonApiKey, amazonRegion)
    }

    // US: Geoapify
    if (!geoapifyKey) return NextResponse.json([])
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&filter=countrycode:us&format=json&apiKey=${geoapifyKey}`
    const res = await fetch(url)
    const data = await res.json()
    const suggestions = (data.results ?? []).map((r: { formatted: string }) => ({
      full_address: r.formatted,
    }))
    return NextResponse.json(suggestions)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json([])
  }
}

async function handleAmazonV2(query: string, apiKey: string, region: string) {
  if (!apiKey) return NextResponse.json([])
  try {
    const url = `https://places.geo.${region}.amazonaws.com/v2/autocomplete?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        QueryText: query,
        MaxResults: 5,
        Filter: { IncludeCountries: ['CAN'] },
      }),
    })
    if (!res.ok) {
      console.error('[Amazon v2] HTTP', res.status, await res.text())
      return NextResponse.json([])
    }
    const data = await res.json()
    const suggestions = (data.ResultItems ?? [])
      .map((r: { Address?: { Label?: string }; Title?: string }) => ({
        full_address: r.Address?.Label ?? r.Title ?? '',
      }))
      .filter((s: { full_address: string }) => s.full_address)
    return NextResponse.json(suggestions)
  } catch (err) {
    console.error('[Amazon v2] error:', err)
    return NextResponse.json([])
  }
}
