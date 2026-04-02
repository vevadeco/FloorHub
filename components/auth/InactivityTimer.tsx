'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const THROTTLE_MS = 1000 // throttle activity updates to once per second

export function InactivityTimer() {
  const router = useRouter()
  const lastActivity = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    async function logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // If logout request fails, still redirect to ensure user is not left in broken state
      }
      router.push('/login?reason=inactivity')
    }

    function scheduleTimer() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        logout()
      }, INACTIVITY_TIMEOUT_MS)
    }

    let lastThrottle = 0
    function handleActivity() {
      const now = Date.now()
      if (now - lastThrottle < THROTTLE_MS) return
      lastThrottle = now
      lastActivity.current = now
      scheduleTimer()
    }

    function handleVisibilityChange() {
      if (typeof document === 'undefined') return

      if (document.visibilityState === 'hidden') {
        // Pause the timer by recording when we went hidden and clearing the timeout
        hiddenAtRef.current = Date.now()
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
      } else if (document.visibilityState === 'visible') {
        // Check if 30 minutes have elapsed since last activity
        const elapsed = Date.now() - lastActivity.current
        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
          logout()
        } else {
          // Resume timer with remaining time
          scheduleTimer()
        }
        hiddenAtRef.current = null
      }
    }

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('click', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('touchstart', handleActivity)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Start the initial timer
    scheduleTimer()

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [router])

  return null
}
