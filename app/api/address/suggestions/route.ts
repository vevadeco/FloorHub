export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') ?? ''
    if (query.length < 3) return NextResponse.json([])

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      // Fallback: no API key configured
      return NextResponse.json([])
    }

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
