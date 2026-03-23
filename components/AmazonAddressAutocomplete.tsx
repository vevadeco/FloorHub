'use client'

import { useState, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'

interface Props {
  apiKey: string
  region: string
  value: string
  onChange: (v: string) => void
}

export default function AmazonAddressAutocomplete({ apiKey, region, value, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input || input.length < 3 || !apiKey) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        // Amazon Location Service Places v2 — POST with API key in query string
        const url = `https://places.geo.${region}.amazonaws.com/v2/autocomplete?key=${encodeURIComponent(apiKey)}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            QueryText: input,
            MaxResults: 5,
            Filter: { IncludeCountries: ['CAN'] },
          }),
        })
        if (!res.ok) {
          console.error('[Amazon Autocomplete] HTTP', res.status, await res.text())
          setSuggestions([])
          return
        }
        const data = await res.json()
        // v2 response: { ResultItems: [{ Address: { Label }, PlaceId, ... }] }
        const results: string[] = (data.ResultItems ?? [])
          .map((r: { Address?: { Label?: string }; Title?: string }) =>
            r.Address?.Label ?? r.Title ?? ''
          )
          .filter(Boolean)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch (err) {
        console.error('[Amazon Autocomplete] error:', err)
        setSuggestions([])
      }
    }, 300)
  }, [apiKey, region])

  if (!apiKey) return (
    <Input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Start typing address..."
      autoComplete="off"
    />
  )

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); fetchSuggestions(e.target.value) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Start typing address..."
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-popover border rounded-md shadow-md mt-1 max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
              onMouseDown={() => { onChange(s); setOpen(false) }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
