'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, X } from 'lucide-react'
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', country: 'US' })
  const [showInactivityBanner, setShowInactivityBanner] = useState(searchParams.get('reason') === 'inactivity')
  const [showLicenseExpiredBanner, setShowLicenseExpiredBanner] = useState(searchParams.get('license_expired') === 'true')
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [setupToken, setSetupToken] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/setup-status')
      .then(r => r.json())
      .then(d => setSetupRequired(d.setupRequired))
      .catch(() => setSetupRequired(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const endpoint = setupRequired ? '/api/auth/register' : '/api/auth/login'
      const body = setupRequired
        ? { name: form.name, email: form.email, password: form.password, country: form.country }
        : { email: form.email, password: form.password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      if (data.requires2FA && data.tempToken) {
        setTempToken(data.tempToken)
        return
      }
      if (data.requires2FASetup && data.setupToken) {
        setSetupToken(data.setupToken)
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code: totpCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Invalid code')
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (setupRequired === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      {showInactivityBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-md w-full max-w-md">
          <span className="flex-1">Your session expired due to inactivity.</span>
          <button
            onClick={() => setShowInactivityBanner(false)}
            className="shrink-0 rounded p-0.5 hover:bg-amber-100 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {showLicenseExpiredBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-md w-full max-w-md">
          <span className="flex-1">Your license is no longer active. Please contact your representative.</span>
          <button
            onClick={() => setShowLicenseExpiredBanner(false)}
            className="shrink-0 rounded p-0.5 hover:bg-red-100 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-accent-foreground font-bold text-xl mx-auto mb-2">F</div>
          <CardTitle className="font-heading text-2xl">
            {tempToken ? 'Two-Factor Authentication' : setupToken ? 'Set Up Two-Factor Authentication' : setupRequired ? 'Welcome to FloorHub' : 'Sign in'}
          </CardTitle>
          <CardDescription>
            {tempToken
              ? 'Enter the 6-digit code from your authenticator app'
              : setupToken
              ? 'Your organization requires 2FA. Scan the QR code to get started.'
              : setupRequired
              ? 'Create your owner account to get started'
              : 'Enter your credentials to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {setupToken ? (
            <TwoFactorSetup
              setupToken={setupToken}
              onComplete={() => { router.push('/'); router.refresh() }}
              onCancel={() => setSetupToken(null)}
            />
          ) : tempToken ? (
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp-code">Authenticator code</Label>
                <Input
                  id="totp-code"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">You can also enter a backup code.</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={loading || totpCode.length < 6}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setTempToken(null); setTotpCode(''); setError('') }}
              >
                Back to sign in
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {setupRequired && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" required />
                </div>
              )}
              {setupRequired && (
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    value={form.country}
                    onChange={e => setForm({ ...form, country: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    required
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required minLength={6} />
              </div>
              {error && (
                error.toLowerCase().includes('contact your representative')
                  ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {error}
                    </div>
                  ) : (
                    <p className="text-sm text-destructive">{error}</p>
                  )
              )}
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {setupRequired ? 'Create Account' : 'Sign In'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
