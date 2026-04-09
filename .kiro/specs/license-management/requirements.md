# Requirements Document

## Introduction

The FloorHub License Server (a separate Next.js app in `license-server/`) currently provides a minimal domain-based allowlist for license checking. Licenses are only verified at owner registration time, have no expiration, no admin UI, no periodic validation, and contain a bug where `initSchema()` is referenced but not exported. This feature enhances the license server with proper license lifecycle management including expiration dates, license keys, periodic validation, a grace period, usage tracking, an admin dashboard, and a license status indicator in the main FloorHub app.

## Glossary

- **License_Server**: The separate Next.js application running on port 3001 in the `license-server/` directory that manages license records and exposes license-checking APIs.
- **FloorHub_App**: The main Next.js application that serves the flooring business management dashboard.
- **License_Record**: A database row representing a licensed domain, including domain name, license key, expiration date, status, and usage metadata.
- **Admin_Dashboard**: A web-based UI built into the License_Server for managing License_Records.
- **License_Key**: A unique, cryptographically random string assigned to each License_Record for identification and validation.
- **License_Check_API**: The `POST /api/check-license` endpoint on the License_Server that validates whether a domain holds an active, non-expired license.
- **Heartbeat**: A periodic request sent from the FloorHub_App to the License_Server to confirm ongoing license validity and report usage data.
- **Grace_Period**: A configurable number of days (default 7) after license expiration during which the FloorHub_App continues to operate in a degraded or warning state before blocking access.
- **License_Cache**: A short-lived cache (default 24 hours) stored in a cookie or server-side store in the FloorHub_App to avoid checking the License_Server on every request.
- **Admin_Secret**: The `ADMIN_SECRET` environment variable used to authenticate admin API requests and admin dashboard login.
- **Settings_Page**: The FloorHub_App settings page at `/settings` accessible to owners.

## Requirements

### Requirement 1: Fix initSchema Export Bug

**User Story:** As a developer, I want the `initSchema` function to be properly exported from `license-server/lib/db.ts`, so that the database schema initializes correctly on server startup.

#### Acceptance Criteria

1. THE License_Server SHALL export an `initSchema` function from `lib/db.ts` that creates all required database tables if they do not already exist.
2. WHEN the License_Server starts, THE License_Server SHALL invoke `initSchema` via `instrumentation.ts` to ensure the database schema is ready.
3. IF `initSchema` fails, THEN THE License_Server SHALL log the error with a descriptive message and terminate the startup process.

### Requirement 2: Enhanced License Record Schema

**User Story:** As an admin, I want license records to include expiration dates, license keys, and status tracking, so that I can manage the full license lifecycle.

#### Acceptance Criteria

1. THE License_Server SHALL store each License_Record with the following fields: `id` (UUID), `domain` (unique string), `license_key` (unique string), `expires_at` (timestamp, nullable for perpetual licenses), `status` (enum: active, suspended, expired), `created_at` (timestamp), `updated_at` (timestamp), `notes` (text, nullable).
2. WHEN a new License_Record is created, THE License_Server SHALL generate a cryptographically random License_Key of at least 32 characters.
3. WHEN a License_Record has an `expires_at` value in the past and the status is `active`, THE License_Check_API SHALL treat the License_Record as expired.
4. THE License_Server SHALL store a `grace_period_days` column on each License_Record with a default value of 7.

### Requirement 3: Enhanced License Check API

**User Story:** As the FloorHub app, I want the license check endpoint to return detailed license status including expiration and grace period information, so that I can display appropriate warnings to users.

#### Acceptance Criteria

1. WHEN a valid domain with an active, non-expired License_Record is provided, THE License_Check_API SHALL return `{ licensed: true, status: "active", expires_at: <timestamp>, grace_period_days: <number> }`.
2. WHEN a domain has an expired License_Record within the Grace_Period, THE License_Check_API SHALL return `{ licensed: true, status: "grace_period", expires_at: <timestamp>, days_remaining: <number> }`.
3. WHEN a domain has an expired License_Record past the Grace_Period, THE License_Check_API SHALL return `{ licensed: false, status: "expired" }`.
4. WHEN a domain has a suspended License_Record, THE License_Check_API SHALL return `{ licensed: false, status: "suspended" }`.
5. WHEN a domain is not found in the database, THE License_Check_API SHALL return `{ licensed: false, status: "not_found" }`.
6. WHEN a domain has a License_Record with a null `expires_at`, THE License_Check_API SHALL treat the license as perpetual and return `{ licensed: true, status: "active", expires_at: null }`.

### Requirement 4: License Validation at Login

**User Story:** As a business owner, I want the license to be checked every time a user logs in, so that revoked or expired licenses are enforced promptly.

#### Acceptance Criteria

1. WHEN a user successfully authenticates in the FloorHub_App login flow, THE FloorHub_App SHALL call the License_Check_API with the owner's email domain before issuing a session token.
2. IF the License_Check_API returns `licensed: false`, THEN THE FloorHub_App SHALL reject the login and display the message "Your license is no longer active. Please contact your representative."
3. IF the License_Check_API returns `status: "grace_period"`, THEN THE FloorHub_App SHALL allow login and store the grace period status in the session for display as a warning.
4. IF the License_Check_API is unreachable or returns an error, THEN THE FloorHub_App SHALL allow login and log a warning (fail-open to avoid blocking users due to license server downtime).
5. WHILE the `LICENSE_SERVER_URL` environment variable is not set, THE FloorHub_App SHALL skip all license validation checks.

### Requirement 5: Cached Periodic License Check in Middleware

**User Story:** As a business owner, I want the app to periodically revalidate the license in the background, so that license changes are detected within 24 hours without impacting every request.

#### Acceptance Criteria

1. WHEN a user accesses any authenticated page in the FloorHub_App, THE FloorHub_App middleware SHALL check for a `license_checked_at` value in the user's cookies.
2. IF the `license_checked_at` cookie is missing or older than 24 hours, THEN THE FloorHub_App middleware SHALL call the License_Check_API and update the `license_checked_at` cookie with the current timestamp.
3. IF the periodic license check returns `licensed: false`, THEN THE FloorHub_App middleware SHALL clear the user's session and redirect to the login page with a `license_expired=true` query parameter.
4. IF the periodic license check returns `status: "grace_period"`, THEN THE FloorHub_App middleware SHALL set a `license_grace` cookie with the `days_remaining` value for display in the UI.
5. IF the periodic license check fails due to a network error, THEN THE FloorHub_App middleware SHALL allow the request to proceed and retain the existing `license_checked_at` value (fail-open).
6. WHILE the `LICENSE_SERVER_URL` environment variable is not set, THE FloorHub_App middleware SHALL skip the periodic license check entirely.

### Requirement 6: Heartbeat and Usage Tracking

**User Story:** As an admin, I want to see when each licensed domain last checked in and how many active users it has, so that I can monitor license usage.

#### Acceptance Criteria

1. WHEN the FloorHub_App performs a license check (at login or periodic), THE FloorHub_App SHALL include `{ active_users: <count> }` in the request body to the License_Check_API.
2. WHEN the License_Check_API receives a license check request with usage data, THE License_Server SHALL update the License_Record with `last_heartbeat_at` (current timestamp) and `active_users` (from the request).
3. THE License_Server SHALL store `last_heartbeat_at` (timestamp) and `active_users` (integer) columns on each License_Record.

### Requirement 7: Admin Dashboard — Authentication

**User Story:** As an admin, I want to log into the license server admin dashboard using the admin secret, so that only authorized personnel can manage licenses.

#### Acceptance Criteria

1. THE License_Server SHALL serve an admin login page at the root path `/`.
2. WHEN an admin submits the correct Admin_Secret on the login page, THE License_Server SHALL set a secure, HTTP-only session cookie and redirect to the dashboard.
3. IF an incorrect Admin_Secret is submitted, THEN THE License_Server SHALL display an "Invalid secret" error message and remain on the login page.
4. WHEN an unauthenticated user attempts to access any admin dashboard page, THE License_Server SHALL redirect to the login page.
5. THE License_Server SHALL provide a logout action that clears the session cookie and redirects to the login page.

### Requirement 8: Admin Dashboard — License List and Management

**User Story:** As an admin, I want a dashboard to view, create, edit, and revoke licenses, so that I can manage all licensed domains from a single interface.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a table of all License_Records showing domain, license key (masked), status, expiration date, last heartbeat, active users, and creation date.
2. THE Admin_Dashboard SHALL provide a form to create a new License_Record by specifying domain, expiration date (optional for perpetual), grace period days, and notes.
3. WHEN an admin creates a new License_Record, THE License_Server SHALL generate a License_Key and display it once in full to the admin.
4. THE Admin_Dashboard SHALL allow an admin to edit the expiration date, grace period, notes, and status of an existing License_Record.
5. THE Admin_Dashboard SHALL allow an admin to suspend an active License_Record, changing its status to `suspended`.
6. THE Admin_Dashboard SHALL allow an admin to reactivate a suspended License_Record, changing its status to `active`.
7. THE Admin_Dashboard SHALL allow an admin to delete a License_Record permanently with a confirmation prompt.
8. THE Admin_Dashboard SHALL provide a search/filter capability to find License_Records by domain or status.

### Requirement 9: Admin API Enhancements

**User Story:** As a developer, I want the admin API to support the full license lifecycle, so that the admin dashboard and external tooling can manage licenses programmatically.

#### Acceptance Criteria

1. WHEN a `POST /api/admin/licenses` request is received with a valid Admin_Secret and a domain, THE License_Server SHALL create a new License_Record and return the full record including the generated License_Key.
2. WHEN a `GET /api/admin/licenses` request is received with a valid Admin_Secret, THE License_Server SHALL return all License_Records with all fields.
3. WHEN a `PUT /api/admin/licenses/:id` request is received with a valid Admin_Secret, THE License_Server SHALL update the specified License_Record fields (expires_at, grace_period_days, status, notes).
4. WHEN a `DELETE /api/admin/licenses/:id` request is received with a valid Admin_Secret, THE License_Server SHALL permanently delete the License_Record.
5. WHEN a `PATCH /api/admin/licenses/:id/suspend` request is received with a valid Admin_Secret, THE License_Server SHALL set the License_Record status to `suspended`.
6. WHEN a `PATCH /api/admin/licenses/:id/reactivate` request is received with a valid Admin_Secret, THE License_Server SHALL set the License_Record status to `active`.
7. IF any admin API request is received without a valid Admin_Secret, THEN THE License_Server SHALL return a 401 Unauthorized response.

### Requirement 10: License Status Indicator in FloorHub Settings

**User Story:** As a business owner, I want to see my current license status on the settings page, so that I know when my license expires and can take action before it lapses.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a "License" card showing the current license status (active, grace period, expired, or unchecked).
2. WHILE the license status is `active`, THE Settings_Page SHALL display a green indicator with the expiration date (or "Perpetual" if no expiration).
3. WHILE the license status is `grace_period`, THE Settings_Page SHALL display an amber warning indicator with the number of days remaining and the message "License expired — grace period active."
4. WHILE the license status is `expired` or `suspended`, THE Settings_Page SHALL display a red indicator with the message "License inactive. Please contact your representative."
5. WHILE the `LICENSE_SERVER_URL` environment variable is not set, THE Settings_Page SHALL hide the license status card entirely.
6. THE Settings_Page SHALL display the license status card only to users with the `owner` role.

### Requirement 11: Grace Period Behavior

**User Story:** As a business owner, I want a grace period after my license expires, so that my business operations are not immediately disrupted.

#### Acceptance Criteria

1. WHILE a License_Record is within its Grace_Period (expired but within `grace_period_days` of `expires_at`), THE License_Check_API SHALL return `licensed: true` with `status: "grace_period"`.
2. WHEN the Grace_Period elapses (current date exceeds `expires_at` + `grace_period_days`), THE License_Check_API SHALL return `licensed: false` with `status: "expired"`.
3. WHILE the FloorHub_App is operating in grace period, THE FloorHub_App SHALL display a persistent, dismissible banner on all dashboard pages warning that the license has expired and showing the remaining grace period days.

### Requirement 12: License Check at Registration (Preserve Existing Behavior)

**User Story:** As a developer, I want the existing registration-time license check to continue working with the enhanced API, so that unlicensed domains cannot register.

#### Acceptance Criteria

1. WHEN an owner registers in the FloorHub_App, THE FloorHub_App SHALL call the License_Check_API with the owner's email domain.
2. IF the License_Check_API returns `licensed: false`, THEN THE FloorHub_App SHALL reject the registration with the message "Please contact your representative."
3. IF the License_Check_API is unreachable, THEN THE FloorHub_App SHALL reject the registration with a 503 status (existing fail-closed behavior preserved).
4. WHILE the `LICENSE_SERVER_URL` environment variable is not set, THE FloorHub_App SHALL skip the license check and allow registration.
