# FloorHub License Server — Installation Guide

A standalone Next.js app that manages FloorHub licenses. It provides an admin dashboard for creating, editing, suspending, and revoking licenses, plus an API that the main FloorHub app calls to validate licenses.

---

## Prerequisites

- Node.js 18+
- A Neon PostgreSQL database (separate from the main FloorHub database)
- A Vercel account (for deployment) or any Node.js hosting

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string for the license server database | Yes |
| `ADMIN_SECRET` | A strong secret string used to authenticate admin API requests and dashboard login | Yes |

Generate a strong admin secret:
```bash
openssl rand -hex 32
```

---

## Local Development

1. Navigate to the license server directory:
   ```bash
   cd license-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file:
   ```
   DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
   ADMIN_SECRET=your-strong-secret-here
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```
   The server runs on `http://localhost:3001`.

5. Open `http://localhost:3001` in your browser and log in with your `ADMIN_SECRET`.

---

## Deploying to Vercel

1. Create a new Vercel project pointing to the `license-server/` directory (set the root directory to `license-server` in project settings).

2. Add environment variables in the Vercel dashboard:
   - `DATABASE_URL` — your Neon PostgreSQL connection string
   - `ADMIN_SECRET` — your admin secret

3. Deploy. The database schema is created automatically on first startup via `instrumentation.ts`.

4. Note the deployment URL (e.g., `https://floorhub-license.vercel.app`).

---

## Connecting to the Main FloorHub App

To enable license enforcement in the main FloorHub app, set the `LICENSE_SERVER_URL` environment variable:

```
LICENSE_SERVER_URL=https://floorhub-license.vercel.app
```

When this variable is **not set**, all license checks are skipped (the app runs without licensing).

---

## Admin Dashboard

Navigate to your license server URL and log in with the `ADMIN_SECRET`.

The dashboard lets you:
- View all licenses in a searchable table
- Create new licenses (domain, optional expiration, grace period, notes)
- Copy the generated license key after creation
- Edit license details (expiration, grace period, status, notes)
- Suspend or reactivate licenses
- Delete licenses permanently
- Monitor last heartbeat and active user counts per license

---

## Admin API

All admin API endpoints require the `x-admin-secret` header (or a valid admin session cookie from the dashboard).

### List all licenses
```bash
curl -H "x-admin-secret: YOUR_SECRET" \
  https://your-license-server.vercel.app/api/admin/licenses
```

### Create a license
```bash
curl -X POST \
  -H "x-admin-secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "expires_at": "2027-01-01T00:00:00Z", "grace_period_days": 7, "notes": "Annual license"}' \
  https://your-license-server.vercel.app/api/admin/licenses
```

The response includes the generated `license_key`. Save it — it's only shown once in the dashboard.

### Update a license
```bash
curl -X PUT \
  -H "x-admin-secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"expires_at": "2028-01-01T00:00:00Z", "notes": "Extended"}' \
  https://your-license-server.vercel.app/api/admin/licenses/LICENSE_ID
```

### Suspend a license
```bash
curl -X PATCH \
  -H "x-admin-secret: YOUR_SECRET" \
  https://your-license-server.vercel.app/api/admin/licenses/LICENSE_ID/suspend
```

### Reactivate a license
```bash
curl -X PATCH \
  -H "x-admin-secret: YOUR_SECRET" \
  https://your-license-server.vercel.app/api/admin/licenses/LICENSE_ID/reactivate
```

### Delete a license
```bash
curl -X DELETE \
  -H "x-admin-secret: YOUR_SECRET" \
  https://your-license-server.vercel.app/api/admin/licenses/LICENSE_ID
```

---

## License Check API

The main FloorHub app calls this endpoint to validate licenses:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "active_users": 5}' \
  https://your-license-server.vercel.app/api/check-license
```

Response variants:
- Active: `{ "licensed": true, "status": "active", "expires_at": "2027-01-01T00:00:00Z", "grace_period_days": 7 }`
- Perpetual: `{ "licensed": true, "status": "active", "expires_at": null, "grace_period_days": 7 }`
- Grace period: `{ "licensed": true, "status": "grace_period", "expires_at": "2026-04-01T00:00:00Z", "days_remaining": 3 }`
- Expired: `{ "licensed": false, "status": "expired" }`
- Suspended: `{ "licensed": false, "status": "suspended" }`
- Not found: `{ "licensed": false, "status": "not_found" }`

---

## How License Enforcement Works in FloorHub

When `LICENSE_SERVER_URL` is set:

1. **At registration**: The owner's email domain is checked. If not licensed, registration is blocked (fail-closed).
2. **At login**: The domain is checked again. If the license is revoked/expired past grace period, login is rejected. If in grace period, a warning is shown.
3. **Every 24 hours**: The middleware rechecks the license in the background. If revoked, the user is logged out.
4. **Settings page**: The owner sees a license status card (green/amber/red).
5. **Grace period banner**: A dismissible amber banner appears on all pages during the grace period.

When `LICENSE_SERVER_URL` is **not set**, all of the above is completely skipped.

---

## Migration from Old Schema

If you previously used the `licensed_domains` table, the license server automatically migrates those records to the new `licenses` table on first startup. Each migrated domain gets:
- Status: `active`
- Expiration: `null` (perpetual)
- Grace period: 7 days
- A generated license key

The old `licensed_domains` table is dropped after migration.
