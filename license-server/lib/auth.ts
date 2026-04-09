import crypto from 'crypto'

export const ADMIN_COOKIE_NAME = 'license_admin_session'

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

export function createAdminSession(secret: string): string | null {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || secret !== adminSecret) {
    return null
  }

  const timestamp = Date.now().toString()
  const hmac = crypto.createHmac('sha256', adminSecret).update(timestamp).digest('hex')
  return `${timestamp}.${hmac}`
}

export function verifyAdminSession(cookie: string): boolean {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || !cookie) {
    return false
  }

  const parts = cookie.split('.')
  if (parts.length !== 2) {
    return false
  }

  const [timestamp, signature] = parts
  const expectedHmac = crypto.createHmac('sha256', adminSecret).update(timestamp).digest('hex')

  if (signature !== expectedHmac) {
    return false
  }

  // Check if token is expired (24h max)
  const tokenAge = Date.now() - parseInt(timestamp, 10)
  if (isNaN(tokenAge) || tokenAge > SESSION_MAX_AGE_MS) {
    return false
  }

  return true
}
