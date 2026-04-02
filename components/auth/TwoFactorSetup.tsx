'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Copy, Check } from 'lucide-react'

interface TwoFactorSetupProps {
  onComplete: () => void
  onCancel: () => void
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'qr' | 'backup'>('qr')
  const [qrUri, setQrUri] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/auth/2fa/enroll', { method: 'POST' })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Enrollment failed')
        setQrUri(data.qrUri)
        setSecret(data.secret)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifying(true)
    setError('')
    try {
      const res = await fetch('/api/auth/2fa/verify-enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Verification failed')
        return
      }
      setBackupCodes(data.backupCodes)
      setStep('backup')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (step === 'backup') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">2FA enabled successfully!</p>
        </div>
        <div>
          <p className="text-sm font-medium mb-1">Save your backup codes</p>
          <p className="text-xs text-muted-foreground mb-3">
            Store these codes somewhere safe. Each can be used once if you lose access to your authenticator app.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 font-mono text-sm">
            {backupCodes.map(c => (
              <span key={c} className="text-center">{c}</span>
            ))}
          </div>
        </div>
        <Button onClick={onComplete} className="w-full bg-accent hover:bg-accent/90">
          Done — I&apos;ve saved my codes
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {qrUri && (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUri} alt="QR code for authenticator app" className="w-48 h-48 rounded-lg border" />
          <p className="text-xs text-muted-foreground text-center">
            Scan with Google Authenticator, Authy, or any TOTP app
          </p>
        </div>
      )}
      {secret && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Or enter this key manually:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded border bg-muted px-3 py-1.5 text-xs font-mono break-all">{secret}</code>
            <Button variant="ghost" size="icon" onClick={handleCopySecret} className="shrink-0 h-8 w-8">
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}
      <form onSubmit={handleVerify} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="totp-code">Enter the 6-digit code from your app</Label>
          <Input
            id="totp-code"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1 bg-accent hover:bg-accent/90" disabled={verifying || code.length !== 6}>
            {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Verify &amp; Enable
          </Button>
        </div>
      </form>
    </div>
  )
}
