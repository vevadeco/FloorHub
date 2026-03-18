export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request)
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') ?? ''
    if (query.length < 2) return NextResponse.json([])

    // Return mock suggestions based on query — real implementation would call a geocoding API
    const suggestions = [
      { full_address: `${query}, Miami, FL 33101` },
      { full_address: `${query}, Orlando, FL 32801` },
      { full_address: `${query}, Tampa, FL 33601` },
    ]
    return NextResponse.json(suggestions)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json([])
  }
}
