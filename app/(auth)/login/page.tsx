'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '' })

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
        ? { name: form.name, email: form.email, password: form.password }
        : { email: form.email, password: form.password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg: string = data.error ?? 'Something went wrong'
        setError(msg)
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-accent-foreground font-bold text-xl mx-auto mb-2">F</div>
          <CardTitle className="font-heading text-2xl">
            {setupRequired ? 'Welcome to FloorHub' : 'Sign in'}
          </CardTitle>
          <CardDescription>
            {setupRequired ? 'Create your owner account to get started' : 'Enter your credentials to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {setupRequired && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" required />
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
        </CardContent>
      </Card>
    </div>
  )
}
