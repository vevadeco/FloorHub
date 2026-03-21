export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_maps_api_key TEXT DEFAULT ''`
    const result = await sql`SELECT * FROM settings WHERE id='company_settings'`
    if (result.rows.length === 0) {
      return NextResponse.json({
        id: 'company_settings', company_name: '', company_address: '',
        company_phone: '', company_email: '', tax_rate: 0,
        facebook_api_token: '', facebook_page_id: '', logo_url: '',
        google_maps_api_key: '', updated_at: new Date().toISOString()
      })
    }
    return NextResponse.json(result.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_maps_api_key TEXT DEFAULT ''`
    const body = await request.json()
    const {
      company_name = '', company_address = '', company_phone = '', company_email = '',
      tax_rate = 0, facebook_api_token = '', facebook_page_id = '',
      google_maps_api_key = '',
    } = body

    const result = await sql`
      INSERT INTO settings (id, company_name, company_address, company_phone, company_email,
        tax_rate, facebook_api_token, facebook_page_id, logo_url, google_maps_api_key, updated_at)
      VALUES ('company_settings', ${company_name}, ${company_address}, ${company_phone}, ${company_email},
        ${tax_rate}, ${facebook_api_token}, ${facebook_page_id}, '', ${google_maps_api_key}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        company_name=${company_name}, company_address=${company_address},
        company_phone=${company_phone}, company_email=${company_email},
        tax_rate=${tax_rate}, facebook_api_token=${facebook_api_token},
        facebook_page_id=${facebook_page_id}, google_maps_api_key=${google_maps_api_key},
        updated_at=NOW()
      RETURNING *`
    return NextResponse.json(result.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
