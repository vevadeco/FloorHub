import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import crypto from 'crypto'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
const _sql: NeonQueryFunction<false, false> = neon(connectionString)

export const sql = new Proxy(_sql, {
  apply(target, _thisArg, args) {
    const result = Reflect.apply(target, _thisArg, args)
    if (result && typeof result.then === 'function') {
      return result.then((rows: unknown[]) => ({ rows, rowCount: rows.length }))
    }
    return result
  },
}) as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>

export function generateId(): string {
  return crypto.randomUUID()
}

export function generateLicenseKey(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
}

export async function initSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS licenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      domain TEXT NOT NULL UNIQUE,
      license_key TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
      grace_period_days INTEGER NOT NULL DEFAULT 7,
      notes TEXT,
      last_heartbeat_at TIMESTAMPTZ,
      active_users INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Migrate existing licensed_domains rows if the old table exists
  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'licensed_domains'
    ) AS table_exists
  `

  if (tableCheck.rows[0]?.table_exists) {
    const oldRows = await sql`SELECT domain FROM licensed_domains`
    for (const row of oldRows.rows) {
      const domain = row.domain as string
      const licenseKey = generateLicenseKey()
      await sql`
        INSERT INTO licenses (domain, license_key, status)
        VALUES (${domain}, ${licenseKey}, 'active')
        ON CONFLICT (domain) DO NOTHING
      `
    }
    await sql`DROP TABLE licensed_domains`
  }
}
