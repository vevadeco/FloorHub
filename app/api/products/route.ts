export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const result = await sql`SELECT * FROM products ORDER BY created_at`
    return NextResponse.json(result.rows.map(r => ({
      ...r,
      cost_price: parseFloat(r.cost_price),
      selling_price: parseFloat(r.selling_price),
      sqft_per_box: parseFloat(r.sqft_per_box),
    })))
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthUser(request)
    const body = await request.json()
    const { name, sku, category, cost_price, selling_price, sqft_per_box, stock_boxes = 0, description = '', supplier = '' } = body
    if (!name || !sku || !category || cost_price == null || selling_price == null || sqft_per_box == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const id = generateId()
    await sql`
      INSERT INTO products (id, name, sku, category, cost_price, selling_price, sqft_per_box, stock_boxes, description, supplier)
      VALUES (${id}, ${name}, ${sku}, ${category}, ${cost_price}, ${selling_price}, ${sqft_per_box}, ${stock_boxes}, ${description}, ${supplier})
    `
    const result = await sql`SELECT * FROM products WHERE id = ${id}`
    const r = result.rows[0]
    return NextResponse.json({
      ...r,
      cost_price: parseFloat(r.cost_price),
      selling_price: parseFloat(r.selling_price),
      sqft_per_box: parseFloat(r.sqft_per_box),
    }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
