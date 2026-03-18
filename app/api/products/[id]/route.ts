import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    const body = await request.json()
    const { name, sku, category, cost_price, selling_price, sqft_per_box, stock_boxes = 0, description = '', supplier = '' } = body
    const result = await sql`
      UPDATE products SET name=${name}, sku=${sku}, category=${category}, cost_price=${cost_price},
      selling_price=${selling_price}, sqft_per_box=${sqft_per_box}, stock_boxes=${stock_boxes},
      description=${description}, supplier=${supplier}, updated_at=NOW()
      WHERE id=${params.id}
    `
    if (result.rowCount === 0) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    const updated = await sql`SELECT * FROM products WHERE id = ${params.id}`
    const r = updated.rows[0]
    return NextResponse.json({
      ...r,
      cost_price: parseFloat(r.cost_price),
      selling_price: parseFloat(r.selling_price),
      sqft_per_box: parseFloat(r.sqft_per_box),
    })
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
    const result = await sql`DELETE FROM products WHERE id = ${params.id}`
    if (result.rowCount === 0) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    return NextResponse.json({ message: 'Product deleted' })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
