export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    // Find invoices that have an "install" line item (case-insensitive)
    const invoicesWithInstall = await sql`
      SELECT DISTINCT i.id, i.invoice_number, i.customer_name, i.status, i.created_at
      FROM invoices i
      JOIN invoice_items ii ON ii.invoice_id = i.id
      WHERE LOWER(ii.product_name) LIKE '%install%'
      AND i.is_estimate = false
      ORDER BY i.created_at DESC
    `

    // Get existing jobs
    const jobs = await sql`SELECT * FROM installation_jobs`
    const jobMap = new Map(jobs.rows.map((j: any) => [j.invoice_id, j]))

    const result = invoicesWithInstall.rows.map((inv: any) => ({
      ...inv,
      job: jobMap.get(inv.id) ?? null,
    }))

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
