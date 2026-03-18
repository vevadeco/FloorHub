import { SignJWT, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import type { JWTPayload, Role } from '@/types'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'floorhub-dev-secret-change-in-production'
)
const COOKIE_NAME = 'floorhub_token'
const EXPIRY = '24h'

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export async function signToken(payload: {
  user_id: string
  email: string
  role: Role
  name: string
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    throw new AuthError('Invalid or expired token')
  }
}

export async function getAuthUser(request: NextRequest): Promise<JWTPayload> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) throw new AuthError('Authentication required')
  return verifyToken(token)
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

export function requireOwner(user: JWTPayload): void {
  if (user.role !== 'owner') {
    throw new ForbiddenError('Owner access required')
  }
}
