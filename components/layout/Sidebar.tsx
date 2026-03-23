'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FileText, Users, Package, Target, DollarSign,
  HardHat, UserCog, TrendingUp, MessageSquare, BarChart2, Settings, LogOut, Wrench, Menu, X, RotateCcw
} from 'lucide-react'
import type { JWTPayload } from '@/types'
import Image from 'next/image'

const ownerNav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/leads', label: 'Leads', icon: Target },
  { href: '/expenses', label: 'Expenses', icon: DollarSign },
  { href: '/contractors', label: 'Contractors', icon: HardHat },
  { href: '/employees', label: 'Employees', icon: UserCog },
  { href: '/commissions', label: 'Commissions', icon: TrendingUp },
  { href: '/installation-jobs', label: 'Installation Jobs', icon: Wrench },
  { href: '/returns', label: 'Returns', icon: RotateCcw },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const employeeNav = [
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/commissions', label: 'My Commissions', icon: TrendingUp },
  { href: '/leads', label: 'Leads', icon: Target },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
]

interface SidebarProps {
  user: JWTPayload
  logoUrl?: string
}

export function Sidebar({ user, logoUrl }: SidebarProps) {
  const pathname = usePathname()
  const nav = user.role === 'owner' ? ownerNav : employeeNav
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const sidebarContent = (
    <aside className="flex flex-col w-64 min-h-screen bg-card border-r">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b">
        {logoUrl ? (
          <Image src={logoUrl} alt="Logo" width={32} height={32} className="rounded object-contain" />
        ) : (
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm">F</div>
        )}
        <span className="font-heading font-bold text-lg">FloorHub</span>
        {/* Close button on mobile */}
        <button
          className="ml-auto md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t space-y-1">
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
        <div className="px-3 pt-2 pb-1">
          <p className="text-[10px] text-muted-foreground/50 text-center">made with ❤️ by VevadeCo · v1.4.0</p>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{sidebarContent}</div>

      {/* Mobile hamburger button */}
      <button
        className="md:hidden fixed top-3 left-4 z-50 p-2 rounded-lg bg-card border shadow-sm text-muted-foreground hover:text-foreground"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden fixed inset-y-0 left-0 z-50 flex">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}
