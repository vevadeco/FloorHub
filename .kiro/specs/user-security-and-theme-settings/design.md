# Design Document: User Security and Theme Settings

## Overview

This document describes the technical design for three features added to the FloorHub Next.js dashboard:

1. **Dark Mode Toggle** — client-side theme switching with `localStorage` persistence and FOUC prevention via an inline script injected into `<head>`.
2. **Auto Logout on Inactivity** — a single client-side component mounted in the dashboard layout that tracks user interaction events, pauses when the tab is hidden, and calls `POST /api/auth/logout` after 30 minutes of inactivity.
3. **Two-Factor Authentication (2FA) via TOTP** — enrollment, login challenge, and disable flows backed by new API routes and a `totp_secrets` / `backup_codes` database schema, using the `otplib` library for TOTP generation and verification.

All three features integrate with the existing JWT cookie auth system (`lib/auth.ts`, `app/api/auth/`) and surface through the existing Settings page (`app/(dashboard)/settings/page.tsx`).

---

## Architecture

### Dark Mode

Tailwind is already configured with `darkMode: ['class']`, meaning the `dark` class on `<html>` activates dark styles. The challenge is applying the correct class *before* React hydrates to avoid a flash of unstyled content (FOUC).

The solution is a small inline `<script>` tag injected in `app/layout.tsx` inside `<head>`. This script runs synchronously before any paint, reads `localStorage.theme`, falls back to `prefers-color-scheme`, and sets `document.documentElement.classList`. A `ThemeProvider` context component wraps the app to expose the current theme and a toggle function to any client component.

```
app/layout.tsx
  └─ <head> inline script (FOUC prevention)
  └─ ThemeProvider (context)
       └─ app/(dashboard)/settings/page.tsx
            └─ ThemeToggle component
```

### Auto Logout

A single `<InactivityTimer>` client component is mounted once in `app/(dashboard)/layout.tsx`. It attaches throttled event listeners for `mousemove`, `click`, `keydown`, and `touchstart` on `window`. A `visibilitychange` listener on `document` pauses/resumes the timer. When the timer fires, it calls `POST /api/auth/logout` then redirects to `/login?reason=inactivity`.

The login page reads the `reason` query param and shows a contextual message.

```
app/(dashboard)/layout.tsx
  └─ <InactivityTimer> (client component, no UI)

app/(auth)/login/page.tsx
  └─ reads ?reason=inactivity → shows banner
```

### 2FA (TOTP)

New API routes are added under `app/api/auth/2fa/`:

- `POST /api/auth/2fa/enroll` — generates TOTP secret, stores it as pending, returns QR URI + plain secret
- `POST /api/auth/2fa/verify-enrollment` — verifies submitted TOTP code, activates 2FA, returns backup codes
- `POST /api/auth/2fa/disable` — verifies TOTP/backup code, disables 2FA and clears secrets
- `POST /api/auth/login/2fa` — second-step login: verifies TOTP/backup code, issues JWT cookie

The existing `POST /api/auth/login` route is modified to detect `totp_enabled = true` on the user and return `{ requires2FA: true, tempToken: <signed short-lived JWT> }` instead of issuing the full session cookie. The `tempToken` carries only `user_id` and is used by the `/api/auth/login/2fa` route to identify the user without exposing a full session.

```
Login flow (2FA enabled):
  POST /api/auth/login
    → { requires2FA: true, tempToken }
  Login page shows TOTP input
  POST /api/auth/login/2fa  { tempToken, code }
    → sets floorhub_token cookie → redirect /
```

Library: **`otplib`** (well-maintained, RFC 6238 compliant, works in Node.js runtime). QR code image: **`qrcode`** npm package to generate a data URI server-side.

---

## Components and Interfaces

### New Client Components

| Component | Path | Purpose |
|---|---|---|
| `ThemeProvider` | `components/theme/ThemeProvider.tsx` | React context providing `theme` + `setTheme` |
| `ThemeToggle` | `components/theme/ThemeToggle.tsx` | Sun/Moon icon button, reads context |
| `InactivityTimer` | `components/auth/InactivityTimer.tsx` | Invisible timer component for auto-logout |
| `TwoFactorSetup` | `components/auth/TwoFactorSetup.tsx` | Enrollment UI: QR code, verify step, backup codes display |
| `TwoFactorDisable` | `components/auth/TwoFactorDisable.tsx` | Disable UI: confirmation code input |

### Modified Files

| File | Change |
|---|---|
| `app/layout.tsx` | Add FOUC-prevention inline script + wrap with `ThemeProvider` |
| `app/(dashboard)/layout.tsx` | Mount `<InactivityTimer>` |
| `app/(dashboard)/settings/page.tsx` | Add Appearance section (ThemeToggle) + 2FA section |
| `app/(auth)/login/page.tsx` | Add 2FA second-step UI + inactivity banner |
| `app/api/auth/login/route.ts` | Check `totp_enabled`, return `requires2FA` + `tempToken` |

### New API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `app/api/auth/2fa/enroll/route.ts` | POST | Session cookie | Generate + store pending TOTP secret |
| `app/api/auth/2fa/verify-enrollment/route.ts` | POST | Session cookie | Verify code, activate 2FA, return backup codes |
| `app/api/auth/2fa/disable/route.ts` | POST | Session cookie | Verify code, disable 2FA |
| `app/api/auth/login/2fa/route.ts` | POST | `tempToken` body param | Verify TOTP/backup code, issue session |

### ThemeProvider Interface

```typescript
interface ThemeContextValue {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
}
```

### 2FA API Request/Response Shapes

```typescript
// POST /api/auth/2fa/enroll
// Response:
{ qrUri: string; secret: string }

// POST /api/auth/2fa/verify-enrollment
// Request:
{ code: string }
// Response:
{ backupCodes: string[] }

// POST /api/auth/2fa/disable
// Request:
{ code: string }
// Response:
{ success: true }

// POST /api/auth/login (modified)
// Response when 2FA enabled:
{ requires2FA: true; tempToken: string }

// POST /api/auth/login/2fa
// Request:
{ tempToken: string; code: string }
// Response:
{ user: { id, email, name, role } }  // + sets floorhub_token cookie
```

---

## Data Models

### Database Schema Changes

Two new tables are required. These are added via a migration run at startup or manually.

```sql
-- Stores the TOTP secret per user.
-- totp_pending: secret generated but not yet verified (enrollment in progress)
-- totp_enabled: secret verified and 2FA is active
CREATE TABLE user_totp (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret      TEXT NOT NULL,          -- base32-encoded TOTP secret (encrypted at rest recommended)
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Single-use backup codes. Each row is one code.
CREATE TABLE user_backup_codes (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,          -- bcrypt hash of the plain backup code
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON user_backup_codes(user_id);
```

### Users Table Change

Add a `totp_enabled` boolean column to the existing `users` table so the login route can check it in a single query without a join:

```sql
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

### Backup Code Generation

8 backup codes are generated as random 10-character alphanumeric strings (e.g. `A3F7-K2P9`). The plain codes are returned to the client exactly once. Only bcrypt hashes are stored in `user_backup_codes`.

### Theme Persistence

No database changes. Theme preference is stored client-side in `localStorage` under the key `theme` with values `"light"` or `"dark"`.

### Temp Token (2FA Login)

A short-lived JWT (5-minute expiry) signed with the same `JWT_SECRET`, carrying only `{ user_id, purpose: "2fa-challenge" }`. It is passed as a body field in the second-step request, not set as a cookie.

---

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Theme toggle is an involution

*For any* current theme value (`"light"` or `"dark"`), calling `toggleTheme()` twice in succession should return the theme to its original value.

**Validates: Requirements 1.2**

### Property 2: Theme preference round-trip

*For any* theme value (`"light"` or `"dark"`), calling `setTheme(value)` should result in `localStorage.getItem("theme")` returning that same value, and `document.documentElement.classList.contains("dark")` being `true` if and only if the value is `"dark"`.

**Validates: Requirements 1.3, 1.7**

### Property 3: Toggle reflects current state

*For any* theme state, the `ThemeToggle` component should render a visual indicator (icon or label) that corresponds to the current active theme — light indicator when theme is `"light"`, dark indicator when theme is `"dark"`.

**Validates: Requirements 1.6**

### Property 4: Any interaction event resets the inactivity timer

*For any* of the tracked interaction event types (`mousemove`, `click`, `keydown`, `touchstart`), dispatching that event on `window` should update the `lastActivity` timestamp to the current time, resetting the inactivity countdown.

**Validates: Requirements 2.1**

### Property 5: TOTP verification respects ±1 time-step tolerance

*For any* TOTP secret and any TOTP code generated at time step `T-1`, `T`, or `T+1` (where `T` is the current 30-second window), the verification function should return `true`. For any code generated outside that window, it should return `false`.

**Validates: Requirements 3a.4, 3b.10**

### Property 6: Enrollment generates unique secrets

*For any* two independent calls to `POST /api/auth/2fa/enroll` (for the same or different users), the returned `secret` values should be distinct.

**Validates: Requirements 3a.2**

### Property 7: Invalid enrollment code does not activate 2FA

*For any* user with a pending TOTP secret and any TOTP code that fails verification, calling `POST /api/auth/2fa/verify-enrollment` should return HTTP 400 and the user's `totp_enabled` flag should remain `false`.

**Validates: Requirements 3a.6**

### Property 8: 2FA-enabled login withholds session token

*For any* user with `totp_enabled = true` who submits correct email and password credentials, `POST /api/auth/login` should return `{ requires2FA: true }` with HTTP 200 and must not set the `floorhub_token` cookie.

**Validates: Requirements 3b.8**

### Property 9: Invalid TOTP at login is rejected

*For any* invalid TOTP code (wrong value, expired, or from a different secret) submitted to `POST /api/auth/login/2fa`, the API should return HTTP 401 and must not set the `floorhub_token` cookie.

**Validates: Requirements 3b.12**

### Property 10: Backup code single-use invariant

*For any* valid backup code, using it once should succeed and complete the login or disable flow. Using the same backup code a second time should fail, regardless of how much time has elapsed between uses.

**Validates: Requirements 3b.13**

### Property 11: Disable 2FA clears all secrets

*For any* user with `totp_enabled = true` who submits a valid TOTP or backup code to `POST /api/auth/2fa/disable`, after the operation: `totp_enabled` should be `false`, no row should exist in `user_totp` for that user, and no unused rows should remain in `user_backup_codes` for that user.

**Validates: Requirements 3c.15**

### Property 12: Invalid disable code does not disable 2FA

*For any* user with `totp_enabled = true` and any invalid confirmation code, calling `POST /api/auth/2fa/disable` should return HTTP 400 and the user's `totp_enabled` flag should remain `true`.

**Validates: Requirements 3c.16**

---

## Error Handling

### Dark Mode

- If `localStorage` is unavailable (e.g., private browsing with storage blocked), the inline script catches the exception and falls back to `prefers-color-scheme`. The `ThemeProvider` also wraps `localStorage` access in try/catch.

### Auto Logout

- If `POST /api/auth/logout` fails (network error), the client still redirects to `/login` to ensure the user is not left in a broken state. The cookie will expire naturally via its `maxAge`.
- Event listener registration is guarded by `typeof window !== 'undefined'` to prevent SSR errors.

### 2FA Enrollment

- If a user calls `enroll` while already having `totp_enabled = true`, the API returns HTTP 400 ("2FA is already enabled").
- If a user calls `verify-enrollment` without a pending secret (no row in `user_totp`), the API returns HTTP 400 ("No pending enrollment found").
- TOTP codes are validated as exactly 6 digits before attempting cryptographic verification.

### 2FA Login

- The `tempToken` has a 5-minute expiry. If it has expired when `POST /api/auth/login/2fa` is called, the API returns HTTP 401 ("Challenge expired, please log in again").
- If the `tempToken` is missing or malformed, the API returns HTTP 400.

### 2FA Disable

- If the user does not have 2FA enabled, the API returns HTTP 400 ("2FA is not enabled").

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:

- **Unit tests** cover specific examples, integration points, and edge cases (e.g., "the login page shows the inactivity banner when `?reason=inactivity` is in the URL").
- **Property-based tests** verify universal correctness across many generated inputs (e.g., "for any TOTP secret and any code from an adjacent time step, verification succeeds").

### Property-Based Testing

**Library**: [`fast-check`](https://github.com/dubzzz/fast-check) — works in Node.js and browser environments, integrates with Jest/Vitest.

**Configuration**: Each property test must run a minimum of **100 iterations**.

Each property test must include a comment referencing the design property it validates:

```
// Feature: user-security-and-theme-settings, Property 5: TOTP verification respects ±1 time-step tolerance
```

**Property test mapping** (one test per property):

| Property | Test description |
|---|---|
| Property 1 | `fc.property(fc.constantFrom('light','dark'), theme => toggleTwice(theme) === theme)` |
| Property 2 | `fc.property(fc.constantFrom('light','dark'), theme => setTheme then read localStorage and classList)` |
| Property 3 | `fc.property(fc.constantFrom('light','dark'), theme => render ThemeToggle, check indicator matches)` |
| Property 4 | `fc.property(fc.constantFrom('mousemove','click','keydown','touchstart'), event => dispatch event, check lastActivity updated)` |
| Property 5 | `fc.property(fc.integer({min:-1,max:1}), offset => generate code at T+offset, verify succeeds; generate code at T+2, verify fails)` |
| Property 6 | `fc.asyncProperty(fc.uuid(), fc.uuid(), async (uid1, uid2) => enroll both, secrets differ)` |
| Property 7 | `fc.asyncProperty(fc.string(), async code => submit invalid code, check 400 + totp_enabled=false)` |
| Property 8 | `fc.asyncProperty(fc.record({email, password}), async creds => login with 2FA user, check requires2FA=true, no cookie)` |
| Property 9 | `fc.asyncProperty(fc.string(), async code => submit invalid code to login/2fa, check 401, no cookie)` |
| Property 10 | `fc.asyncProperty(fc.uuid(), async userId => use backup code once (success), use again (fail))` |
| Property 11 | `fc.asyncProperty(fc.uuid(), async userId => disable with valid code, check all cleared)` |
| Property 12 | `fc.asyncProperty(fc.string(), async code => submit invalid code to disable, check 400 + totp_enabled=true)` |

### Unit Tests

Focus on:

- **FOUC script**: given mocked `localStorage` and `matchMedia`, the script sets the correct class (covers requirement 1.4 and edge case 1.5).
- **Inactivity timer**: timer fires logout after 30 minutes (requirement 2.2); pauses on `hidden` (2.4); triggers logout on `visible` if elapsed (2.5).
- **Login page**: renders TOTP step when `requires2FA: true` is received (3b.9); shows inactivity banner for `?reason=inactivity` (2.3).
- **Settings page**: renders 2FA section with correct status (3a.1); shows backup codes after enrollment (3a.7); requires code input before disable (3c.14).
- **Enrollment flow**: after successful verify-enrollment, `totp_enabled=true` and exactly 8 backup codes returned (3a.5); after successful login/2fa, `floorhub_token` cookie is set (3b.11).
- **Pending state**: calling enroll does not set `totp_enabled=true` (3a.3).
