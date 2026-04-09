import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSession, ADMIN_COOKIE_NAME } from '@/lib/auth'
import LogoutButton from './LogoutButton'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value

  if (!session || !verifyAdminSession(session)) {
    redirect('/')
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-100">FloorHub License Server</h1>
        <LogoutButton />
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
