'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export function LicenseBanner() {
  const [dismissed, setDismissed] = useState(false)
  const graceValue = getCookie('license_grace')
  const days = graceValue && !isNaN(Number(graceValue)) ? Number(graceValue) : null

  if (dismissed || days === null) return null

  return (
    <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
      <span className="flex-1">
        Your license has expired. You have {days} day{days !== 1 ? 's' : ''} remaining in the grace period. Please contact your representative.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
        aria-label="Dismiss license banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
