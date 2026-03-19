/// <reference types="node" />
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
const _sql = neon(connectionString)

// Wrap neon's tagged template to return { rows, rowCount } shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sql(
  strings: TemplateStringsArray,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...values: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ rows: any[]; rowCount: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await _sql(strings, ...values)) as any[]
  return { rows, rowCount: rows.length }
}

export function generateId(): string {
  return crypto.randomUUID()
}
