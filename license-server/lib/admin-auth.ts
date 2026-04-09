import { NextRequest } from 'next/server'
import { verifyAdminSession, ADMIN_COOKIE_NAME } from './auth'

/**
 * Check admin authentication via either:
 * 1. x-admin-secret header (for programmatic API access)
 * 2. Admin session cookie (for dashboard UI access)
 */
export function checkAdminAuth(request: NextRequest): boolean {
  // Check header-based auth first
  const headerSecret = request.headers.get('x-admin-secret')
  if (headerSecret && headerSecret === process.env.ADMIN_SECRET) {
    return true
  }

  // Fall back to cookie-based session auth
  const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (sessionCookie && verifyAdminSession(sessionCookie)) {
    return true
  }

  return false
}
