export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql, generateId } from '@/lib/db'
import { getAuthUser, AuthError, ValidationError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT ''`
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to_name TEXT DEFAULT ''`
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let result
    if (user.role === 'employee') {
      result = status
        ? await sql`SELECT * FROM leads WHERE assigned_to = ${user.user_id} AND status = ${status} ORDER BY created_at DESC`
        : await sql`SELECT * FROM leads WHERE assigned_to = ${user.user_id} ORDER BY created_at DESC`
    } else {
      result = status
        ? await sql`SELECT * FROM leads WHERE status = ${status} ORDER BY created_at DESC`
        : await sql`SELECT * FROM leads ORDER BY created_at DESC`
    }
    return NextResponse.json(result.rows)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthUser(request)
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT ''`
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to_name TEXT DEFAULT ''`
    const body = await request.json()
    const {
      name, email = '', phone = '', source = 'manual', status = 'new',
      notes = '', project_type = '', estimated_sqft = 0,
      assigned_to = '', assigned_to_name = '',
    } = body
    if (!name) throw new ValidationError('Name is required')
    const id = generateId()
    const result = await sql`
      INSERT INTO leads (id, name, email, phone, source, status, notes, project_type, estimated_sqft, assigned_to, assigned_to_name, created_at, updated_at)
      VALUES (${id}, ${name}, ${email}, ${phone}, ${source}, ${status}, ${notes}, ${project_type}, ${estimated_sqft}, ${assigned_to}, ${assigned_to_name}, NOW(), NOW())
      RETURNING *`
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
