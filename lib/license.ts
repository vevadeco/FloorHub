export type LicenseCheckResult =
  | { licensed: true; status: 'active'; expires_at: string | null; grace_period_days: number }
  | { licensed: true; status: 'grace_period'; expires_at: string; days_remaining: number }
  | { licensed: false; status: 'expired' | 'suspended' | 'not_found' }

export type LicenseStatus = 'active' | 'grace_period' | 'expired' | 'suspended'

const FAIL_OPEN_DEFAULT: LicenseCheckResult = {
  licensed: true,
  status: 'active',
  expires_at: null,
  grace_period_days: 0,
}

export async function checkLicense(
  domain: string,
  activeUsers?: number
): Promise<LicenseCheckResult> {
  const licenseServerUrl = process.env.LICENSE_SERVER_URL
  if (!licenseServerUrl) {
    return FAIL_OPEN_DEFAULT
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`${licenseServerUrl}/api/check-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, active_users: activeUsers }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return FAIL_OPEN_DEFAULT
    }

    return await res.json()
  } catch {
    return FAIL_OPEN_DEFAULT
  }
}

export function getLicenseStatus(): LicenseStatus | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = document.cookie.split(';').reduce<Record<string, string>>((acc, c) => {
    const [key, ...rest] = c.trim().split('=')
    if (key) acc[key.trim()] = rest.join('=').trim()
    return acc
  }, {})

  const status = cookies['license_status']
  if (status && ['active', 'grace_period', 'expired', 'suspended'].includes(status)) {
    return status as LicenseStatus
  }

  return null
}
