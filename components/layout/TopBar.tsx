'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function TopBar() {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetch('/api/messages/unread-count')
      .then(r => r.json())
      .then(d => setUnreadCount(d.unread_count ?? 0))
      .catch(() => {})
  }, [])

  return (
    <header className="h-14 border-b bg-card flex items-center justify-end px-6 gap-2">
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
    </header>
  )
}
