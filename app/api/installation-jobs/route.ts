export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)

    // Ensure column exists before querying
    try {
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_install_job BOOLEAN NOT NULL DEFAULT FALSE`
    } catch { /* no-op */ }

    const invoices = await sql`
      SELECT i.id, i.invoice_number, i.customer_name, i.customer_address,
             i.customer_phone, i.status, i.total, i.created_at
      FROM invoices i
      WHERE i.is_install_job = true AND i.is_estimate = false
      ORDER BY i.created_at DESC
    `

    // Ensure installation_jobs table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS installation_jobs (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          invoice_number TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          contractor_id TEXT,
          contractor_name TEXT DEFAULT '',
          contractor_email TEXT DEFAULT '',
          install_date TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(invoice_id)
        )
      `
    } catch { /* no-op */ }

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
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[installation-jobs GET]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
