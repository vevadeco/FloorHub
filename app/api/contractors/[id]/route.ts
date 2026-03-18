import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError, ValidationError } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const body = await request.json()
    const { name, company = '', phone, email = '', specialty = '', address = '', notes = '', rating = 5 } = body
    if (!name || !phone) throw new ValidationError('name and phone are required')
    const result = await sql`
      UPDATE contractors SET name=${name}, company=${company}, phone=${phone}, email=${email},
        specialty=${specialty}, address=${address}, notes=${notes}, rating=${rating}, updated_at=NOW()
      WHERE id=${params.id} RETURNING *`
    if (result.rows.length === 0) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const result = await sql`DELETE FROM contractors WHERE id=${params.id} RETURNING id`
    if (result.rows.length === 0) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    return NextResponse.json({ message: 'Contractor deleted' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
