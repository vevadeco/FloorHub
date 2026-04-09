export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initSchema } = await import('./lib/db')
      await initSchema()
    } catch (error) {
      console.error('Failed to initialize database schema:', error)
      throw error
    }
  }
}
