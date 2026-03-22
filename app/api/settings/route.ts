export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_maps_api_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS min_floor_price NUMERIC(10,2) NOT NULL DEFAULT 0.0`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS geoapify_api_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US'`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS aws_place_index TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS amazon_location_api_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS amazon_location_region TEXT DEFAULT 'us-east-2'`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_api_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_from_email TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'none'`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS square_access_token TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS square_location_id TEXT DEFAULT ''`
    const result = await sql`SELECT * FROM settings WHERE id='company_settings'`
    if (result.rows.length === 0) {
      return NextResponse.json({
        id: 'company_settings', company_name: '', company_address: '',
        company_phone: '', company_email: '', tax_rate: 0,
        facebook_api_token: '', facebook_page_id: '', logo_url: '',
        google_maps_api_key: '', min_floor_price: 0, geoapify_api_key: '',
        country: 'US', aws_place_index: '',
        amazon_location_api_key: '', amazon_location_region: 'us-east-2',
        resend_api_key: '', resend_from_email: '',
        payment_gateway: 'none', stripe_secret_key: '', stripe_publishable_key: '',
        square_access_token: '', square_location_id: '',
        updated_at: new Date().toISOString()
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
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS min_floor_price NUMERIC(10,2) NOT NULL DEFAULT 0.0`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS geoapify_api_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US'`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS aws_place_index TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS amazon_location_api_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS amazon_location_region TEXT DEFAULT 'us-east-2'`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_api_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_from_email TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'none'`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS square_access_token TEXT DEFAULT ''`
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS square_location_id TEXT DEFAULT ''`
    const body = await request.json()
    const {
      company_name = '', company_address = '', company_phone = '', company_email = '',
      tax_rate = 0, facebook_api_token = '', facebook_page_id = '',
      google_maps_api_key = '', min_floor_price = 0, geoapify_api_key = '',
      country = 'US', aws_place_index = '',
      amazon_location_api_key = '', amazon_location_region = 'us-east-2',
      resend_api_key = '', resend_from_email = '',
      payment_gateway = 'none', stripe_secret_key = '', stripe_publishable_key = '',
      square_access_token = '', square_location_id = '',
    } = body

    const result = await sql`
      INSERT INTO settings (id, company_name, company_address, company_phone, company_email,
        tax_rate, facebook_api_token, facebook_page_id, logo_url, google_maps_api_key, min_floor_price,
        geoapify_api_key, country, aws_place_index, amazon_location_api_key, amazon_location_region,
        resend_api_key, resend_from_email,
        payment_gateway, stripe_secret_key, stripe_publishable_key, square_access_token, square_location_id,
        updated_at)
      VALUES ('company_settings', ${company_name}, ${company_address}, ${company_phone}, ${company_email},
        ${tax_rate}, ${facebook_api_token}, ${facebook_page_id}, '', ${google_maps_api_key}, ${min_floor_price},
        ${geoapify_api_key}, ${country}, ${aws_place_index}, ${amazon_location_api_key}, ${amazon_location_region},
        ${resend_api_key}, ${resend_from_email},
        ${payment_gateway}, ${stripe_secret_key}, ${stripe_publishable_key}, ${square_access_token}, ${square_location_id},
        NOW())
      ON CONFLICT (id) DO UPDATE SET
        company_name=${company_name}, company_address=${company_address},
        company_phone=${company_phone}, company_email=${company_email},
        tax_rate=${tax_rate}, facebook_api_token=${facebook_api_token},
        facebook_page_id=${facebook_page_id}, google_maps_api_key=${google_maps_api_key},
        min_floor_price=${min_floor_price}, geoapify_api_key=${geoapify_api_key},
        country=${country}, aws_place_index=${aws_place_index},
        amazon_location_api_key=${amazon_location_api_key}, amazon_location_region=${amazon_location_region},
        resend_api_key=${resend_api_key}, resend_from_email=${resend_from_email},
        payment_gateway=${payment_gateway}, stripe_secret_key=${stripe_secret_key},
        stripe_publishable_key=${stripe_publishable_key}, square_access_token=${square_access_token},
        square_location_id=${square_location_id},
        updated_at=NOW()
      RETURNING *`
    return NextResponse.json(result.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
