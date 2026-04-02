'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

export function TopBar() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    fetch('/api/messages/unread-count')
      .then(r => r.json())
      .then(d => setUnreadCount(d.unread_count ?? 0))
      .catch(() => {})
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => setCompanyName(d.company_name ?? ''))
      .catch(() => {})
  }, [])

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6 gap-2">
      <span className="font-heading font-semibold text-sm text-muted-foreground truncate">
        {companyName}
      </span>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild className="relative">
          <Link href="/messages">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </Button>
      </div>
    </header>
  )
}
