import { sql } from '@vercel/postgres'

export { sql }

export async function initSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS licensed_domains (
      id SERIAL PRIMARY KEY,
      domain TEXT NOT NULL UNIQUE,
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}
