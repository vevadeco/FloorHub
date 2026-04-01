# Implementation Plan: Invoice Print Enhancements

## Overview

Surgical changes across seven files: fix the logo upload field name, add `terms_and_conditions` to the DB/API/type/UI, render T&C and a signature line in the PDF generator, and add a Print button on the invoice detail page.

## Tasks

- [x] 1. Add `terms_and_conditions` to the Settings TypeScript interface
  - In `types/index.ts`, add `terms_and_conditions: string` to the `Settings` interface
  - _Requirements: 3.4_

- [x] 2. Add DB migration for `terms_and_conditions`
  - [x] 2.1 Add migration to `lib/schema.ts`
    - Append `await sql\`ALTER TABLE settings ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT DEFAULT ''\`` at the end of `initSchema`, following the existing migration pattern
    - _Requirements: 3.2_

- [x] 3. Update Settings API to include `terms_and_conditions`
  - [x] 3.1 Update `app/api/settings/route.ts` GET handler
    - Add `await sql\`ALTER TABLE settings ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT DEFAULT ''\`` to the lazy-migration block in GET
    - Add `terms_and_conditions: ''` to the empty-row fallback object
    - _Requirements: 3.2, 3.3_
  - [x] 3.2 Update `app/api/settings/route.ts` PUT handler
    - Add the same `ALTER TABLE` migration to the lazy-migration block in PUT
    - Destructure `terms_and_conditions = ''` from the request body
    - Add `terms_and_conditions` to the `INSERT` column list and `VALUES` list
    - Add `terms_and_conditions=${terms_and_conditions}` to the `ON CONFLICT DO UPDATE SET` clause
    - _Requirements: 3.2_
  - [ ]* 3.3 Write property test for T&C persistence round-trip
    - **Property 3: Terms and Conditions persistence round-trip**
    - **Validates: Requirements 3.2, 3.3**
    - For any arbitrary string value, PUT `terms_and_conditions` then GET settings and assert the returned value matches

- [x] 4. Fix logo upload field name and add T&C textarea in Settings page
  - [x] 4.1 Fix `form.append('file', file)` → `form.append('logo', file)` in `app/(dashboard)/settings/page.tsx`
    - In `handleLogoUpload`, change `form.append('file', file)` to `form.append('logo', file)`
    - _Requirements: 1.1_
  - [x] 4.2 Add `terms_and_conditions` Textarea to the Company Information form
    - Import `Textarea` from `@/components/ui/textarea` (already imported elsewhere in the file)
    - Add a `<div className="space-y-2">` with `<Label>Terms and Conditions</Label>` and a `<Textarea>` bound to `settings.terms_and_conditions`
    - Place it below the Address field and above the first `<Separator />`
    - _Requirements: 3.1, 3.3_

- [ ] 5. Checkpoint — verify logo upload and settings save work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Pass `terms_and_conditions` through the PDF API route
  - In `app/api/invoices/[id]/pdf/route.ts`, add `terms_and_conditions: settings.terms_and_conditions || ''` to the `settingsObj` construction
  - _Requirements: 3.5_

- [x] 7. Add T&C section styles and rendering to the PDF generator
  - [x] 7.1 Add new style entries to `StyleSheet.create` in `lib/pdf.ts`
    - Add `termsSection`, `termsTitle`, `termsText`, `signatureSection`, `signatureBlock`, `signatureDateBlock`, `signatureLine`, `signatureLabel` as specified in the design
    - _Requirements: 4.3, 5.1, 5.2, 5.3_
  - [x] 7.2 Render the T&C section conditionally in `InvoicePDF`
    - After the totals block (and after the notes block if present), add a conditional render: if `settings.terms_and_conditions` is non-empty, render a `View` with `termsSection` style containing a bold heading "Terms and Conditions" and a `Text` with the T&C body
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ]* 7.3 Write property test for T&C section conditional rendering
    - **Property 4: PDF renders T&C section iff terms_and_conditions is non-empty**
    - **Validates: Requirements 4.1, 4.2**
    - For any non-empty string: assert T&C section present in element tree; for empty string: assert absent
  - [x] 7.4 Render the signature line unconditionally in `InvoicePDF`
    - After the T&C block (or after totals/notes if T&C is absent), add a `View` with `signatureSection` style containing two child `View`s: left (`signatureBlock`, flex 2) with a `signatureLine` `View` and "Customer Signature" label; right (`signatureDateBlock`, flex 1) with a `signatureLine` `View` and "Date" label
    - Place this before the footer `Text`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 7.5 Write property test for signature section always present
    - **Property 5: PDF always contains a signature section**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - For any Invoice + Settings combination, assert element tree contains signature section with "Customer Signature" and "Date" labels
  - [ ]* 7.6 Write property test for PDF logo rendering conditional on logo_url
    - **Property 2: PDF logo rendering is conditional on logo_url**
    - **Validates: Requirements 2.1, 2.2**
    - For non-empty `logo_url`: assert `Image` node present in header; for empty `logo_url`: assert `Text` with company name present instead

- [x] 8. Add Print button to the invoice detail page
  - [x] 8.1 Add `printingPDF` state and `handlePrintPDF` function in `app/(dashboard)/invoices/[id]/page.tsx`
    - Add `const [printingPDF, setPrintingPDF] = useState(false)` alongside existing state declarations
    - Implement `handlePrintPDF` as specified in the design: fetch PDF, create blob URL, open new tab, attach `load` listener to call `tab.print()` and revoke URL, show toast on error, always reset `printingPDF` in `finally`
    - Import `Printer` from `lucide-react`
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  - [x] 8.2 Add the Print button to the action row
    - Insert a `<Button variant="outline" onClick={handlePrintPDF} disabled={printingPDF}>` with `Printer` / `Loader2` icon and "Print" label, placed next to the existing PDF download button
    - _Requirements: 6.1, 6.5_
  - [ ]* 8.3 Write property test for Print button loading state
    - **Property 6: Print button shows loading state during fetch**
    - **Validates: Requirements 6.5**
    - For any fetch duration, assert `printingPDF` is `true` during fetch and `false` after resolution or rejection

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with a minimum of 100 iterations per property
