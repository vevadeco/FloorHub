export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { sql } from '@/lib/db'
import { getAuthUser, requireOwner, AuthError, ForbiddenError, ValidationError } from '@/lib/auth'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)

    const formData = await request.formData()
    const file = formData.get('logo') as File | null
    if (!file) throw new ValidationError('No file provided')
    if (!ALLOWED_TYPES.includes(file.type)) throw new ValidationError('File must be PNG, JPEG, or WebP')
    if (file.size > MAX_SIZE) throw new ValidationError('File must be 2 MB or smaller')

    const blob = await put(`logos/${Date.now()}-${file.name}`, file, { access: 'public' })

    await sql`
      INSERT INTO settings (id, logo_url, updated_at)
      VALUES ('company_settings', ${blob.url}, NOW())
      ON CONFLICT (id) DO UPDATE SET logo_url=${blob.url}, updated_at=NOW()`

    return NextResponse.json({ logo_url: blob.url })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
