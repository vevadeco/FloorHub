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

    // Employee RBAC: only allow /invoices and /invoices/*
    if (role === 'employee') {
      const isInvoicePath = pathname === '/invoices' || pathname.startsWith('/invoices/')
      if (!isInvoicePath) {
        return NextResponse.redirect(new URL('/invoices', request.url))
      }
    }

    return NextResponse.next()
  } catch {
    // Invalid or expired JWT
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
