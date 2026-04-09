'use client'

import { useState, FormEvent } from 'react'

interface LicenseRecord {
  id: string
  domain: string
  license_key: string
  expires_at: string | null
  status: string
  grace_period_days: number
  notes: string | null
  last_heartbeat_at: string | null
  active_users: number
  created_at: string
  updated_at: string
}

interface Props {
  initialLicenses: LicenseRecord[]
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-900 text-green-300',
    suspended: 'bg-red-900 text-red-300',
    expired: 'bg-yellow-900 text-yellow-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  )
}

function maskKey(key: string): string {
  return key.length > 8 ? key.slice(0, 8) + '...' : key
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LicenseDashboard({ initialLicenses }: Props) {
  const [licenses, setLicenses] = useState<LicenseRecord[]>(initialLicenses)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingLicense, setEditingLicense] = useState<LicenseRecord | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [keyCopied, setKeyCopied] = useState(false)
  const [error, setError] = useState('')

  const filtered = licenses.filter((l) => {
    const q = search.toLowerCase()
    return l.domain.toLowerCase().includes(q) || l.status.toLowerCase().includes(q)
  })

  async function apiFetch(url: string, options?: RequestInit) {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
    return res
  }

  async function refreshLicenses() {
    const res = await apiFetch('/api/admin/licenses')
    if (res.ok) {
      setLicenses(await res.json())
    }
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const form = new FormData(e.currentTarget)
    const domain = form.get('domain') as string
    const expiresAt = form.get('expires_at') as string
    const graceDays = form.get('grace_period_days') as string
    const notes = form.get('notes') as string

    const body: Record<string, unknown> = { domain }
    if (expiresAt) body.expires_at = new Date(expiresAt).toISOString()
    if (graceDays) body.grace_period_days = parseInt(graceDays, 10)
    if (notes) body.notes = notes

    const res = await apiFetch('/api/admin/licenses', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const created = await res.json()
      setNewKey(created.license_key)
      setKeyCopied(false)
      setShowCreate(false)
      await refreshLicenses()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to create license')
    }
  }

  async function handleEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingLicense) return
    setError('')
    const form = new FormData(e.currentTarget)
    const expiresAt = form.get('expires_at') as string
    const graceDays = form.get('grace_period_days') as string
    const notes = form.get('notes') as string
    const status = form.get('status') as string

    const body: Record<string, unknown> = {
      grace_period_days: parseInt(graceDays, 10),
      notes: notes || null,
      status,
    }
    if (expiresAt) {
      body.expires_at = new Date(expiresAt).toISOString()
    } else {
      body.expires_at = null
    }

    const res = await apiFetch(`/api/admin/licenses/${editingLicense.id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setEditingLicense(null)
      await refreshLicenses()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to update license')
    }
  }

  async function handleSuspendToggle(license: LicenseRecord) {
    const action = license.status === 'suspended' ? 'reactivate' : 'suspend'
    const res = await apiFetch(`/api/admin/licenses/${license.id}/${action}`, { method: 'PATCH' })
    if (res.ok) await refreshLicenses()
  }

  async function handleDelete(license: LicenseRecord) {
    if (!confirm(`Delete license for ${license.domain}? This cannot be undone.`)) return
    const res = await apiFetch(`/api/admin/licenses/${license.id}`, { method: 'DELETE' })
    if (res.ok) await refreshLicenses()
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setKeyCopied(true)
    }
  }

  function toInputDate(iso: string | null): string {
    if (!iso) return ''
    return new Date(iso).toISOString().split('T')[0]
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* New key display */}
      {newKey && (
        <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg">
          <p className="text-sm text-green-300 mb-2 font-medium">License created! Copy the key now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-900 px-3 py-2 rounded text-sm font-mono text-green-200 break-all">{newKey}</code>
            <button onClick={copyKey} className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm text-white whitespace-nowrap">
              {keyCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-green-400 hover:text-green-300">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-300">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Licenses</h2>
        <button
          onClick={() => { setShowCreate(true); setError('') }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white font-medium transition-colors"
        >
          New License
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by domain or status..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">New License</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Domain *</label>
                <input name="domain" required className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500" placeholder="example.com" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Expiration Date (optional)</label>
                <input name="expires_at" type="date" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Grace Period Days</label>
                <input name="grace_period_days" type="number" defaultValue={7} min={0} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea name="notes" rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition-colors">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-200 font-medium transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingLicense && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit License — {editingLicense.domain}</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Expiration Date</label>
                <input name="expires_at" type="date" defaultValue={toInputDate(editingLicense.expires_at)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Grace Period Days</label>
                <input name="grace_period_days" type="number" defaultValue={editingLicense.grace_period_days} min={0} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Status</label>
                <select name="status" defaultValue={editingLicense.status} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea name="notes" rows={2} defaultValue={editingLicense.notes || ''} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition-colors">Save</button>
                <button type="button" onClick={() => setEditingLicense(null)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-200 font-medium transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* License Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="pb-2 pr-4">Domain</th>
              <th className="pb-2 pr-4">License Key</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Expires</th>
              <th className="pb-2 pr-4">Grace Period</th>
              <th className="pb-2 pr-4">Last Heartbeat</th>
              <th className="pb-2 pr-4">Active Users</th>
              <th className="pb-2 pr-4">Created</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-500">
                  {licenses.length === 0 ? 'No licenses yet.' : 'No matching licenses.'}
                </td>
              </tr>
            ) : (
              filtered.map((license) => (
                <tr key={license.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3 pr-4 font-medium">{license.domain}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-400">{maskKey(license.license_key)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={license.status} /></td>
                  <td className="py-3 pr-4 text-gray-400">{license.expires_at ? formatDate(license.expires_at) : 'Perpetual'}</td>
                  <td className="py-3 pr-4 text-gray-400">{license.grace_period_days}d</td>
                  <td className="py-3 pr-4 text-gray-400">{formatDateTime(license.last_heartbeat_at)}</td>
                  <td className="py-3 pr-4 text-gray-400">{license.active_users}</td>
                  <td className="py-3 pr-4 text-gray-400">{formatDate(license.created_at)}</td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingLicense(license); setError('') }}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleSuspendToggle(license)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          license.status === 'suspended'
                            ? 'bg-green-800 hover:bg-green-700 text-green-200'
                            : 'bg-yellow-800 hover:bg-yellow-700 text-yellow-200'
                        }`}
                      >
                        {license.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => handleDelete(license)}
                        className="px-2 py-1 text-xs bg-red-800 hover:bg-red-700 rounded text-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
