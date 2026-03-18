import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

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
