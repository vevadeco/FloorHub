export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    await getAuthUser(request)
    const text = await request.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2) return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const required = ['name', 'sku', 'category', 'cost_price', 'selling_price', 'sqft_per_box']
    const missing = required.filter(r => !headers.includes(r))
    if (missing.length > 0) return NextResponse.json({ error: `Missing columns: ${missing.join(', ')}` }, { status: 400 })

    let imported = 0
    let skipped = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })

      if (!row.name || !row.sku || !row.category) { skipped++; continue }

      const cost_price = parseFloat(row.cost_price) || 0
      const selling_price = parseFloat(row.selling_price) || 0
      const sqft_per_box = parseFloat(row.sqft_per_box) || 0
      const stock_boxes = parseInt(row.stock_boxes ?? '0') || 0

      // Upsert by SKU
      const existing = await sql`SELECT id FROM products WHERE sku = ${row.sku}`
      if (existing.rows.length > 0) {
        await sql`
          UPDATE products SET name=${row.name}, category=${row.category}, cost_price=${cost_price},
          selling_price=${selling_price}, sqft_per_box=${sqft_per_box}, stock_boxes=${stock_boxes},
          description=${row.description ?? ''}, supplier=${row.supplier ?? ''}, updated_at=NOW()
          WHERE sku=${row.sku}
        `
      } else {
        await sql`
          INSERT INTO products (id, name, sku, category, cost_price, selling_price, sqft_per_box, stock_boxes, description, supplier)
          VALUES (${generateId()}, ${row.name}, ${row.sku}, ${row.category}, ${cost_price}, ${selling_price}, ${sqft_per_box}, ${stock_boxes}, ${row.description ?? ''}, ${row.supplier ?? ''})
        `
      }
      imported++
    }

    return NextResponse.json({ imported, skipped })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += ch }
  }
  result.push(current)
  return result
}
