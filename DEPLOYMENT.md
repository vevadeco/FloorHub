# FloorHub Deployment Guide

This app is a single Next.js 14 full-stack application. There are two deployments:

- **FloorHub app** — the main app (this repo root) → Vercel
- **License server** — a tiny separate app (`license-server/`) → Vercel (separate project)

Both use Vercel Postgres (Neon) for their databases and deploy independently.

---

## Prerequisites

- A [GitHub](https://github.com) account with this repo pushed
- A [Vercel](https://vercel.com) account (free tier works for both deployments)
- [Stripe](https://stripe.com) account (optional — for online payments)
- [Resend](https://resend.com) account (optional — for email invoices)

---

## Step 1 — Push to GitHub

```bash
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Step 2 — Deploy the License Server

The license server must be deployed first so you have its URL ready for the main app.

### 2.1 Create a new Vercel project

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
2. In the project configuration, set **Root Directory** to `license-server`
3. Framework preset: **Next.js** (auto-detected)

### 2.2 Add a Postgres database

1. In the Vercel project dashboard → **Storage** tab → **Create Database** → **Postgres**
2. Name it something like `floorhub-license-db`
3. Click **Connect** — Vercel injects `POSTGRES_URL` and related vars automatically

### 2.3 Set environment variables

In **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `ADMIN_SECRET` | A long random string — keep this private, e.g. `openssl rand -hex 32` |

### 2.4 Deploy

Click **Deploy**. Copy the production URL — you'll need it in Step 3.
It will look like `https://floorhub-license.vercel.app`.

### 2.5 Add your domain as a licensed domain

Once deployed, register your FloorHub app's domain so the owner registration works:

```bash
curl -X POST https://YOUR-LICENSE-SERVER.vercel.app/api/admin/domains \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"domain": "yourdomain.com"}'
```

For local development, add `localhost`:

```bash
curl -X POST https://YOUR-LICENSE-SERVER.vercel.app/api/admin/domains \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"domain": "localhost"}'
```

---

## Step 3 — Deploy the Main App

### 3.1 Create a new Vercel project

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the same repo
2. Leave **Root Directory** as `/` (the repo root)
3. Framework preset: **Next.js** (auto-detected)

### 3.2 Add a Postgres database

1. In the project dashboard → **Storage** → **Create Database** → **Postgres**
2. Name it `floorhub-db`
3. Click **Connect** — Vercel injects the Postgres env vars automatically

### 3.3 Add a Blob store (for logo uploads)

1. In the project dashboard → **Storage** → **Create Database** → **Blob**
2. Name it `floorhub-blob`
3. Click **Connect** — Vercel injects `BLOB_READ_WRITE_TOKEN` automatically

### 3.4 Set environment variables

In **Settings → Environment Variables**, add:

| Variable | Value | Required |
|---|---|---|
| `JWT_SECRET` | Long random string, e.g. `openssl rand -hex 32` | Yes |
| `LICENSE_SERVER_URL` | URL from Step 2, e.g. `https://floorhub-license.vercel.app` — omit to disable license enforcement | Optional |
| `ADMIN_EMAIL` | Email address for the initial owner account | Yes |
| `ADMIN_PASSWORD` | Password for the initial owner account | Yes |
| `ADMIN_NAME` | Display name for the initial owner (default: `Administrator`) | No |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) | Optional |
| `RESEND_FROM_EMAIL` | Verified sender address for Resend | Optional |
| `STRIPE_SECRET_KEY` | From [stripe.com/dashboard](https://dashboard.stripe.com) | Optional |
| `NEXT_PUBLIC_APP_URL` | Your Vercel app URL, e.g. `https://floorhub.vercel.app` | Optional (Stripe redirects) |

> `POSTGRES_URL` and `BLOB_READ_WRITE_TOKEN` are injected automatically — don't add them manually.
>
> `ADMIN_EMAIL` / `ADMIN_PASSWORD` are only used on first boot when no users exist. Once the owner account is created they have no effect. You can remove them after the first deployment if you prefer.

### 3.5 Deploy

Click **Deploy**. The database schema is created automatically on first boot via `instrumentation.ts`.

---

## Step 4 — First-Time Setup

1. Open your app URL — you'll be taken to the login screen
2. The owner account was created automatically on first boot using `ADMIN_EMAIL` and `ADMIN_PASSWORD`
3. Sign in with those credentials
4. Go to **Settings** and fill in your company info, tax rate, and optionally upload a logo
5. Change your password in **Settings → Change Password** after first login

---

## Step 5 — Custom Domain (optional)

In your main Vercel project → **Settings → Domains** → add your domain and follow the DNS instructions.

After adding a custom domain, update `NEXT_PUBLIC_APP_URL` to match, and add the new domain to the license server:

```bash
curl -X POST https://YOUR-LICENSE-SERVER.vercel.app/api/admin/domains \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"domain": "yourcustomdomain.com"}'
```

---

## Local Development

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

`.env.local` values you need:

```env
# From your Vercel Postgres dashboard (or a local Postgres instance)
POSTGRES_URL=postgres://user:pass@localhost:5432/floorhub

# Generate with: openssl rand -hex 32
JWT_SECRET=your-dev-secret

# URL of your running license server (or deployed one)
LICENSE_SERVER_URL=http://localhost:3001

# Initial admin — seeded on first boot if no users exist
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=changeme
ADMIN_NAME=Administrator

# Optional
RESEND_API_KEY=re_...
STRIPE_SECRET_KEY=sk_test_...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

Run the main app and license server in separate terminals:

```bash
# Terminal 1 — main app
npm install
npm run dev        # runs on http://localhost:3000

# Terminal 2 — license server
cd license-server
npm install
npm run dev        # runs on http://localhost:3001
```

Then add `localhost` as a licensed domain (see Step 2.5 above, pointing at `localhost:3001`).

---

## Managing Licensed Domains

The license server exposes three admin endpoints, all requiring the `x-admin-secret` header.

**List all domains:**
```bash
curl https://YOUR-LICENSE-SERVER.vercel.app/api/admin/domains \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

**Add a domain:**
```bash
curl -X POST https://YOUR-LICENSE-SERVER.vercel.app/api/admin/domains \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"domain": "newclient.com"}'
```

**Remove a domain:**
```bash
curl -X DELETE https://YOUR-LICENSE-SERVER.vercel.app/api/admin/domains/newclient.com \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

---

## Troubleshooting

**"Please contact your representative" on registration**
The license server either couldn't be reached or returned `licensed: false` for your domain. Check that `LICENSE_SERVER_URL` is set correctly and that your domain has been added via the admin API (Step 2.5).

**Registration fails with "Domain not licensed"**
Your app's domain isn't in the license server. Add it via the admin API (see Step 2.5).

**500 errors on first load**
The schema runs automatically on startup. Check the **Functions** logs in Vercel for the error. Most common cause: `POSTGRES_URL` not connected or `JWT_SECRET` missing.

**Logo upload fails**
Make sure the Blob store is connected to the project and `BLOB_READ_WRITE_TOKEN` is present in environment variables.

**Stripe checkout not working**
Add `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_APP_URL`. The app works without Stripe — online payments will just fail gracefully.

**Emails not sending**
Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. The app works without Resend — email sending will fail gracefully.

**"Invalid token" errors after deploy**
`JWT_SECRET` is missing or changed between deployments. Set it as a permanent environment variable in Vercel — don't let it rotate.
