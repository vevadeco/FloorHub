import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'floorhub-dev-secret-change-in-production'
)

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow login page through
  if (pathname === '/login') {
    return NextResponse.next()
  }

  const token = request.cookies.get('floorhub_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const role = payload.role as string

    // Employee RBAC: only allow specific routes
    if (role === 'employee') {
      const allowed =
        pathname === '/invoices' || pathname.startsWith('/invoices/') ||
        pathname === '/commissions' || pathname.startsWith('/commissions/') ||
        pathname === '/leads' || pathname.startsWith('/leads/') ||
        pathname === '/messages' || pathname.startsWith('/messages/')
      if (!allowed) {
        return NextResponse.redirect(new URL('/invoices', request.url))
      }
    }

    // License check — only when LICENSE_SERVER_URL is configured
    const licenseServerUrl = process.env.LICENSE_SERVER_URL
    if (licenseServerUrl) {
      const checkedAt = request.cookies.get('license_checked_at')?.value
      const isStale = !checkedAt || (Date.now() - new Date(checkedAt).getTime()) > 24 * 60 * 60 * 1000

      if (isStale) {
        try {
          const email = payload.email as string | undefined
          const domain = email?.split('@').pop()?.toLowerCase() || ''

          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 5000)
          const res = await fetch(`${licenseServerUrl}/api/check-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain }),
            signal: controller.signal,
          })
          clearTimeout(timeout)

          if (res.ok) {
            const data = await res.json()

            if (data.licensed === false) {
              const status = data.status || 'expired'
              const redirectUrl = new URL(`/login?license_status=${status}`, request.url)
              const response = NextResponse.redirect(redirectUrl)
              response.cookies.delete('floorhub_token')
              response.cookies.delete('license_status')
              response.cookies.delete('license_grace')
              response.cookies.delete('license_checked_at')
              return response
            }

            const response = NextResponse.next()
            response.cookies.set('license_checked_at', new Date().toISOString(), { path: '/' })

            if (data.status === 'grace_period') {
              response.cookies.set('license_status', 'grace_period', { path: '/' })
              response.cookies.set('license_grace', String(data.days_remaining), { path: '/' })
            } else if (data.status === 'active') {
              response.cookies.set('license_status', 'active', { path: '/' })
              response.cookies.delete('license_grace')
            }

            return response
          }
          // Non-ok response — fail-open, allow through
        } catch {
          // Network error — fail-open, allow through
        }
      }
    }

    return NextResponse.next()
  } catch {
    // Invalid or expired JWT
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
