# Implementation Plan: User Security and Theme Settings

## Overview

Implement three features into the existing FloorHub Next.js dashboard: dark mode toggle with FOUC prevention, auto logout on inactivity, and TOTP-based two-factor authentication. All changes integrate with the existing JWT cookie auth system and surface through the Settings page.

## Tasks

- [x] 1. Database migrations and schema setup
  - Add `totp_enabled BOOLEAN NOT NULL DEFAULT FALSE` column to the `users` table
  - Create `user_totp` table with `user_id`, `secret`, `enabled`, `created_at`, `updated_at` columns
  - Create `user_backup_codes` table with `id`, `user_id`, `code_hash`, `used`, `created_at` columns and index on `user_id`
  - Write migration SQL in `lib/migrations/add-2fa-schema.sql` and apply it via a startup utility or manual run
  - _Requirements: 3a.2, 3a.3, 3a.5_

- [x] 2. Dark mode — ThemeProvider and FOUC prevention
  - [x] 2.1 Create `components/theme/ThemeProvider.tsx`
    - Implement React context with `theme`, `setTheme`, and `toggleTheme`
    - On mount, read `localStorage.theme`; fall back to `prefers-color-scheme`; sync `document.documentElement.classList`
    - Wrap `localStorage` access in try/catch for private-browsing safety
    - _Requirements: 1.2, 1.3, 1.5_

  - [ ]* 2.2 Write property test for theme toggle involution (Property 1)
    - **Property 1: Theme toggle is an involution**
    - **Validates: Requirements 1.2**

  - [ ]* 2.3 Write property test for theme preference round-trip (Property 2)
    - **Property 2: Theme preference round-trip**
    - **Validates: Requirements 1.3, 1.7**

  - [x] 2.4 Add FOUC-prevention inline script to `app/layout.tsx`
    - Insert a `<script dangerouslySetInnerHTML>` in `<head>` that reads `localStorage.theme`, falls back to `prefers-color-scheme`, and sets `document.documentElement.classList` synchronously before paint
    - Wrap `app` children with `<ThemeProvider>`
    - _Requirements: 1.4, 1.5, 1.7_

  - [x] 2.5 Create `components/theme/ThemeToggle.tsx`
    - Sun/Moon icon button that reads `theme` from context and calls `toggleTheme`
    - Renders the correct icon for the current active theme
    - _Requirements: 1.1, 1.6_

  - [ ]* 2.6 Write property test for toggle reflecting current state (Property 3)
    - **Property 3: Toggle reflects current state**
    - **Validates: Requirements 1.6**

  - [x] 2.7 Add Appearance section to `app/(dashboard)/settings/page.tsx`
    - Add a new Card section titled "Appearance" containing `<ThemeToggle>`
    - _Requirements: 1.1_

- [x] 3. Checkpoint — Ensure dark mode tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Auto logout on inactivity
  - [x] 4.1 Create `components/auth/InactivityTimer.tsx`
    - Attach throttled listeners for `mousemove`, `click`, `keydown`, `touchstart` on `window` that update a `lastActivity` ref
    - Add `visibilitychange` listener: pause timer when `hidden`; on `visible`, check elapsed time and trigger logout immediately if ≥ 30 minutes
    - After 30 minutes of inactivity, call `POST /api/auth/logout` then `router.push('/login?reason=inactivity')`
    - Guard all `window`/`document` access with `typeof window !== 'undefined'`
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_

  - [ ]* 4.2 Write property test for interaction event resetting the timer (Property 4)
    - **Property 4: Any interaction event resets the inactivity timer**
    - **Validates: Requirements 2.1**

  - [x] 4.3 Mount `<InactivityTimer>` in `app/(dashboard)/layout.tsx`
    - Import and render `<InactivityTimer>` as a client component inside the dashboard layout
    - _Requirements: 2.6_

  - [x] 4.4 Update `app/(auth)/login/page.tsx` to show inactivity banner
    - Read `searchParams.reason`; if `reason === 'inactivity'`, render a dismissible banner: "Your session expired due to inactivity."
    - _Requirements: 2.3_

- [x] 5. Checkpoint — Ensure inactivity timer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. 2FA — API routes (enrollment)
  - [x] 6.1 Create `app/api/auth/2fa/enroll/route.ts`
    - Authenticate via session cookie using `getAuthUser`
    - Return HTTP 400 if `totp_enabled = true` already
    - Generate a unique TOTP secret with `otplib`; upsert a row in `user_totp` with `enabled = false`
    - Generate QR code data URI with `qrcode` package using `otpauth://totp/...` URI
    - Return `{ qrUri, secret }`
    - _Requirements: 3a.2, 3a.3_

  - [ ]* 6.2 Write property test for enrollment generating unique secrets (Property 6)
    - **Property 6: Enrollment generates unique secrets**
    - **Validates: Requirements 3a.2**

  - [x] 6.3 Create `app/api/auth/2fa/verify-enrollment/route.ts`
    - Authenticate via session cookie
    - Return HTTP 400 if no pending row in `user_totp` for the user
    - Validate submitted `code` is exactly 6 digits; return HTTP 400 otherwise
    - Verify code against pending secret using `otplib` with ±1 step tolerance; return HTTP 400 on failure (do not set `enabled = true`)
    - On success: set `user_totp.enabled = true`, set `users.totp_enabled = true`, generate 8 backup codes, bcrypt-hash each, insert into `user_backup_codes`, return `{ backupCodes: string[] }`
    - _Requirements: 3a.4, 3a.5, 3a.6_

  - [ ]* 6.4 Write property test for invalid enrollment code not activating 2FA (Property 7)
    - **Property 7: Invalid enrollment code does not activate 2FA**
    - **Validates: Requirements 3a.6**

  - [ ]* 6.5 Write property test for TOTP verification time-step tolerance (Property 5)
    - **Property 5: TOTP verification respects ±1 time-step tolerance**
    - **Validates: Requirements 3a.4, 3b.10**

- [x] 7. 2FA — API routes (login second step)
  - [x] 7.1 Modify `app/api/auth/login/route.ts`
    - After password verification, query `users.totp_enabled`
    - If `totp_enabled = true`: sign a short-lived JWT (5-minute expiry) with `{ user_id, purpose: "2fa-challenge" }` and return `{ requires2FA: true, tempToken }` with HTTP 200 — do not set `floorhub_token` cookie
    - _Requirements: 3b.8_

  - [ ]* 7.2 Write property test for 2FA-enabled login withholding session token (Property 8)
    - **Property 8: 2FA-enabled login withholds session token**
    - **Validates: Requirements 3b.8**

  - [x] 7.3 Create `app/api/auth/login/2fa/route.ts`
    - Accept `{ tempToken, code }` in request body
    - Return HTTP 400 if `tempToken` is missing; return HTTP 401 if expired or invalid or `purpose !== "2fa-challenge"`
    - Look up user's TOTP secret from `user_totp`; verify 6-digit code with ±1 step tolerance
    - If code fails TOTP check, attempt backup code: hash-compare against unused rows in `user_backup_codes`; if match, mark that row `used = true`
    - Return HTTP 401 if both checks fail — do not set cookie
    - On success: sign full session JWT, set `floorhub_token` cookie, return `{ user }`
    - _Requirements: 3b.10, 3b.11, 3b.12, 3b.13_

  - [ ]* 7.4 Write property test for invalid TOTP at login being rejected (Property 9)
    - **Property 9: Invalid TOTP at login is rejected**
    - **Validates: Requirements 3b.12**

  - [ ]* 7.5 Write property test for backup code single-use invariant (Property 10)
    - **Property 10: Backup code single-use invariant**
    - **Validates: Requirements 3b.13**

- [x] 8. 2FA — API route (disable)
  - [x] 8.1 Create `app/api/auth/2fa/disable/route.ts`
    - Authenticate via session cookie
    - Return HTTP 400 if `totp_enabled = false`
    - Accept `{ code }` in request body; verify against TOTP secret or unused backup code (same logic as login/2fa)
    - Return HTTP 400 on invalid code — do not modify any state
    - On success: set `users.totp_enabled = false`, delete row from `user_totp`, delete all rows from `user_backup_codes` for the user, return `{ success: true }`
    - _Requirements: 3c.15, 3c.16_

  - [ ]* 8.2 Write property test for disable 2FA clearing all secrets (Property 11)
    - **Property 11: Disable 2FA clears all secrets**
    - **Validates: Requirements 3c.15**

  - [ ]* 8.3 Write property test for invalid disable code not disabling 2FA (Property 12)
    - **Property 12: Invalid disable code does not disable 2FA**
    - **Validates: Requirements 3c.16**

- [x] 9. Checkpoint — Ensure 2FA API tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. 2FA — UI components
  - [x] 10.1 Create `components/auth/TwoFactorSetup.tsx`
    - Step 1: Call `POST /api/auth/2fa/enroll`, display QR code image and plain secret for manual entry, show a 6-digit code input
    - Step 2: Submit code to `POST /api/auth/2fa/verify-enrollment`; on success, display the 8 backup codes with a "Save these codes" prompt
    - Show inline error messages on failure
    - _Requirements: 3a.1, 3a.7_

  - [x] 10.2 Create `components/auth/TwoFactorDisable.tsx`
    - Render a confirmation form with a code input (TOTP or backup code)
    - Submit to `POST /api/auth/2fa/disable`; on success notify parent to refresh 2FA status
    - Show inline error on failure
    - _Requirements: 3c.14, 3c.16_

  - [x] 10.3 Add Two-Factor Authentication section to `app/(dashboard)/settings/page.tsx`
    - Fetch current user's `totp_enabled` status from `GET /api/auth/me`
    - If disabled: show "Enable 2FA" button that mounts `<TwoFactorSetup>`
    - If enabled: show "Enabled" badge and "Disable 2FA" button that mounts `<TwoFactorDisable>`
    - _Requirements: 3a.1, 3c.14_

  - [x] 10.4 Update `app/(auth)/login/page.tsx` for 2FA second step
    - After receiving `{ requires2FA: true, tempToken }` from `POST /api/auth/login`, store `tempToken` in component state and render a TOTP code input step in place of the password form
    - Submit `{ tempToken, code }` to `POST /api/auth/login/2fa`; on success redirect to `/`
    - Show error message on HTTP 401 without clearing email/password fields
    - _Requirements: 3b.9, 3b.12_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use `fast-check` with a minimum of 100 iterations each
- Each property test must include a comment: `// Feature: user-security-and-theme-settings, Property N: <title>`
- Backup codes are 10-character alphanumeric strings (e.g. `A3F7-K2P9`), bcrypt-hashed before storage, returned to the client exactly once
- The `tempToken` for 2FA challenge carries `{ user_id, purpose: "2fa-challenge" }` and expires in 5 minutes
- TOTP library: `otplib`; QR code library: `qrcode`
