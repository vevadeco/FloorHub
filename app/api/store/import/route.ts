export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'
import { sql } from '@/lib/db'

// Tables in FK-safe insertion order
const TABLES_IN_ORDER = [
  'settings', 'users', 'products', 'customers',
  'invoices', 'invoice_items', 'leads', 'expenses',
  'contractors', 'payment_transactions', 'manual_payments',
  'messages', 'commissions',
]

// Allowed table names (whitelist to prevent SQL injection)
const ALLOWED_TABLES = new Set(TABLES_IN_ORDER)

async function upsertRow(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row)
  if (cols.length === 0) return

  const colList = cols.map(c => `"${c}"`).join(', ')
  const updateSet = cols
    .filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ')

  // Build the query string manually — neon accepts raw SQL via tagged template
  // We use a single-element template array trick to pass a raw string
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
  const queryStr = updateSet
    ? `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateSet}`
    : `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`

  const values = cols.map(c => row[c])

  // Use neon directly with a raw query string
  const { neon } = await import('@neondatabase/serverless')
  const _sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || '')
  await _sql(queryStr, values)
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)

    const body = await request.json()
    if (!body.version || !body.tables) {
      return NextResponse.json({ error: 'Invalid export file format' }, { status: 400 })
    }

    const results: Record<string, number> = {}

    for (const table of TABLES_IN_ORDER) {
      if (!ALLOWED_TABLES.has(table)) continue
      const rows: Record<string, unknown>[] = body.tables[table] ?? []
      if (rows.length === 0) { results[table] = 0; continue }

      let imported = 0
      for (const row of rows) {
        try {
          await upsertRow(table, row)
          imported++
        } catch (err) {
          console.warn(`[import] skipped row in ${table}:`, err)
        }
      }
      results[table] = imported
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
