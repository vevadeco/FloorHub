import { sql } from '@/lib/db'
import LicenseDashboard from './LicenseDashboard'

export const dynamic = 'force-dynamic'

interface LicenseRecord {
  id: string
  domain: string
  license_key: string
  expires_at: string | null
  status: string
  grace_period_days: number
  notes: string | null
  last_heartbeat_at: string | null
  active_users: number
  created_at: string
  updated_at: string
}

export default async function DashboardPage() {
  let licenses: LicenseRecord[] = []
  try {
    const result = await sql`SELECT * FROM licenses ORDER BY created_at DESC`
    licenses = result.rows as unknown as LicenseRecord[]
  } catch (error) {
    console.error('Failed to fetch licenses:', error)
  }

  return <LicenseDashboard initialLicenses={licenses} />
}
