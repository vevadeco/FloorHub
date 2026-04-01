export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const yearParam = searchParams.get('year') ?? String(now.getFullYear())
    const monthParam = searchParams.get('month') ?? String(now.getMonth() + 1)

    const year = parseInt(yearParam)
    const month = parseInt(monthParam)

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month parameter' }, { status: 400 })
    }

    // Lazy migration
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_type TEXT`
    await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS scheduled_date DATE`

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0) // last day of month
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

    const result = await sql`
      SELECT id, invoice_number, customer_name, job_type, scheduled_date
      FROM invoices
      WHERE scheduled_date IS NOT NULL
        AND scheduled_date >= ${startDate}::date
        AND scheduled_date <= ${endDateStr}::date
      ORDER BY scheduled_date ASC
    `

    return NextResponse.json(result.rows.map(r => ({
      ...r,
      scheduled_date: r.scheduled_date
        ? new Date(r.scheduled_date).toISOString().split('T')[0]
        : null,
    })))
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
