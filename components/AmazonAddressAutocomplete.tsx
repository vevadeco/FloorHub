'use client'

// @ts-ignore — no types bundled yet for this SDK
import { AddressForm } from '@aws/address-form-sdk-js'

interface Props {
  apiKey: string
  region: string
  value: string
  onChange: (v: string) => void
}

export default function AmazonAddressAutocomplete({ apiKey, region, value, onChange }: Props) {
  const handleSubmit = async (getData: (opts: { intendedUse: any }) => Promise<any>) => {
    const data = await getData({ intendedUse: 'SingleUse' })
    const parts = [
      data?.addressLineOne,
      data?.city,
      data?.province,
      data?.postalCode,
      data?.country,
    ].filter(Boolean)
    if (parts.length > 0) onChange(parts.join(', '))
  }

  if (!apiKey) return (
    <input
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Enter address..."
    />
  )

  return (
    <div className="amazon-address-form-wrapper">
      <AddressForm
        apiKey={apiKey}
        region={region}
        allowedCountries={['CA']}
        showCurrentCountryResultsOnly
        onSubmit={handleSubmit}
      >
        {/* Typeahead input only — no map, no extra fields */}
        <input
          data-type="address-form"
          name="addressLineOne"
          aria-label="Address"
          placeholder="Start typing address..."
          data-api-name="suggest"
          data-show-current-location
          defaultValue={value}
          style={{ width: '100%' }}
        />
        <button data-type="address-form" type="submit" style={{ display: 'none' }} />
      </AddressForm>
    </div>
  )
}
