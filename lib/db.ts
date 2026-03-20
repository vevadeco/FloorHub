/// <reference types="node" />
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
const _sql = neon(connectionString, { fullResults: true })

// Wrap neon's tagged template to return { rows, rowCount } shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sql(
  strings: TemplateStringsArray,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...values: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ rows: any[]; rowCount: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await _sql(strings, ...values)) as any
  const rows: any[] = result.rows ?? []
  const rowCount: number = result.rowCount ?? rows.length
  return { rows, rowCount }
}

export function generateId(): string {
  return crypto.randomUUID()
}
