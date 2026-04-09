'use client'

import { useState } from 'react'

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' })
    } finally {
      window.location.href = '/'
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
    >
      Logout
    </button>
  )
}
