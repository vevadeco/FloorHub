# Design Document: Invoice Print Enhancements

## Overview

This feature delivers six targeted improvements to the invoice PDF and print workflow in FloorHub:

1. Fix the logo upload field name mismatch (`file` → `logo`) in the Settings page form
2. Verify logo rendering in the PDF (already partially implemented)
3. Add a Terms and Conditions field to Settings (DB, API, UI)
4. Render Terms and Conditions on invoice PDFs
5. Add a customer signature line to invoice PDFs
6. Add a Print Invoice button on the invoice detail page

All changes are surgical — no new routes, no new tables beyond a single column migration, and no new dependencies.

---

## Architecture

The feature touches four layers:

```
Settings Page (UI)
    │  form.append('logo', file)          ← fix field name
    │  <Textarea> for terms_and_conditions
    ▼
Settings API  (app/api/settings/route.ts)
    │  GET/PUT include terms_and_conditions
    ▼
PostgreSQL / Neon
    │  settings.terms_and_conditions TEXT DEFAULT ''
    ▼
PDF API  (app/api/invoices/[id]/pdf/route.ts)
    │  passes terms_and_conditions in settingsObj
    ▼
PDF Generator  (lib/pdf.ts)
    │  renders logo, T&C section, signature line
    ▼
Invoice Detail Page (UI)
    │  Print button → fetch PDF → new tab → window.print()
```

The logo upload path is a separate route (`app/api/settings/logo/route.ts`) that already reads the `logo` key correctly — only the client-side `form.append` call needs fixing.

---

## Components and Interfaces

### types/index.ts — Settings interface

Add one field:

```ts
terms_and_conditions: string
```

### lib/schema.ts — migration

Append one idempotent migration at the end of `initSchema`:

```ts
await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT DEFAULT ''`
```

### app/api/settings/route.ts — GET and PUT

**GET**: add `terms_and_conditions` to the empty-row fallback object.

**PUT**: destructure `terms_and_conditions` from the request body, include it in both the `INSERT` column list and the `ON CONFLICT DO UPDATE SET` clause.

### app/api/settings/logo/route.ts

No changes needed — already reads `formData.get('logo')` correctly.

### app/(dashboard)/settings/page.tsx

Two changes:
1. `form.append('file', file)` → `form.append('logo', file)`
2. Add a `<Textarea>` for `terms_and_conditions` inside the Company Information `<form>`, below the existing fields and above the Facebook section separator.

### lib/pdf.ts

Three additions to `InvoicePDF`:

1. **Logo rendering** — already implemented; verify the existing conditional renders `<Image>` when `logo_url` is truthy and falls back to `<Text>` with company name when falsy. No change needed if already correct.

2. **Terms and Conditions section** — rendered conditionally after the totals block:
   ```
   if (settings.terms_and_conditions) → View with heading + body text + light background
   ```

3. **Signature line** — rendered unconditionally after the T&C section (or after totals if T&C is absent), before the footer:
   ```
   View: flexDirection row
     Left: View (flex 2) — horizontal line + "Customer Signature" label
     Right: View (flex 1) — horizontal line + "Date" label
   ```

New style entries needed:
- `termsSection`: `marginTop: 20, padding: 12, backgroundColor: '#f9fafb', borderRadius: 4`
- `termsTitle`: `fontFamily: 'Helvetica-Bold', marginBottom: 6, fontSize: 10`
- `termsText`: `color: '#444', lineHeight: 1.5, fontSize: 9`
- `signatureSection`: `marginTop: 30, flexDirection: 'row', gap: 20`
- `signatureBlock`: `flex: 2`
- `signatureDateBlock`: `flex: 1`
- `signatureLine`: `borderTopWidth: 1, borderTopColor: '#333', marginBottom: 4`
- `signatureLabel`: `fontSize: 8, color: '#666'`

### app/api/invoices/[id]/pdf/route.ts

Add `terms_and_conditions` to `settingsObj`:

```ts
terms_and_conditions: settings.terms_and_conditions || '',
```

### app/(dashboard)/invoices/[id]/page.tsx

Add a `printingPDF` boolean state and a `handlePrintPDF` async function:

```ts
const handlePrintPDF = async () => {
  setPrintingPDF(true)
  try {
    const res = await fetch(`/api/invoices/${id}/pdf`)
    if (!res.ok) { toast.error('Failed to load PDF for printing'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const tab = window.open(url, '_blank')
    tab?.addEventListener('load', () => { tab.print(); URL.revokeObjectURL(url) })
  } finally {
    setPrintingPDF(false)
  }
}
```

Add a Print button in the action row (next to the existing PDF button):

```tsx
<Button variant="outline" onClick={handlePrintPDF} disabled={printingPDF}>
  {printingPDF ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
  Print
</Button>
```

Import `Printer` from `lucide-react`.

---

## Data Models

### Settings table — new column

| Column | Type | Default | Notes |
|---|---|---|---|
| `terms_and_conditions` | `TEXT` | `''` | Free-form legal/business terms printed on PDFs |

Migration is idempotent (`ADD COLUMN IF NOT EXISTS`) and runs on the next Settings API request via the existing lazy-migration pattern in `app/api/settings/route.ts`, and also in `lib/schema.ts` for fresh installs.

### Settings TypeScript interface (types/index.ts)

```ts
export interface Settings {
  // ... existing fields ...
  terms_and_conditions: string   // ← new
}
```

No other data model changes. The PDF is generated on-the-fly from existing invoice + settings data.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Logo API rejects invalid inputs

*For any* file upload where the MIME type is not `image/png`, `image/jpeg`, or `image/webp`, OR where the file size exceeds 2 MB, the Logo API SHALL return a 400 response.

**Validates: Requirements 1.5, 1.6**

### Property 2: PDF logo rendering is conditional on logo_url

*For any* Settings object, if `logo_url` is a non-empty string the PDF element tree SHALL contain an `<Image>` node in the header; if `logo_url` is empty the PDF element tree SHALL contain a `<Text>` node with the company name in the header instead.

**Validates: Requirements 2.1, 2.2**

### Property 3: Terms and Conditions persistence round-trip

*For any* string value of `terms_and_conditions`, saving it via the Settings API PUT and then retrieving it via the Settings API GET SHALL return the same string.

**Validates: Requirements 3.2, 3.3**

### Property 4: PDF renders T&C section iff terms_and_conditions is non-empty

*For any* Settings object, if `terms_and_conditions` is a non-empty string the PDF element tree SHALL contain a Terms and Conditions section; if it is empty or absent the PDF element tree SHALL not contain that section.

**Validates: Requirements 4.1, 4.2**

### Property 5: PDF always contains a signature section

*For any* invoice and Settings combination, the generated PDF element tree SHALL contain a signature section with a "Customer Signature" label and a "Date" label.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 6: Print button shows loading state during fetch

*For any* invocation of `handlePrintPDF`, the `printingPDF` state SHALL be `true` for the entire duration of the fetch and SHALL be `false` after the fetch resolves or rejects.

**Validates: Requirements 6.5**

---

## Error Handling

| Scenario | Handling |
|---|---|
| Logo upload — wrong MIME type | Logo API returns 400 `{ error: 'File must be PNG, JPEG, or WebP' }` |
| Logo upload — file too large | Logo API returns 400 `{ error: 'File must be 2 MB or smaller' }` |
| Logo upload — no file in FormData | Logo API returns 400 `{ error: 'No file provided' }` |
| Logo upload — unauthenticated | Logo API returns 401 |
| Logo upload — non-owner role | Logo API returns 403 |
| Settings PUT — unauthenticated | Settings API returns 401 |
| Settings PUT — non-owner role | Settings API returns 403 |
| PDF generation — invoice not found | PDF API returns 404 |
| PDF generation — unauthenticated | PDF API returns 401 |
| Print button — PDF API error | Toast: "Failed to load PDF for printing" |
| Print button — new tab blocked by browser | URL is still created; print may not auto-trigger but PDF is accessible |

The `terms_and_conditions` field is optional — a null/undefined value from the DB is coerced to `''` in both the API response and the `settingsObj` construction in the PDF route, so the PDF generator always receives a string.

---

## Testing Strategy

### Unit tests

Focus on specific examples and edge cases:

- **Logo API**: send FormData with key `logo` → 200; send with key `file` → 400 (no file found)
- **Logo API**: send a GIF → 400; send a 3 MB PNG → 400; send a valid 1 MB JPEG → 200
- **Settings API GET**: returns `terms_and_conditions: ''` when row is absent
- **Settings API PUT**: persists `terms_and_conditions` and returns it in the response
- **PDF generator**: with `logo_url = ''` → header contains company name text, no Image element
- **PDF generator**: with `logo_url = 'https://...'` → header contains Image element
- **PDF generator**: with `terms_and_conditions = ''` → no T&C section in element tree
- **PDF generator**: with `terms_and_conditions = 'Pay within 30 days'` → T&C section present with heading and body
- **PDF generator**: signature section always present regardless of T&C content
- **Invoice detail page**: Print button present in action row
- **Invoice detail page**: clicking Print while fetch is pending → button shows Loader2 icon

### Property-based tests

Use a property-based testing library (e.g., `fast-check` for TypeScript) with a minimum of 100 iterations per property.

Each test is tagged with the feature and property number it validates.

**Property 1 — Logo API rejects invalid inputs**
```
// Feature: invoice-print-enhancements, Property 1: Logo API rejects invalid inputs
// Generate random MIME types not in the allowed list, verify 400 response
// Generate random file sizes > 2MB, verify 400 response
```

**Property 2 — PDF logo rendering is conditional on logo_url**
```
// Feature: invoice-print-enhancements, Property 2: PDF logo rendering is conditional on logo_url
// For any arbitrary Settings with non-empty logo_url: element tree contains Image in header
// For any arbitrary Settings with empty logo_url: element tree contains Text (company name) in header
```

**Property 3 — Terms and Conditions persistence round-trip**
```
// Feature: invoice-print-enhancements, Property 3: T&C persistence round-trip
// For any arbitrary string: PUT terms_and_conditions, GET settings, assert values match
```

**Property 4 — PDF renders T&C section iff non-empty**
```
// Feature: invoice-print-enhancements, Property 4: PDF T&C section conditional
// For any non-empty string: T&C section present in element tree
// For empty string: T&C section absent from element tree
```

**Property 5 — PDF always contains signature section**
```
// Feature: invoice-print-enhancements, Property 5: PDF always contains signature section
// For any Invoice + Settings: element tree contains signature section with required labels
```

**Property 6 — Print button loading state**
```
// Feature: invoice-print-enhancements, Property 6: Print button loading state
// For any fetch duration: printingPDF is true during fetch, false after resolution
```
