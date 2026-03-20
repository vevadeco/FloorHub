export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)

    const invoices = await sql`
      SELECT i.id, i.invoice_number, i.customer_name, i.customer_address, i.customer_phone, i.status, i.total, i.created_at
      FROM invoices i
      WHERE i.is_install_job = true AND i.is_estimate = false
      ORDER BY i.created_at DESC
    `

    const jobs = await sql`SELECT * FROM installation_jobs`
    const jobMap = new Map(jobs.rows.map((j: any) => [j.invoice_id, j]))

    const result = invoices.rows.map((inv: any) => ({
      ...inv,
      total: parseFloat(inv.total),
      job: jobMap.get(inv.id) ?? null,
    }))

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
