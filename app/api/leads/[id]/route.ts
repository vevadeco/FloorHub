import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError, ValidationError } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    const body = await request.json()
    const { name, email = '', phone = '', source = 'manual', status = 'new', notes = '', project_type = '', estimated_sqft = 0 } = body
    if (!name) throw new ValidationError('Name is required')
    const result = await sql`
      UPDATE leads SET name=${name}, email=${email}, phone=${phone}, source=${source},
        status=${status}, notes=${notes}, project_type=${project_type},
        estimated_sqft=${estimated_sqft}, updated_at=NOW()
      WHERE id=${params.id} RETURNING *`
    if (result.rows.length === 0) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const result = await sql`DELETE FROM leads WHERE id=${params.id} RETURNING id`
    if (result.rows.length === 0) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    return NextResponse.json({ message: 'Lead deleted' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
