import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
const _sql = neon(connectionString)

// Wrap neon's tagged template to return { rows, rowCount } shape
export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
  const rows = (await _sql(strings, ...values)) as Record<string, unknown>[]
  return { rows, rowCount: rows.length }
}

export function generateId(): string {
  return crypto.randomUUID()
}
