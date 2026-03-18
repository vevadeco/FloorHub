import { NextRequest, NextResponse } from 'next/server'
import { sql, generateId } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const settings = await sql`SELECT facebook_api_token FROM settings WHERE id = 'company_settings'`
    if (!settings.rows[0]?.facebook_api_token) {
      return NextResponse.json({ error: 'Facebook API not configured' }, { status: 400 })
    }
    const body = await request.json()
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'leadgen') {
          const leadData = change.value ?? {}
          await sql`
            INSERT INTO leads (id, name, email, phone, source, status, notes, project_type, estimated_sqft, created_at, updated_at)
            VALUES (${generateId()}, ${leadData.full_name ?? 'Facebook Lead'}, ${leadData.email ?? ''},
              ${leadData.phone_number ?? ''}, 'facebook', 'new',
              ${`Lead ID: ${leadData.leadgen_id ?? ''}`}, '', 0, NOW(), NOW())`
        }
      }
    }
    return NextResponse.json({ message: 'Webhook received' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
