export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)

    // Self-healing: ensure job_type column and delivery_orders table exist
    try {
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_type TEXT`
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS scheduled_date DATE`
    } catch { /* no-op */ }

    try {
      await sql`
        CREATE TABLE IF NOT EXISTS delivery_orders (
          id                TEXT PRIMARY KEY,
          invoice_id        TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          invoice_number    TEXT NOT NULL,
          do_number         INTEGER NOT NULL UNIQUE,
          delivery_order_id TEXT NOT NULL UNIQUE,
          customer_name     TEXT NOT NULL,
          delivery_date     TEXT DEFAULT '',
          notes             TEXT DEFAULT '',
          status            TEXT NOT NULL DEFAULT 'pending',
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS delivery_orders_invoice_id_idx ON delivery_orders(invoice_id)`
    } catch (e) {
      console.error('[delivery-orders GET] table creation error:', e)
    }

    const rows = await sql`
      SELECT
        i.id,
        i.invoice_number,
        i.customer_name,
        i.customer_address,
        i.status,
        i.created_at,
        d.id              AS do_id,
        d.invoice_id      AS do_invoice_id,
        d.invoice_number  AS do_invoice_number,
        d.do_number,
        d.delivery_order_id,
        d.customer_name   AS do_customer_name,
        d.delivery_date,
        d.notes           AS do_notes,
        d.status          AS do_status,
        d.created_at      AS do_created_at,
        d.updated_at      AS do_updated_at
      FROM invoices i
      LEFT JOIN delivery_orders d ON d.invoice_id = i.id
      WHERE i.job_type = 'delivery' OR d.id IS NOT NULL
      ORDER BY i.created_at DESC
    `

    // Debug: log what job_type values exist to help diagnose missing orders
    const debugRows = await sql`SELECT id, invoice_number, job_type, scheduled_date FROM invoices ORDER BY created_at DESC LIMIT 10`
    console.log('[delivery-orders GET] recent invoices job_types:', JSON.stringify(debugRows.rows))

    const result = rows.rows.map((row: any) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      customer_name: row.customer_name,
      customer_address: row.customer_address || '',
      status: row.status,
      created_at: row.created_at,
      job: row.do_id ? {
        id: row.do_id,
        invoice_id: row.do_invoice_id,
        invoice_number: row.do_invoice_number,
        do_number: row.do_number,
        delivery_order_id: row.delivery_order_id,
        customer_name: row.do_customer_name,
        customer_address: row.customer_address || '',
        delivery_date: row.delivery_date || '',
        notes: row.do_notes || '',
        status: row.do_status,
        created_at: row.do_created_at,
        updated_at: row.do_updated_at,
      } : null,
    }))

    return NextResponse.json({ orders: result, _debug: debugRows.rows.map((r: any) => ({ invoice_number: r.invoice_number, job_type: r.job_type })) })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[delivery-orders GET]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
