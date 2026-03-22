export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'
import { createHmac, createHash } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') ?? ''
    if (query.length < 3) return NextResponse.json([])

    // Run lazy migrations
    try {
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS geoapify_api_key TEXT DEFAULT ''`
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US'`
      await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS aws_place_index TEXT DEFAULT ''`
    } catch { /* ignore */ }

    // Load settings
    let country = 'US'
    let geoapifyKey = process.env.GEOAPIFY_API_KEY ?? ''
    let awsPlaceIndex = process.env.AWS_PLACE_INDEX ?? ''

    try {
      const settingsResult = await sql`SELECT geoapify_api_key, country, aws_place_index FROM settings WHERE id='company_settings'`
      const row = settingsResult.rows[0]
      if (row) {
        if (row.country) country = row.country
        if (row.geoapify_api_key) geoapifyKey = row.geoapify_api_key
        if (row.aws_place_index) awsPlaceIndex = row.aws_place_index
      }
    } catch { /* fallback to env vars */ }

    if (country === 'CA') {
      return handleAmazonLocationService(query, awsPlaceIndex)
    }

    // Default: US via Geoapify
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

async function handleAmazonLocationService(query: string, placeIndex: string) {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.AWS_REGION ?? 'ca-central-1'

  if (!accessKeyId || !secretAccessKey || !placeIndex) return NextResponse.json([])

  try {
    const service = 'geo'
    const host = `geo.${region}.amazonaws.com`
    const endpoint = `/places/v0/indexes/${encodeURIComponent(placeIndex)}/search/suggestions`
    const body = JSON.stringify({ Text: query, FilterCountries: ['CAN'], MaxResults: 5 })

    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
    const dateStamp = amzDate.slice(0, 8)

    const payloadHash = createHash('sha256').update(body).digest('hex')
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`
    const signedHeaders = 'content-type;host;x-amz-date'
    const canonicalRequest = `POST\n${endpoint}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`

    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service),
      'aws4_request'
    )
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const res = await fetch(`https://${host}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        'Authorization': authHeader,
      },
      body,
    })

    if (!res.ok) return NextResponse.json([])
    const data = await res.json()

    const suggestions = (data.Results ?? []).map((r: { Text?: string }) => ({
      full_address: r.Text ?? '',
    })).filter((s: { full_address: string }) => s.full_address)

    return NextResponse.json(suggestions)
  } catch (err) {
    console.error('Amazon Location Service error:', err)
    return NextResponse.json([])
  }
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}
