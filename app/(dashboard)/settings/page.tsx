'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, Upload, Building2, Lock, Facebook, Image, Download, DatabaseBackup, MapPin, Mail, CreditCard, Palette, ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup'
import { TwoFactorDisable } from '@/components/auth/TwoFactorDisable'
import type { Settings } from '@/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [exportingStore, setExportingStore] = useState(false)
  const [importingStore, setImportingStore] = useState(false)
  const [importingQB, setImportingQB] = useState(false)
  const [qbType, setQbType] = useState<'customers' | 'products' | 'invoices' | 'expenses'>('customers')
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null)
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [show2FADisable, setShow2FADisable] = useState(false)
  const [require2fa, setRequire2fa] = useState<boolean>(false)
  const [savingRequire2fa, setSavingRequire2fa] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const qbImportRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => { setSettings(d); setRequire2fa(d.require_2fa ?? false) })
      .finally(() => setLoading(false))
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { setTotpEnabled(d.totp_enabled ?? false); setUserRole(d.role ?? '') })
      .catch(() => setTotpEnabled(false))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (res.ok) toast.success('Settings saved')
    else { const d = await res.json(); toast.error(d.error ?? 'Failed to save') }
    setSaving(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const form = new FormData()
    form.append('logo', file)
    const res = await fetch('/api/settings/logo', { method: 'POST', body: form })
    if (res.ok) {
      const d = await res.json()
      setSettings(s => ({ ...s, logo_url: d.logo_url }))
      toast.success('Logo uploaded')
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Upload failed')
    }
    setUploadingLogo(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('New passwords do not match')
      return
    }
    if (pwForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setChangingPassword(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password }),
    })
    if (res.ok) {
      toast.success('Password changed')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to change password')
    }
    setChangingPassword(false)
  }

  const handleExportStore = async () => {
    setExportingStore(true)
    try {
      const res = await fetch('/api/store/export')
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Export failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `floorhub-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Store data exported')
    } finally {
      setExportingStore(false)
    }
  }

  const handleImportStore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('This will overwrite existing data with matching IDs. Continue?')) {
      e.target.value = ''; return
    }
    setImportingStore(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/store/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      const d = await res.json()
      if (res.ok) {
        const total = Object.values(d.results as Record<string, number>).reduce((s, n) => s + n, 0)
        toast.success(`Import complete — ${total} records restored`)
      } else {
        toast.error(d.error ?? 'Import failed')
      }
    } catch {
      toast.error('Invalid file — could not parse JSON')
    } finally {
      setImportingStore(false)
      e.target.value = ''
    }
  }

  const handleToggleRequire2fa = async (value: boolean) => {
    setSavingRequire2fa(true)
    try {
      const res = await fetch('/api/auth/2fa/require', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ require_2fa: value }),
      })
      if (res.ok) {
        setRequire2fa(value)
        toast.success(value ? '2FA required for all users' : '2FA requirement removed')
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Failed to update')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSavingRequire2fa(false)
    }
  }

  const handleQBImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportingQB(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', qbType)
      const res = await fetch('/api/quickbooks/import', { method: 'POST', body: form })
      const d = await res.json()
      if (res.ok) {
        toast.success(`QuickBooks import complete — ${d.imported} imported, ${d.skipped} skipped`)
      } else {
        toast.error(d.error ?? 'Import failed')
      }
    } catch {
      toast.error('Failed to import QuickBooks data')
    } finally {
      setImportingQB(false)
      e.target.value = ''
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your company and account settings</p>
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Building2 className="h-5 w-5 text-accent" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={settings.company_name ?? ''}
                  onChange={e => setSettings(s => ({ ...s, company_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_email">Email</Label>
                <Input
                  id="company_email"
                  type="email"
                  value={settings.company_email ?? ''}
                  onChange={e => setSettings(s => ({ ...s, company_email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_phone">Phone</Label>
                <Input
                  id="company_phone"
                  value={settings.company_phone ?? ''}
                  onChange={e => setSettings(s => ({ ...s, company_phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.tax_rate ?? ''}
                  onChange={e => setSettings(s => ({ ...s, tax_rate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_floor_price">Min Margin ($/sqft)</Label>
                <Input
                  id="min_floor_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.min_floor_price ?? ''}
                  onChange={e => setSettings(s => ({ ...s, min_floor_price: parseFloat(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">Minimum profit margin added on top of cost price. e.g. cost $2.99 + margin $0.50 = min sell price $3.49.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_address">Address</Label>
              <Input
                id="company_address"
                value={settings.company_address ?? ''}
                onChange={e => setSettings(s => ({ ...s, company_address: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms_and_conditions">Terms and Conditions</Label>
              <Textarea
                id="terms_and_conditions"
                rows={5}
                value={settings.terms_and_conditions ?? ''}
                onChange={e => setSettings(s => ({ ...s, terms_and_conditions: e.target.value }))}
                placeholder="Enter terms and conditions to be printed on invoices..."
              />
              <p className="text-xs text-muted-foreground">This text will appear on all printed and PDF invoices.</p>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium flex items-center gap-2 mb-3">
                <Facebook className="h-4 w-4 text-blue-600" />
                Facebook Lead Integration
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fb_token">API Token</Label>
                  <Input
                    id="fb_token"
                    type="password"
                    value={settings.facebook_api_token ?? ''}
                    onChange={e => setSettings(s => ({ ...s, facebook_api_token: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fb_page">Page ID</Label>
                  <Input
                    id="fb_page"
                    value={settings.facebook_page_id ?? ''}
                    onChange={e => setSettings(s => ({ ...s, facebook_page_id: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium flex items-center gap-2 mb-3">
                <Mail className="h-4 w-4 text-purple-600" />
                Email (Resend)
              </p>
              <div className="space-y-2">
                <Label htmlFor="resend_api_key">Resend API Key</Label>
                <Input
                  id="resend_api_key"
                  type="password"
                  value={settings.resend_api_key ?? ''}
                  onChange={e => setSettings(s => ({ ...s, resend_api_key: e.target.value }))}
                  placeholder="re_••••••••"
                />
                <p className="text-xs text-muted-foreground">Used for sending invoices by email. Get a key at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline">resend.com</a>.</p>
              </div>
              <div className="space-y-2 mt-4">
                <Label htmlFor="resend_from_email">From Email Address</Label>
                <Input
                  id="resend_from_email"
                  type="email"
                  value={settings.resend_from_email ?? ''}
                  onChange={e => setSettings(s => ({ ...s, resend_from_email: e.target.value }))}
                  placeholder="invoices@yourdomain.com"
                />
                <p className="text-xs text-muted-foreground">Must be a verified sender in your Resend account. Leave blank to use the default shared address.</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                Payment Gateway
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_gateway">Gateway</Label>
                  <select
                    id="payment_gateway"
                    value={settings.payment_gateway ?? 'none'}
                    onChange={e => setSettings(s => ({ ...s, payment_gateway: e.target.value as any }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="none">None (disable online payments)</option>
                    <option value="stripe">Stripe</option>
                    <option value="square">Square POS</option>
                  </select>
                </div>

                {settings.payment_gateway === 'stripe' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="stripe_secret_key">Stripe Secret Key</Label>
                      <Input
                        id="stripe_secret_key"
                        type="password"
                        value={settings.stripe_secret_key ?? ''}
                        onChange={e => setSettings(s => ({ ...s, stripe_secret_key: e.target.value }))}
                        placeholder="sk_live_••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stripe_publishable_key">Stripe Publishable Key</Label>
                      <Input
                        id="stripe_publishable_key"
                        value={settings.stripe_publishable_key ?? ''}
                        onChange={e => setSettings(s => ({ ...s, stripe_publishable_key: e.target.value }))}
                        placeholder="pk_live_••••••••"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Get your keys from the <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline">Stripe Dashboard</a>.</p>
                  </div>
                )}

                {settings.payment_gateway === 'square' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="square_access_token">Square Access Token</Label>
                      <Input
                        id="square_access_token"
                        type="password"
                        value={settings.square_access_token ?? ''}
                        onChange={e => setSettings(s => ({ ...s, square_access_token: e.target.value }))}
                        placeholder="EAAAl••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="square_location_id">Square Location ID</Label>
                      <Input
                        id="square_location_id"
                        value={settings.square_location_id ?? ''}
                        onChange={e => setSettings(s => ({ ...s, square_location_id: e.target.value }))}
                        placeholder="L••••••••"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Get your credentials from the <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener noreferrer" className="underline">Square Developer Dashboard</a>. Use a Production access token for live payments.</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-green-600" />
                Address Autocomplete
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    value={settings.country ?? 'US'}
                    onChange={e => setSettings(s => ({ ...s, country: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="US">United States (Geoapify)</option>
                    <option value="CA">Canada (Amazon Location Service)</option>
                  </select>
                </div>

                {(settings.country ?? 'US') === 'US' && (
                  <div className="space-y-2">
                    <Label htmlFor="geoapify_api_key">Geoapify API Key</Label>
                    <Input
                      id="geoapify_api_key"
                      type="password"
                      value={settings.geoapify_api_key ?? ''}
                      onChange={e => setSettings(s => ({ ...s, geoapify_api_key: e.target.value }))}
                      placeholder="••••••••"
                    />
                    <p className="text-xs text-muted-foreground">Get a free key at <a href="https://www.geoapify.com" target="_blank" rel="noopener noreferrer" className="underline">geoapify.com</a> (3,000 req/day free).</p>
                  </div>
                )}

                {settings.country === 'CA' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="amazon_location_api_key">Amazon Location API Key</Label>
                      <Input
                        id="amazon_location_api_key"
                        type="password"
                        value={settings.amazon_location_api_key ?? ''}
                        onChange={e => setSettings(s => ({ ...s, amazon_location_api_key: e.target.value }))}
                        placeholder="v1.public.eyJ..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amazon_location_region">AWS Region</Label>
                      <Input
                        id="amazon_location_region"
                        value={settings.amazon_location_region ?? 'us-east-2'}
                        onChange={e => setSettings(s => ({ ...s, amazon_location_region: e.target.value }))}
                        placeholder="us-east-2"
                      />
                      <p className="text-xs text-muted-foreground">Create an API key in the <a href="https://console.aws.amazon.com/location/" target="_blank" rel="noopener noreferrer" className="underline">Amazon Location Service console</a> with <code>geo-places:Suggest</code>, <code>geo-places:GetPlace</code>, and <code>geo-maps:GetTile</code> permissions.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" className="bg-accent hover:bg-accent/90" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>          </form>
        </CardContent>
      </Card>

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Image className="h-5 w-5 text-accent" />
            Company Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.logo_url && (
            <div className="border rounded-lg p-4 bg-muted/30 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.logo_url} alt="Company logo" className="max-h-24 max-w-full object-contain" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {settings.logo_url ? 'Replace Logo' : 'Upload Logo'}
            </Button>
            <p className="text-xs text-muted-foreground">PNG, JPG, GIF, WebP — max 2 MB</p>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Lock className="h-5 w-5 text-accent" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <Input
                id="current_password"
                type="password"
                value={pwForm.current_password}
                onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                value={pwForm.new_password}
                onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={pwForm.confirm_password}
                onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" variant="outline" disabled={changingPassword}>
                {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Change Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Palette className="h-5 w-5 text-accent" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Switch between light and dark color scheme</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {totpEnabled === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : show2FASetup ? (
            <TwoFactorSetup
              onComplete={() => { setShow2FASetup(false); setTotpEnabled(true); toast.success('2FA enabled') }}
              onCancel={() => setShow2FASetup(false)}
            />
          ) : show2FADisable ? (
            <TwoFactorDisable
              onDisabled={() => { setShow2FADisable(false); setTotpEnabled(false); toast.success('2FA disabled') }}
              onCancel={() => setShow2FADisable(false)}
            />
          ) : totpEnabled ? (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Status</p>
                  <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                    Enabled
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Your account is protected with a TOTP authenticator app.</p>
              </div>
              <Button variant="outline" onClick={() => setShow2FADisable(true)}>
                Disable 2FA
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Status: Not enabled</p>
                <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
              </div>
              <Button onClick={() => setShow2FASetup(true)} className="bg-accent hover:bg-accent/90">
                Enable 2FA
              </Button>
            </div>
          )}

          {/* Owner-only: enforce 2FA for all users */}
          {userRole === 'owner' && !show2FASetup && !show2FADisable && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Require 2FA for all users</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, employees must set up an authenticator app before accessing the dashboard.
                  </p>
                </div>
                <Button
                  variant={require2fa ? 'destructive' : 'outline'}
                  size="sm"
                  disabled={savingRequire2fa}
                  onClick={() => handleToggleRequire2fa(!require2fa)}
                >
                  {savingRequire2fa && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  {require2fa ? 'Disable Requirement' : 'Require 2FA'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <DatabaseBackup className="h-5 w-5 text-accent" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Export Store Data</p>
            <p className="text-xs text-muted-foreground">Download a full backup of all store data including invoices, customers, products, expenses, and more as a JSON file.</p>
            <Button variant="outline" onClick={handleExportStore} disabled={exportingStore}>
              {exportingStore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Export All Data
            </Button>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Import Store Data</p>
            <p className="text-xs text-muted-foreground">Restore data from a previously exported JSON file. Existing records with matching IDs will be overwritten.</p>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportStore} />
            <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importingStore}>
              {importingStore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Import Data
            </Button>
          </div>
          <Separator />
          <div className="space-y-3">
            <p className="text-sm font-medium">Import from QuickBooks</p>
            <p className="text-xs text-muted-foreground">Import data exported from QuickBooks as a CSV file. Select the data type that matches your export.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={qbType}
                onChange={e => setQbType(e.target.value as typeof qbType)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="customers">Customers</option>
                <option value="products">Products / Items</option>
                <option value="invoices">Invoices</option>
                <option value="expenses">Expenses</option>
              </select>
              <input ref={qbImportRef} type="file" accept=".csv" className="hidden" onChange={handleQBImport} />
              <Button variant="outline" onClick={() => qbImportRef.current?.click()} disabled={importingQB}>
                {importingQB ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Import CSV
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">In QuickBooks: go to Reports → export the relevant report as CSV, or use File → Utilities → Export.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
