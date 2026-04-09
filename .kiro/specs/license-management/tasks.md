# Implementation Plan: License Management

## Overview

Enhance the existing FloorHub License Server with full license lifecycle management (expiration, keys, grace periods, status tracking), an admin dashboard UI, enhanced license check API, and integrate license validation into the main FloorHub app at login, middleware, and settings. The license server is a separate Next.js app in `license-server/`. The main FloorHub app only receives login check enhancement, middleware check, a license banner component, and a settings status card.

## Tasks

- [x] 1. Fix initSchema export and create new licenses table schema
  - [x] 1.1 Rewrite `license-server/lib/db.ts` to export `initSchema()` that creates the `licenses` table with all required columns (id, domain, license_key, expires_at, status, grace_period_days, notes, last_heartbeat_at, active_users, created_at, updated_at) and migrates existing `licensed_domains` rows into the new table, then drops the old table
    - Include a `generateLicenseKey()` helper that produces a cryptographically random string of at least 32 characters
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.4_
  - [x] 1.2 Update `license-server/instrumentation.ts` to call `initSchema()` with proper error handling — log and throw on failure
    - _Requirements: 1.2, 1.3_

- [x] 2. Implement enhanced license check API
  - [x] 2.1 Rewrite `license-server/app/api/check-license/route.ts` to return detailed license status (active, grace_period, expired, suspended, not_found) based on the license record's `expires_at`, `grace_period_days`, and `status` fields
    - Accept `{ domain, active_users? }` in request body
    - Update `last_heartbeat_at` and `active_users` on the license record when provided
    - Handle perpetual licenses (null `expires_at`) as always active
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.2_
  - [ ]* 2.2 Write property test for license status computation (Property 3)
    - **Property 3: License status computation**
    - Generate random `expires_at` and `grace_period_days` values relative to "now", verify the status computation returns the correct status (active/grace_period/expired)
    - **Validates: Requirements 2.3, 3.1, 3.2, 3.3, 3.6, 11.1, 11.2**
  - [ ]* 2.3 Write property test for suspended license check (Property 4)
    - **Property 4: Suspended license check**
    - Generate random suspended licenses, verify check always returns `{ licensed: false, status: "suspended" }`
    - **Validates: Requirements 3.4**
  - [ ]* 2.4 Write property test for heartbeat updates (Property 5)
    - **Property 5: Heartbeat updates usage data**
    - Generate random `active_users` counts, verify `last_heartbeat_at` and `active_users` are updated on the license record
    - **Validates: Requirements 6.2**

- [x] 3. Implement admin API for license CRUD
  - [x] 3.1 Create `license-server/app/api/admin/licenses/route.ts` with GET (list all) and POST (create new license with generated key) endpoints, protected by `x-admin-secret` header
    - POST returns the full record including the generated license key
    - Return 409 on duplicate domain
    - _Requirements: 9.1, 9.2, 9.7_
  - [x] 3.2 Create `license-server/app/api/admin/licenses/[id]/route.ts` with PUT (update fields: expires_at, grace_period_days, status, notes) and DELETE (permanently remove) endpoints, protected by `x-admin-secret` header
    - Return 404 for non-existent license
    - Return 400 for invalid status values
    - _Requirements: 9.3, 9.4, 9.7_
  - [x] 3.3 Create `license-server/app/api/admin/licenses/[id]/suspend/route.ts` (PATCH) and `license-server/app/api/admin/licenses/[id]/reactivate/route.ts` (PATCH), both protected by `x-admin-secret` header
    - _Requirements: 9.5, 9.6, 9.7_
  - [ ]* 3.4 Write property test for license record round-trip (Property 1)
    - **Property 1: License record round-trip**
    - Generate random domains and optional expiration dates, create via API, read back, verify all fields match
    - **Validates: Requirements 2.1, 9.1**
  - [ ]* 3.5 Write property test for license key minimum length (Property 2)
    - **Property 2: License key minimum length**
    - Generate N licenses, verify all keys are ≥32 characters and unique
    - **Validates: Requirements 2.2**
  - [ ]* 3.6 Write property test for suspend/reactivate round-trip (Property 6)
    - **Property 6: Suspend and reactivate round-trip**
    - Generate random active licenses, suspend then reactivate, verify status returns to active
    - **Validates: Requirements 8.5, 8.6, 9.5, 9.6**
  - [ ]* 3.7 Write property test for delete removes license (Property 7)
    - **Property 7: Delete removes license**
    - Generate random licenses, delete, verify not found on list and check endpoints
    - **Validates: Requirements 8.7, 9.4**
  - [ ]* 3.8 Write property test for admin API auth rejection (Property 9)
    - **Property 9: Admin API rejects unauthorized requests**
    - Generate random invalid secrets, verify 401 on all admin endpoints
    - **Validates: Requirements 9.7**
  - [ ]* 3.9 Write property test for license update persistence (Property 10)
    - **Property 10: License update persists fields**
    - Generate random update payloads, verify fields persist and unchanged fields are preserved
    - **Validates: Requirements 9.3**
  - [ ]* 3.10 Write property test for list returns all licenses (Property 12)
    - **Property 12: List returns all licenses**
    - Generate N random licenses, verify GET returns exactly N records
    - **Validates: Requirements 9.2**

- [x] 4. Checkpoint — License server API complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement admin dashboard authentication (license-server)
  - [x] 5.1 Create `license-server/lib/auth.ts` with `createAdminSession()`, `verifyAdminSession()`, and `ADMIN_COOKIE_NAME` — uses HMAC to sign/verify a session cookie against `ADMIN_SECRET` env var
    - _Requirements: 7.2, 7.3_
  - [x] 5.2 Create `license-server/app/api/admin/auth/route.ts` with POST (login — validate secret, set session cookie) and DELETE (logout — clear cookie)
    - _Requirements: 7.2, 7.5_
  - [x] 5.3 Create `license-server/middleware.ts` to protect `/dashboard` routes — redirect to `/` if no valid admin session cookie
    - _Requirements: 7.4_

- [x] 6. Build admin dashboard UI (license-server)
  - [x] 6.1 Add Tailwind CSS to the license server — install `tailwindcss`, `postcss`, `autoprefixer`, create `tailwind.config.ts` and `postcss.config.mjs`, add `globals.css`, update `license-server/app/layout.tsx` to import it
    - _Requirements: 8.1 (prerequisite for styled UI)_
  - [x] 6.2 Create `license-server/app/page.tsx` as the admin login page — simple form with "Admin Secret" password field, posts to `/api/admin/auth`, redirects to `/dashboard` on success, shows error on failure
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 6.3 Create `license-server/app/dashboard/layout.tsx` — verifies admin session server-side, redirects to `/` if invalid, renders nav bar with "Licenses" and "Logout" links
    - _Requirements: 7.4, 7.5_
  - [x] 6.4 Create `license-server/app/dashboard/page.tsx` — server component that fetches all licenses and renders a table showing domain, license key (masked), status, expiration date, last heartbeat, active users, created date. Include search/filter by domain or status. Add action buttons for create, edit, suspend, reactivate, delete with confirmation prompts
    - Use client components as needed for interactive elements (forms, modals, search)
    - Display the full license key once after creation
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [ ]* 6.5 Write property test for search filter (Property 8)
    - **Property 8: Search filter returns matching records only**
    - Generate random license sets and search queries, verify filter returns only matching records
    - **Validates: Requirements 8.8**

- [x] 7. Checkpoint — License server admin dashboard complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate license check into FloorHub app login
  - [x] 8.1 Create `lib/license.ts` in the main FloorHub app with `checkLicense(domain, activeUsers?)` that calls the license server API, and `getLicenseStatus()` that reads license status from cookies. Include TypeScript types `LicenseCheckResult` and `LicenseStatus`
    - Return a fail-open default when `LICENSE_SERVER_URL` is not set or the server is unreachable
    - _Requirements: 4.4, 4.5_
  - [x] 8.2 Modify `app/api/auth/login/route.ts` — after successful authentication, call `checkLicense()` with the owner's email domain. Reject login if `licensed: false`, store grace period status in cookies if applicable, allow login on network error (fail-open)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1_

- [x] 9. Integrate license check into FloorHub middleware
  - [x] 9.1 Modify `middleware.ts` — on authenticated requests, check `license_checked_at` cookie. If missing or >24h old, call license check API. If `licensed: false`, clear session and redirect to `/login?license_expired=true`. If grace period, set `license_grace` cookie. If network error, allow through (fail-open). Skip entirely when `LICENSE_SERVER_URL` is not set
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 9.2 Write property test for cache staleness (Property 11)
    - **Property 11: Cache staleness triggers recheck**
    - Generate random timestamps, verify middleware triggers recheck if and only if timestamp is >24h old or missing
    - **Validates: Requirements 5.2**

- [x] 10. Add license UI components to FloorHub app
  - [x] 10.1 Create `components/license/LicenseBanner.tsx` — client component that reads `license_grace` cookie, displays a dismissible amber banner with days remaining on all dashboard pages. Wire it into `app/(dashboard)/layout.tsx`
    - _Requirements: 11.3_
  - [x] 10.2 Modify `app/(dashboard)/settings/page.tsx` — add a "License" card (owner-only) showing green/amber/red status indicator based on license cookies. Hide when `LICENSE_SERVER_URL` is not set
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [x] 10.3 Update `app/(auth)/login/page.tsx` — show a banner when `license_expired=true` query param is present: "Your license is no longer active. Please contact your representative."
    - _Requirements: 4.2_

- [x] 11. Update registration to work with enhanced license check API
  - [x] 11.1 Modify `app/api/auth/register/route.ts` — update the existing license check call to use the new `checkLicense()` helper from `lib/license.ts`, preserving fail-closed behavior (reject on unreachable server with 503, reject on `licensed: false`)
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 12. Final checkpoint — Full integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The license server (`license-server/`) is a separate Next.js app — tasks clearly indicate which app they modify
- The admin dashboard UI is built into the license server, not the main FloorHub app
- The main FloorHub app only gets: login check enhancement, middleware check, license banner component, settings status card, and login page banner
- Tailwind CSS needs to be added to the license server (task 6.1) since it currently has none
- Property tests use `fast-check` and each references a specific design property number
- Checkpoints ensure incremental validation at key milestones
