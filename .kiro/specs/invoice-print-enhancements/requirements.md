# Requirements Document

## Introduction

This feature enhances the invoice print and PDF experience in FloorHub. The enhancements include: adding a customer signature line to printed/PDF invoices, adding a configurable Terms and Conditions field in Settings that appears on invoice PDFs, adding a browser Print button on the invoice detail page, and fixing the logo upload bug where the settings page sends the file under the key `file` but the logo API route reads the key `logo`.

## Glossary

- **Invoice_Detail_Page**: The Next.js page at `/invoices/[id]` that displays a single invoice with its line items, totals, and action buttons.
- **PDF_Generator**: The `generateInvoicePDF` function in `lib/pdf.ts` that uses `@react-pdf/renderer` to produce a PDF buffer.
- **PDF_API**: The Next.js API route at `app/api/invoices/[id]/pdf/route.ts` that fetches invoice and settings data and calls the PDF_Generator.
- **Settings_Page**: The Next.js page at `/settings` that allows owners to configure company information and integrations.
- **Settings_API**: The Next.js API routes under `app/api/settings/` that read and write the `settings` table.
- **Logo_API**: The Next.js API route at `app/api/settings/logo/route.ts` that handles logo file uploads to Vercel Blob.
- **Settings**: The single-row database record (`id = 'company_settings'`) and its corresponding TypeScript type in `types/index.ts`.
- **Signature_Line**: A printed section at the bottom of an invoice containing a horizontal line and label for the customer to physically sign.
- **Terms_And_Conditions**: A free-text field stored in Settings that contains legal or business terms to be printed on invoice PDFs.

---

## Requirements

### Requirement 1: Fix Logo Upload Field Name Mismatch

**User Story:** As an owner, I want to upload a company logo in Settings, so that the logo appears correctly on invoice PDFs.

#### Acceptance Criteria

1. WHEN an owner submits a logo file on the Settings_Page, THE Settings_Page SHALL send the file in the `FormData` object under the key `logo`.
2. WHEN the Logo_API receives a `POST` request, THE Logo_API SHALL read the uploaded file from the `FormData` key `logo`.
3. WHEN a logo is successfully uploaded, THE Logo_API SHALL return a JSON response containing the `logo_url` field with the public Vercel Blob URL.
4. WHEN a logo is successfully uploaded, THE Settings_Page SHALL update the displayed logo preview to show the newly uploaded image without a full page reload.
5. IF the uploaded file is not PNG, JPEG, or WebP, THEN THE Logo_API SHALL return a 400 error with a descriptive message.
6. IF the uploaded file exceeds 2 MB, THEN THE Logo_API SHALL return a 400 error with a descriptive message.

---

### Requirement 2: Display Logo on Invoice PDF

**User Story:** As an owner, I want the company logo to appear on generated invoice PDFs, so that invoices look professional and branded.

#### Acceptance Criteria

1. WHEN the PDF_API generates an invoice PDF and `settings.logo_url` is a non-empty string, THE PDF_Generator SHALL render the logo image in the top-left header area of the PDF.
2. WHEN the PDF_API generates an invoice PDF and `settings.logo_url` is an empty string, THE PDF_Generator SHALL render the company name as text in the top-left header area instead of a logo image.
3. WHEN the PDF_Generator renders a logo, THE PDF_Generator SHALL constrain the logo to a maximum width of 80 points and maximum height of 40 points while preserving aspect ratio.

---

### Requirement 3: Add Terms and Conditions to Settings

**User Story:** As an owner, I want to enter Terms and Conditions text in Settings, so that the terms are automatically printed on every invoice PDF.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a multi-line text area labeled "Terms and Conditions" within the Company Information section.
2. WHEN an owner saves the Settings_Page form, THE Settings_API SHALL persist the `terms_and_conditions` value to the `settings` database table.
3. WHEN the Settings_Page loads, THE Settings_Page SHALL populate the Terms and Conditions text area with the value stored in the database.
4. THE Settings type in `types/index.ts` SHALL include a `terms_and_conditions` field of type `string`.
5. WHEN the PDF_API fetches settings to generate a PDF, THE PDF_API SHALL include the `terms_and_conditions` value in the Settings object passed to the PDF_Generator.

---

### Requirement 4: Print Terms and Conditions on Invoice PDF

**User Story:** As an owner, I want the Terms and Conditions to appear on the invoice PDF, so that customers are informed of the business terms when they receive an invoice.

#### Acceptance Criteria

1. WHEN `settings.terms_and_conditions` is a non-empty string, THE PDF_Generator SHALL render a "Terms and Conditions" section below the invoice totals and above the signature line.
2. WHEN `settings.terms_and_conditions` is an empty string, THE PDF_Generator SHALL omit the Terms and Conditions section from the PDF.
3. WHEN the PDF_Generator renders the Terms and Conditions section, THE PDF_Generator SHALL display the full text with a section heading and a visually distinct background.

---

### Requirement 5: Add Signature Line to Invoice PDF

**User Story:** As an owner, I want a signature line printed at the bottom of invoice PDFs, so that customers can physically sign the document to acknowledge the work.

#### Acceptance Criteria

1. THE PDF_Generator SHALL render a signature section near the bottom of every invoice PDF page.
2. THE PDF_Generator SHALL render the signature section as a horizontal line with the label "Customer Signature" below it.
3. THE PDF_Generator SHALL render a "Date" field adjacent to the signature line so the customer can record the date of signing.
4. WHEN the PDF_Generator renders the signature section, THE PDF_Generator SHALL position the signature section below the Terms and Conditions section (if present) and above the page footer.

---

### Requirement 6: Add Print Invoice Button on Invoice Detail Page

**User Story:** As an owner, I want a "Print Invoice" button on the invoice detail page, so that I can print an invoice directly from the browser without downloading a PDF file.

#### Acceptance Criteria

1. THE Invoice_Detail_Page SHALL display a "Print" button in the action button row alongside the existing PDF download, Email, and Record Payment buttons.
2. WHEN an owner clicks the Print button, THE Invoice_Detail_Page SHALL fetch the invoice PDF from the PDF_API and open it in a new browser tab.
3. WHEN the PDF is opened in the new browser tab, THE Invoice_Detail_Page SHALL trigger the browser's native print dialog automatically.
4. IF the PDF_API returns an error when the Print button is clicked, THEN THE Invoice_Detail_Page SHALL display a toast error notification with the message "Failed to load PDF for printing".
5. WHILE the PDF is being fetched after the Print button is clicked, THE Invoice_Detail_Page SHALL display a loading indicator on the Print button.
