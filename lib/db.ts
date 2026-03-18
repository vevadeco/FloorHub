import { sql } from '@vercel/postgres'
export { sql }

export function generateId(): string {
  return crypto.randomUUID()
}
