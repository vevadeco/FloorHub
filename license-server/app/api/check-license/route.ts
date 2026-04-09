import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain, active_users } = body

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }

    const normalized = domain.toLowerCase().trim()
    const result = await sql`SELECT * FROM licenses WHERE domain = ${normalized}`

    if (result.rows.length === 0) {
      return NextResponse.json({ licensed: false, status: 'not_found' })
    }

    const license = result.rows[0]

    // Update heartbeat and active_users if provided
    if (active_users !== undefined) {
      await sql`
        UPDATE licenses
        SET last_heartbeat_at = NOW(), active_users = ${active_users}, updated_at = NOW()
        WHERE id = ${license.id}
      `
    }

    // Suspended check takes priority
    if (license.status === 'suspended') {
      return NextResponse.json({ licensed: false, status: 'suspended' })
    }

    const expiresAt = license.expires_at ? new Date(license.expires_at as string) : null
    const gracePeriodDays = license.grace_period_days as number

    // Perpetual license or not yet expired
    if (expiresAt === null || expiresAt > new Date()) {
      return NextResponse.json({
        licensed: true,
        status: 'active',
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        grace_period_days: gracePeriodDays,
      })
    }

    // Expired — check grace period
    const now = new Date()
    const graceEnd = new Date(expiresAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)

    if (now <= graceEnd) {
      const daysRemaining = Math.ceil((graceEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      return NextResponse.json({
        licensed: true,
        status: 'grace_period',
        expires_at: expiresAt.toISOString(),
        days_remaining: daysRemaining,
      })
    }

    // Past grace period
    return NextResponse.json({ licensed: false, status: 'expired' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
