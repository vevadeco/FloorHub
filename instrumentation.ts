export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initSchema } = await import('./lib/schema')
    await initSchema()
    await seedAdminUser()
  }
}

async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Administrator'

  if (!email || !password) return

  try {
    const { sql, generateId } = await import('./lib/db')

    const countResult = await sql`SELECT COUNT(*) as count FROM users`
    if (parseInt(countResult.rows[0].count) > 0) return

    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash(password, 10)
    const userId = generateId()

    await sql`
      INSERT INTO users (id, email, name, role, password, commission_rate)
      VALUES (${userId}, ${email}, ${name}, 'owner', ${hashedPassword}, 0.0)
    `
    console.log(`[FloorHub] Admin user seeded: ${email}`)
  } catch (err) {
    console.error('[FloorHub] Failed to seed admin user:', err)
  }
}
