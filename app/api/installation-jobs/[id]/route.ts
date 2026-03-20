export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql, generateId } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(request)
    const body = await request.json()
    const { contractor_id, contractor_name, contractor_email, install_date, notes, status } = body

    // Upsert installation job by invoice_id
    const existing = await sql`SELECT id FROM installation_jobs WHERE invoice_id = ${params.id}`

    if (existing.rows.length > 0) {
      const result = await sql`
        UPDATE installation_jobs SET
          contractor_id = ${contractor_id ?? null},
          contractor_name = ${contractor_name ?? ''},
          contractor_email = ${contractor_email ?? ''},
          install_date = ${install_date ?? ''},
          notes = ${notes ?? ''},
          status = ${status ?? 'pending'},
          updated_at = NOW()
        WHERE invoice_id = ${params.id}
        RETURNING *
      `
      return NextResponse.json(result.rows[0])
    } else {
      // Get invoice info
      const inv = await sql`SELECT invoice_number, customer_name FROM invoices WHERE id = ${params.id}`
      if (!inv.rows[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

      const jobId = generateId()
      const result = await sql`
        INSERT INTO installation_jobs (id, invoice_id, invoice_number, customer_name, contractor_id, contractor_name, contractor_email, install_date, notes, status)
        VALUES (${jobId}, ${params.id}, ${inv.rows[0].invoice_number}, ${inv.rows[0].customer_name},
          ${contractor_id ?? null}, ${contractor_name ?? ''}, ${contractor_email ?? ''},
          ${install_date ?? ''}, ${notes ?? ''}, ${status ?? 'pending'})
        RETURNING *
      `
      return NextResponse.json(result.rows[0])
    }
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
