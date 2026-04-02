import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { InactivityTimer } from '@/components/auth/InactivityTimer'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const token = cookieStore.get('floorhub_token')?.value

  if (!token) redirect('/login')

  let user
  try {
    user = await verifyToken(token)
  } catch {
    redirect('/login')
  }

  const settingsResult = await sql`SELECT logo_url FROM settings WHERE id='company_settings'`
  const logoUrl = (settingsResult.rows[0]?.logo_url as string) ?? ''

  return (
    <div className="flex min-h-screen bg-background">
      <InactivityTimer />
      <Sidebar user={user} logoUrl={logoUrl} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
