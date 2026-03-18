export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    const body = await request.json()
    const { name, email = '', phone = '', address = '', city = '', state = '', zip_code = '', notes = '' } = body
    const result = await sql`
      UPDATE customers SET name=${name}, email=${email}, phone=${phone}, address=${address},
      city=${city}, state=${state}, zip_code=${zip_code}, notes=${notes}
      WHERE id=${params.id}
    `
    if (result.rowCount === 0) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    const updated = await sql`SELECT * FROM customers WHERE id = ${params.id}`
    return NextResponse.json(updated.rows[0])
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)
    const result = await sql`DELETE FROM customers WHERE id = ${params.id}`
    if (result.rowCount === 0) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    return NextResponse.json({ message: 'Customer deleted' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
