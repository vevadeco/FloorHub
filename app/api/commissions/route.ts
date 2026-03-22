export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getAuthUser, AuthError, ForbiddenError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    let result
    if (user.role === 'owner') {
      result = await sql`SELECT * FROM commissions ORDER BY created_at DESC`
    } else {
      result = await sql`SELECT * FROM commissions WHERE employee_id = ${user.user_id} ORDER BY created_at DESC`
    }

    // Enrich each commission with per-line-item breakdown
    const enriched = await Promise.all(result.rows.map(async (c: any) => {
      const items = await sql`
        SELECT ii.product_name, ii.unit_price, ii.sqft_needed, ii.boxes_needed, ii.total_price,
               p.cost_price
        FROM invoice_items ii
        LEFT JOIN products p ON p.id = ii.product_id
        WHERE ii.invoice_id = ${c.invoice_id}
      `
      const rate = parseFloat(c.commission_rate)
      const lineItems = items.rows.map((i: any) => {
        const unitPrice = parseFloat(i.unit_price)
        const costPrice = i.cost_price ? parseFloat(i.cost_price) : 0
        const boxes = parseInt(i.boxes_needed)
        const itemProfit = (unitPrice - costPrice) * boxes
        const itemCommission = Math.max(0, itemProfit) * rate / 100
        return {
          product_name: i.product_name,
          sqft_needed: parseFloat(i.sqft_needed),
          boxes_needed: boxes,
          unit_price: unitPrice,
          cost_price: costPrice,
          total_price: parseFloat(i.total_price),
          item_profit: itemProfit,
          item_commission: itemCommission,
        }
      })
      return { ...c, line_items: lineItems }
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
