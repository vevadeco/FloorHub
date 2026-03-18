# Implementation Plan: FloorHub Next.js Migration

## Overview

Migrate FloorHub from Python FastAPI + React CRA to a single Next.js 14 App Router TypeScript application. Tasks are ordered so each step builds on the previous, ending with full integration and cleanup.

## Tasks

- [x] 1. Scaffold Next.js 14 project with TypeScript, Tailwind, and shadcn/ui
  - Run `npx create-next-app@14` with TypeScript, Tailwind, App Router, and `src/` disabled
  - Install dependencies: `@vercel/postgres`, `@vercel/blob`, `jose`, `bcryptjs`, `@types/bcryptjs`, `fast-check`, `vitest`, `@react-pdf/renderer`, `resend`, `stripe`, `fast-check`
  - Copy `frontend/tailwind.config.js` → `tailwind.config.ts` and `frontend/components.json` → `components.json`
  - Copy all `frontend/src/components/ui/` shadcn components into `components/ui/`
  - Create `types/index.ts` with `Role`, `JWTPayload`, `InvoiceItem`, `Invoice`, `Commission` types
  - Create `vitest.config.ts` targeting `__tests__/**/*.test.ts`
  - _Requirements: 1.1, 1.4_

- [x] 2. Database schema and startup instrumentation
  - [x] 2.1 Create `lib/schema.ts` with `initSchema()` — all 13 `CREATE TABLE IF NOT EXISTS` statements plus `ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url`
    - _Requirements: 1.3, 25.1, 25.2_
  - [x] 2.2 Create `instrumentation.ts` exporting `register()` that calls `initSchema()`
    - _Requirements: 25.3_
  - [ ]* 2.3 Write unit test for schema initialization
    - Verify all 13 tables exist after `initSchema()` runs against a test DB
    - _Requirements: 25.1_

- [x] 3. Auth library
  - [x] 3.1 Create `lib/auth.ts` with `signToken`, `verifyToken`, `getAuthUser`, `setAuthCookie`, `clearAuthCookie` using `jose` and `JWT_SECRET` env var; 24-hour expiry
    - _Requirements: 2.1, 2.3, 2.7, 2.8_
  - [ ]* 3.2 Write property test for JWT round-trip (Property 3)
    - **Property 3: JWT round-trip**
    - **Validates: Requirements 2.1, 2.3, 2.7**

- [x] 4. Middleware
  - Create `middleware.ts` at project root with matcher `/((?!api|_next/static|_next/image|favicon.ico).*)`
  - No-cookie or invalid JWT → redirect `/login`
  - `role === 'employee'` and path not `/invoices` or `/invoices/*` → redirect `/invoices`
  - Owner → `NextResponse.next()`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ]* 4.1 Write property test for employee middleware redirect (Property 8)
    - **Property 8: Middleware redirects employees away from non-invoice routes**
    - **Validates: Requirements 6.3**

- [x] 5. Auth API routes
  - [x] 5.1 Create `app/api/auth/setup-status/route.ts` — `GET` returns `{ setupRequired: boolean }` based on user count
    - _Requirements: 3.1_
  - [x] 5.2 Create `app/api/auth/register/route.ts` — `POST` creates owner; returns 403 if users exist; bcrypt password; license check via `LICENSE_SERVER_URL`
    - _Requirements: 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 5.3 Create `app/api/auth/login/route.ts` — `POST` bcrypt compare, sign JWT, set HTTP-only cookie
    - _Requirements: 2.1, 2.2_
  - [x] 5.4 Create `app/api/auth/logout/route.ts` — `POST` clears cookie with `Max-Age=0`
    - _Requirements: 2.6_
  - [x] 5.5 Create `app/api/auth/me/route.ts` — `GET` returns current user from JWT
    - _Requirements: 2.3_
  - [x] 5.6 Create `app/api/auth/change-password/route.ts` — `POST` verifies current password, bcrypt new password; 401 on mismatch
    - _Requirements: 23.5, 23.6_
  - [ ]* 5.7 Write property test for setup-status reflects user count (Property 9)
    - **Property 9: Setup-status reflects user count**
    - **Validates: Requirements 3.1**
  - [ ]* 5.8 Write property test for registration blocked when users exist (Property 13)
    - **Property 13: Registration blocked when users exist**
    - **Validates: Requirements 3.4**
  - [ ]* 5.9 Write property test for protected routes reject absent/invalid tokens (Property 6)
    - **Property 6: Protected routes reject absent or invalid tokens**
    - **Validates: Requirements 2.4, 2.5**
  - [ ]* 5.10 Write unit tests for auth flows
    - Login success/failure, logout, setup flow detection, change-password wrong current password
    - _Requirements: 2.1, 2.6, 3.1, 23.6_

- [ ] 6. Checkpoint — Ensure all auth tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Core API routes — products, customers, invoices
  - [x] 7.1 Create `app/api/products/route.ts` (`GET`, `POST`) and `app/api/products/[id]/route.ts` (`PUT`, `DELETE`); employee DELETE → 403
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 7.2 Create `app/api/customers/route.ts` (`GET`, `POST`) and `app/api/customers/[id]/route.ts` (`PUT`, `DELETE`); employee DELETE → 403
    - _Requirements: 14.1, 14.3_
  - [x] 7.3 Create `app/api/invoices/route.ts` (`GET`, `POST`) and `app/api/invoices/[id]/route.ts` (`GET`, `PUT`, `DELETE`); `boxes_needed = ceil(sqft_needed / sqft_per_box)`; auto-generate invoice number `INV-YYYYMM-NNNN` / `EST-YYYYMM-NNNN`; trigger commission on status → `paid`; employee DELETE → 403
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.7, 14.2_
  - [x] 7.4 Create `app/api/invoices/[id]/convert-to-invoice/route.ts` — `POST` creates new invoice from estimate
    - _Requirements: 10.5_
  - [ ]* 7.5 Write property test for box calculation ceiling (Property 1)
    - **Property 1: Box calculation ceiling**
    - **Validates: Requirements 10.2**
  - [ ]* 7.6 Write property test for invoice number format (Property 12)
    - **Property 12: Invoice number format**
    - **Validates: Requirements 10.3**
  - [ ]* 7.7 Write property test for employee role restriction on write/delete endpoints (Property 7)
    - **Property 7: Employee role restriction on write/delete/restricted endpoints**
    - **Validates: Requirements 9.3, 10.6, 14.3**
  - [ ]* 7.8 Write unit tests for invoice CRUD and commission trigger
    - Invoice creation, number format for known date, commission triggered on paid status, customer upsert
    - _Requirements: 10.2, 10.3, 10.4, 14.2_

- [x] 8. PDF generation and invoice PDF route
  - [x] 8.1 Create `lib/pdf.ts` with `generateInvoicePDF(invoice, settings): Promise<Buffer>` using `@react-pdf/renderer`; embed logo if `logo_url` present
    - _Requirements: 1.5, 11.1, 11.2_
  - [x] 8.2 Create `app/api/invoices/[id]/pdf/route.ts` — `GET` returns PDF with correct `Content-Type` and `Content-Disposition` headers
    - _Requirements: 11.3_
  - [x] 8.3 Create `app/api/invoices/[id]/send-email/route.ts` — `POST` generates PDF, sends via Resend; 400 if no customer email; 502 on Resend error
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [ ]* 8.4 Write property test for PDF generation never produces empty output (Property 5)
    - **Property 5: PDF generation never produces empty output**
    - **Validates: Requirements 11.4**

- [x] 9. Stripe and manual payment routes
  - Create `app/api/invoices/[id]/create-checkout/route.ts` — `POST` creates Stripe Checkout Session
  - Create `app/api/invoices/[id]/payment-status/route.ts` — `GET` returns Stripe payment status
  - Create `app/api/invoices/[id]/manual-payment/route.ts` — `POST` records manual payment
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 10. Remaining core API routes
  - [x] 10.1 Create leads routes: `app/api/leads/route.ts` (`GET`, `POST`), `app/api/leads/[id]/route.ts` (`PUT`, `DELETE`), `app/api/leads/facebook-webhook/route.ts` (`POST`); employee DELETE → 403
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  - [x] 10.2 Create expenses routes: `app/api/expenses/route.ts` (`GET`, `POST`), `app/api/expenses/[id]/route.ts` (`PUT`, `DELETE`); employee DELETE → 403
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  - [x] 10.3 Create contractors routes: `app/api/contractors/route.ts` (`GET`, `POST`), `app/api/contractors/[id]/route.ts` (`PUT`, `DELETE`); employee write/delete → 403
    - _Requirements: 17.1, 17.2, 17.3_
  - [x] 10.4 Create users routes: `app/api/users/route.ts` (`GET`), `app/api/users/create-employee/route.ts` (`POST`), `app/api/users/[id]/route.ts` (`DELETE`), `app/api/users/[id]/commission-rate/route.ts` (`PUT`); employee → 403; owner delete → 403; commission_rate 0–100 validation
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_
  - [x] 10.5 Create commissions routes: `app/api/commissions/route.ts` (`GET`), `app/api/commissions/[id]/mark-paid/route.ts` (`POST`), `app/api/commissions/[id]/mark-unpaid/route.ts` (`POST`); employee → 403
    - _Requirements: 19.3, 19.4_
  - [x] 10.6 Create messages routes: `app/api/messages/route.ts` (`GET`, `POST`), `app/api/messages/unread-count/route.ts` (`GET`), `app/api/messages/[id]/mark-read/route.ts` (`POST`); employee POST → 403
    - _Requirements: 20.1, 20.2, 20.3, 20.4_
  - [x] 10.7 Create reports routes: `app/api/reports/financial/route.ts` (`GET`), `app/api/reports/transactions/route.ts` (`GET`); employee → 403
    - _Requirements: 21.1, 21.2, 21.3_
  - [x] 10.8 Create analytics route: `app/api/analytics/route.ts` (`GET`); employee → 403
    - _Requirements: 22.1, 22.2_
  - [x] 10.9 Create dashboard stats route: `app/api/dashboard/stats/route.ts` (`GET`)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 10.10 Create address routes: `app/api/address/suggestions/route.ts` (`GET`), `app/api/address/states/route.ts` (`GET`); empty array if query < 2 chars
    - _Requirements: 24.1, 24.2, 24.3_
  - [ ]* 10.11 Write property test for commission formula non-negativity (Property 2)
    - **Property 2: Commission formula non-negativity and correctness**
    - **Validates: Requirements 19.1**
  - [ ]* 10.12 Write unit tests for commissions, reports, and messages
    - Commission calculation examples, report date range filtering, unread count
    - _Requirements: 19.1, 19.2, 20.2, 21.1_

- [x] 11. Settings and logo upload routes
  - [x] 11.1 Create `app/api/settings/route.ts` (`GET`, `PUT`); employee PUT → 403
    - _Requirements: 23.1, 23.4_
  - [x] 11.2 Create `app/api/settings/logo/route.ts` (`POST`) — validate MIME type and size (≤2 MB), upload to Vercel Blob, persist URL; employee → 403
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 23.2, 23.3_
  - [ ]* 11.3 Write property test for logo upload file validation (Property 10)
    - **Property 10: Logo upload file validation**
    - **Validates: Requirements 7.3, 7.4**
  - [ ]* 11.4 Write unit tests for settings and logo upload
    - Valid upload, oversized file, wrong MIME type, password change wrong current password
    - _Requirements: 7.3, 7.4, 23.6_

- [ ] 12. Checkpoint — Ensure all API route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Layout and Sidebar
  - Create `components/layout/Sidebar.tsx` (client component) — role-aware nav; show only "Invoices" for employees; display `logo_url` image if set, else default text logo
  - Create `components/layout/TopBar.tsx`
  - Create `app/(dashboard)/layout.tsx` (server component) — reads auth cookie, redirects to `/login` if unauthenticated, renders Sidebar + TopBar
  - _Requirements: 6.6, 6.7, 7.5, 7.7_

- [x] 14. Login page
  - Create `app/(auth)/login/page.tsx` — calls `GET /api/auth/setup-status`; renders Setup_Flow registration form when `setupRequired`, else login form; posts to `/api/auth/register` or `/api/auth/login`
  - _Requirements: 3.2, 4.1_

- [x] 15. Dashboard and core pages
  - [x] 15.1 Create `app/(dashboard)/page.tsx` — fetches `/api/dashboard/stats`, renders metrics, recent invoices, recent leads
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 15.2 Create `app/(dashboard)/inventory/page.tsx` — searchable/filterable product table, create/edit/delete product forms
    - _Requirements: 9.4_
  - [x] 15.3 Create `app/(dashboard)/customers/page.tsx` — customer list, create/edit/delete
    - _Requirements: 14.1_
  - [x] 15.4 Create `app/(dashboard)/invoices/page.tsx` — invoice/estimate list with `is_estimate` filter toggle
    - _Requirements: 10.7_
  - [x] 15.5 Create `app/(dashboard)/invoices/[id]/page.tsx` — invoice detail: line items, PDF download, send email, Stripe checkout, manual payment, convert-to-invoice, status update
    - _Requirements: 10.4, 10.5, 11.3, 12.1, 13.1, 13.4_
  - [x] 15.6 Create `app/(dashboard)/leads/page.tsx` — lead list, create/edit/delete, status and source filters
    - _Requirements: 15.2, 15.3_
  - [x] 15.7 Create `app/(dashboard)/expenses/page.tsx` — expense list, create/edit/delete, category and payment method filters
    - _Requirements: 16.2, 16.3_
  - [x] 15.8 Create `app/(dashboard)/contractors/page.tsx` — contractor list, create/edit/delete (owner only)
    - _Requirements: 17.2, 17.3_
  - [x] 15.9 Create `app/(dashboard)/employees/page.tsx` — employee list, create employee, delete, set commission rate (owner only)
    - _Requirements: 18.1, 18.2, 18.5_
  - [x] 15.10 Create `app/(dashboard)/commissions/page.tsx` — commission list, mark paid/unpaid (owner only)
    - _Requirements: 19.3_
  - [x] 15.11 Create `app/(dashboard)/messages/page.tsx` — message list, unread badge, mark read, post message (owner only)
    - _Requirements: 20.1, 20.2, 20.3_
  - [x] 15.12 Create `app/(dashboard)/reports/page.tsx` — financial and transaction reports with date range picker
    - _Requirements: 21.1, 21.2_
  - [x] 15.13 Create `app/(dashboard)/analytics/page.tsx` — monthly revenue chart, top products, lead conversion, expense breakdown
    - _Requirements: 22.1_
  - [x] 15.14 Create `app/(dashboard)/settings/page.tsx` — company info form, tax rate, Facebook credentials, logo upload control, change password form
    - _Requirements: 23.1, 23.5, 7.1_

- [x] 16. License server application
  - [x] 16.1 Scaffold `license-server/` as a separate Next.js 14 TypeScript app
    - _Requirements: 5.1_
  - [x] 16.2 Create `license-server/lib/db.ts` with `initSchema()` creating `licensed_domains` table
    - _Requirements: 5.2_
  - [x] 16.3 Create `license-server/app/api/check-license/route.ts` — `POST { domain }` → `{ licensed: bool }` lookup
    - _Requirements: 5.3_
  - [x] 16.4 Create `license-server/app/api/admin/domains/route.ts` — `POST` add domain; `ADMIN_SECRET` header required; 401 if missing/wrong
    - _Requirements: 5.4, 5.6, 5.7_
  - [x] 16.5 Create `license-server/app/api/admin/domains/[domain]/route.ts` — `DELETE` remove domain; same `ADMIN_SECRET` guard
    - _Requirements: 5.5, 5.6_
  - [ ]* 16.6 Write property test for license check domain lookup (Property 11)
    - **Property 11: License check domain lookup**
    - **Validates: Requirements 5.3**
  - [ ]* 16.7 Write property test for domain extraction from email (Property 4)
    - **Property 4: Domain extraction from email**
    - **Validates: Requirements 4.1**

- [ ] 17. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Remove old directories
  - Delete `frontend/` directory
  - Delete `backend/` directory
  - _Requirements: 1.8_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with minimum 100 iterations per the design spec
- All Route Handlers follow the error-handling pattern in the design doc (AuthError → 401, ForbiddenError → 403, ValidationError → 400)
