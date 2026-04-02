'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface TwoFactorDisableProps {
  onDisabled: () => void
  onCancel: () => void
}

export function TwoFactorDisable({ onDisabled, onCancel }: TwoFactorDisableProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to disable 2FA')
        return
      }
      onDisabled()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter your current authenticator code or a backup code to confirm.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="disable-code">Verification code</Label>
        <Input
          id="disable-code"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="000000 or backup code"
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" variant="destructive" className="flex-1" disabled={loading || !code}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Disable 2FA
        </Button>
      </div>
    </form>
  )
}
