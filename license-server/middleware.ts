import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAdminSession } from '@/lib/auth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow API routes and the login page through
  if (pathname.startsWith('/api') || pathname === '/') {
    return NextResponse.next()
  }

  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    if (!sessionCookie || !verifyAdminSession(sessionCookie)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
