# Design Document: FloorHub Next.js Migration

## Overview

FloorHub is a flooring store management system currently split across a Python FastAPI backend and a React CRA frontend. This migration consolidates both into a single Next.js 14 App Router application deployed on Vercel. The result is one codebase, one deployment, and zero context-switching between frontend and backend.

Three new capabilities are introduced alongside the migration:
- **License validation**: owner registration is gated by a licensed email domain checked against a separate license server
- **Middleware-enforced RBAC**: employees are restricted to `/invoices` at the infrastructure level, not just the UI
- **Store branding**: owners can upload a logo that appears in the sidebar and on all generated PDFs

A companion **license server** — a minimal separate Next.js app — manages the list of authorized domains.

---

## Architecture

The system is composed of two independently deployed Vercel projects:

```
┌─────────────────────────────────────────────────────────┐
│                  FloorHub App (Vercel)                   │
│                                                          │
│  Browser ──► middleware.ts (Edge, JWT decode)            │
│                    │                                     │
│              App Router pages                            │
│              (React Server Components + Client)          │
│                    │                                     │
│              Route Handlers (app/api/**)                 │
│                    │                                     │
│              lib/ (db, auth, pdf, schema)                │
│                    │                                     │
│              @vercel/postgres ──► Neon PostgreSQL        │
│              @vercel/blob ──► Logo storage               │
└─────────────────────────────────────────────────────────┘
                    │
                    │ POST /api/check-license
                    ▼
┌─────────────────────────────────────────────────────────┐
│              License Server (Vercel)                     │
│                                                          │
│  app/api/check-license/route.ts                          │
│  app/api/admin/domains/route.ts                          │
│  lib/db.ts ──► Neon PostgreSQL (separate DB)             │
└─────────────────────────────────────────────────────────┘
```

### Request Lifecycle

1. Browser sends request with `floorhub_token` HTTP-only cookie
2. `middleware.ts` runs at the Edge — decodes JWT (no DB call), checks role, redirects if needed
3. Page or Route Handler renders/executes
4. Route Handlers call `lib/db.ts` helpers using `@vercel/postgres` `sql` tagged template literals
5. Responses return JSON or binary (PDF)

### Authentication Flow

```
POST /api/auth/login
  → bcrypt.compare(password, hash)
  → jose.SignJWT({ user_id, email, role, name })
  → Set-Cookie: floorhub_token=<jwt>; HttpOnly; SameSite=Lax; Secure; Max-Age=86400
  → redirect to /
```

All subsequent requests carry the cookie automatically. Route Handlers call `getAuthUser(request)` from `lib/auth.ts` which uses `jose.jwtVerify` to decode the cookie value.

---

## Components and Interfaces

### Project Structure

```
/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx          # Login + setup-flow detection
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar + auth guard (server component)
│   │   ├── page.tsx                # Dashboard
│   │   ├── invoices/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── customers/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── leads/page.tsx
│   │   ├── expenses/page.tsx
│   │   ├── contractors/page.tsx
│   │   ├── employees/page.tsx
│   │   ├── commissions/page.tsx
│   │   ├── messages/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── analytics/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   ├── me/route.ts
│       │   ├── register/route.ts
│       │   ├── setup-status/route.ts
│       │   └── change-password/route.ts
│       ├── products/
│       │   └── [id]/route.ts
│       ├── customers/
│       │   └── [id]/route.ts
│       ├── invoices/
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── pdf/route.ts
│       │       ├── send-email/route.ts
│       │       ├── create-checkout/route.ts
│       │       ├── payment-status/route.ts
│       │       ├── manual-payment/route.ts
│       │       └── convert-to-invoice/route.ts
│       ├── leads/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   └── facebook-webhook/route.ts
│       ├── expenses/
│       │   └── [id]/route.ts
│       ├── contractors/
│       │   └── [id]/route.ts
│       ├── users/
│       │   ├── route.ts
│       │   ├── create-employee/route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── commission-rate/route.ts
│       ├── commissions/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── mark-paid/route.ts
│       │       └── mark-unpaid/route.ts
│       ├── messages/
│       │   ├── route.ts
│       │   ├── unread-count/route.ts
│       │   └── [id]/mark-read/route.ts
│       ├── reports/
│       │   ├── financial/route.ts
│       │   └── transactions/route.ts
│       ├── analytics/route.ts
│       ├── dashboard/stats/route.ts
│       ├── settings/
│       │   ├── route.ts
│       │   └── logo/route.ts
│       └── address/
│           ├── suggestions/route.ts
│           └── states/route.ts
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Client component, role-aware nav
│   │   └── TopBar.tsx
│   └── ui/                         # shadcn/ui components (migrated from frontend/src/components/ui)
├── lib/
│   ├── db.ts                       # @vercel/postgres sql helper + typed query wrappers
│   ├── auth.ts                     # jose JWT sign/verify, getAuthUser(request)
│   ├── pdf.ts                      # @react-pdf/renderer invoice/estimate generator
│   └── schema.ts                   # CREATE TABLE IF NOT EXISTS for all 13 tables
├── middleware.ts                    # Edge middleware: auth redirect + employee RBAC
├── instrumentation.ts              # Runs schema.ts on startup via register()
├── tailwind.config.ts              # Migrated from frontend/tailwind.config.js
├── components.json                 # shadcn/ui config
└── vercel.json
```

### License Server Structure

```
license-server/
├── app/
│   └── api/
│       ├── check-license/route.ts      # POST { domain } → { licensed: bool }
│       └── admin/
│           └── domains/
│               ├── route.ts            # POST (add domain), ADMIN_SECRET header
│               └── [domain]/route.ts   # DELETE (remove domain), ADMIN_SECRET header
└── lib/
    └── db.ts                           # @vercel/postgres, licensed_domains table
```

### Key Library Interfaces

**`lib/auth.ts`**
```typescript
export async function signToken(payload: { user_id: string; email: string; role: string; name: string }): Promise<string>
export async function verifyToken(token: string): Promise<JWTPayload>
export async function getAuthUser(request: NextRequest): Promise<JWTPayload>  // throws 401 if invalid
export function setAuthCookie(response: NextResponse, token: string): void
export function clearAuthCookie(response: NextResponse): void
```

**`lib/db.ts`**
```typescript
import { sql } from '@vercel/postgres'
export { sql }
// Typed query helpers per domain (e.g., getInvoiceById, upsertCommission)
```

**`lib/pdf.ts`**
```typescript
export async function generateInvoicePDF(invoice: InvoiceWithItems, settings: Settings): Promise<Buffer>
```

**`middleware.ts`**
```typescript
// Matcher: /((?!api|_next/static|_next/image|favicon.ico).*)
// 1. No cookie → redirect /login
// 2. Invalid JWT → redirect /login
// 3. role === 'employee' && path not in ['/invoices', '/invoices/*'] → redirect /invoices
// 4. Otherwise → NextResponse.next()
```

---

## Data Models

### PostgreSQL Schema (13 tables, unchanged from Python backend)

```sql
-- users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  password TEXT NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL,
  cost_price NUMERIC(10,2) NOT NULL,
  selling_price NUMERIC(10,2) NOT NULL,
  sqft_per_box NUMERIC(10,4) NOT NULL,
  stock_boxes INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  zip_code TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  customer_address TEXT DEFAULT '',
  subtotal NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  total NUMERIC(10,2) NOT NULL,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  is_estimate BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- invoice_items
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sqft_needed NUMERIC(10,4) NOT NULL,
  sqft_per_box NUMERIC(10,4) NOT NULL,
  boxes_needed INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL
);

-- leads
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT DEFAULT '',
  project_type TEXT DEFAULT '',
  estimated_sqft NUMERIC(10,4) DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  reference_number TEXT DEFAULT '',
  vendor_name TEXT DEFAULT '',
  date TEXT NOT NULL,
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- contractors
CREATE TABLE IF NOT EXISTS contractors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  specialty TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  rating INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- settings (single row, id = 'company_settings')
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'company_settings',
  company_name TEXT DEFAULT '',
  company_address TEXT DEFAULT '',
  company_phone TEXT DEFAULT '',
  company_email TEXT DEFAULT '',
  tax_rate NUMERIC(5,2) DEFAULT 0.0,
  facebook_api_token TEXT DEFAULT '',
  facebook_page_id TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Migration applied at startup:
ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';

-- payment_transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'initiated',
  invoice_id TEXT,
  customer_email TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- manual_payments
CREATE TABLE IF NOT EXISTS manual_payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  date TEXT NOT NULL,
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  created_by TEXT DEFAULT '',
  created_by_name TEXT DEFAULT '',
  read_by TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- commissions
CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  profit NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  date_paid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invoice_id, employee_id)
);
```

### License Server Schema

```sql
CREATE TABLE IF NOT EXISTS licensed_domains (
  id SERIAL PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### TypeScript Types (key types in `types/index.ts`)

```typescript
export type Role = 'owner' | 'employee'

export interface JWTPayload {
  user_id: string
  email: string
  role: Role
  name: string
  exp: number
}

export interface InvoiceItem {
  product_id: string
  product_name: string
  sqft_needed: number
  sqft_per_box: number
  boxes_needed: number      // always ceil(sqft_needed / sqft_per_box)
  unit_price: number
  total_price: number
}

export interface Invoice {
  id: string
  invoice_number: string    // INV-YYYYMM-NNNN or EST-YYYYMM-NNNN
  customer_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  items: InvoiceItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount: number
  total: number
  notes: string
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
  is_estimate: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface Commission {
  id: string
  employee_id: string
  employee_name: string
  invoice_id: string
  invoice_number: string
  invoice_date: string
  profit: number
  commission_rate: number
  commission_amount: number  // max(0, profit) * commission_rate / 100
  status: 'unpaid' | 'paid'
  date_paid: string | null
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Box calculation ceiling

*For any* positive `sqft_needed` and positive `sqft_per_box`, the computed `boxes_needed` must equal `Math.ceil(sqft_needed / sqft_per_box)` and must be at least 1.

**Validates: Requirements 10.2**

### Property 2: Commission formula non-negativity and correctness

*For any* profit value and commission rate in [0, 100], the computed `commission_amount` must equal `Math.max(0, profit) * rate / 100`, which is always ≥ 0.

**Validates: Requirements 19.1**

### Property 3: JWT round-trip

*For any* valid payload `{ user_id, email, role, name }`, signing with `signToken` then verifying with `verifyToken` must return a payload with identical `user_id`, `email`, `role`, and `name` fields.

**Validates: Requirements 2.1, 2.3, 2.7**

### Property 4: Domain extraction from email

*For any* string containing exactly one or more `@` characters, the extracted domain must equal the substring after the last `@` character, lowercased.

**Validates: Requirements 4.1**

### Property 5: PDF generation never produces empty output

*For any* valid `Invoice` object with at least one item and a non-empty `Settings` object, calling `generateInvoicePDF` must return a `Buffer` with `length > 0` and must not throw.

**Validates: Requirements 11.4**

### Property 6: Protected routes reject absent or invalid tokens

*For any* Route Handler that requires authentication, a request with no `floorhub_token` cookie or a cookie containing a malformed/expired JWT must receive HTTP 401.

**Validates: Requirements 2.4, 2.5**

### Property 7: Employee role restriction on write/delete/restricted endpoints

*For any* endpoint that is restricted to owners (product delete, customer delete, invoice delete, lead delete, expense delete, contractor write/delete, user management, commission endpoints, message post, reports, analytics, settings write), a request carrying a valid JWT with `role = "employee"` must receive HTTP 403.

**Validates: Requirements 9.3, 10.6, 14.3, 15.5, 16.4, 17.3, 18.3, 19.4, 20.4, 21.3, 22.2, 23.3**

### Property 8: Middleware redirects employees away from non-invoice routes

*For any* route path that is not `/invoices` or `/invoices/[id]`, a request carrying a valid JWT with `role = "employee"` must be redirected to `/invoices` by the middleware.

**Validates: Requirements 6.3**

### Property 9: Setup-status reflects user count

*For any* database state, `GET /api/auth/setup-status` must return `{ setupRequired: true }` if and only if zero users exist in the `users` table.

**Validates: Requirements 3.1**

### Property 10: Logo upload file validation

*For any* uploaded file that either exceeds 2 MB or has a MIME type other than `image/png`, `image/jpeg`, or `image/webp`, `POST /api/settings/logo` must return HTTP 400.

**Validates: Requirements 7.3, 7.4**

### Property 11: License check domain lookup

*For any* domain string, `POST /api/check-license` on the license server must return `{ licensed: true }` if and only if that domain exists in the `licensed_domains` table.

**Validates: Requirements 5.3**

### Property 12: Invoice number format

*For any* created invoice, the `invoice_number` field must match the pattern `^(INV|EST)-\d{6}-\d{4}$` where the 6-digit segment is `YYYYMM` of the creation date.

**Validates: Requirements 10.3**

### Property 13: Registration blocked when users exist

*For any* `POST /api/auth/register` request made when one or more users already exist in the database, the response must be HTTP 403.

**Validates: Requirements 3.4**

---

## Error Handling

### HTTP Status Code Conventions

| Condition | Status |
|-----------|--------|
| Missing or invalid JWT cookie | 401 |
| Expired JWT | 401 |
| Authenticated but wrong role | 403 |
| Resource not found | 404 |
| Validation error (bad input) | 400 |
| External service error (Resend, Stripe) | 502 |
| License server unreachable | 503 |
| Unexpected server error | 500 |

### Route Handler Error Pattern

All Route Handlers follow this pattern:

```typescript
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)  // throws 401 if invalid
    // ... business logic
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### External Service Failures

- **License server timeout** (5s): return 503 `"License server unavailable. Please try again."`
- **Resend error**: return 502 `"Failed to send email."`
- **Stripe error**: return 502 with Stripe error message
- **Vercel Blob error**: return 500 (blob upload failures are unexpected)

### Middleware Error Handling

The middleware catches JWT decode errors silently and redirects to `/login` — it never returns a 4xx directly to the browser for page routes.

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- **Unit tests** verify specific examples, integration points, and error conditions
- **Property tests** verify universal invariants across randomly generated inputs

### Property-Based Testing

**Library**: `fast-check` (TypeScript-native, works in Node.js test environments)

Each property test runs a minimum of **100 iterations** (fast-check default). Each test is tagged with a comment referencing the design property it validates.

Tag format: `// Feature: nextjs-migration, Property {N}: {property_text}`

Each correctness property from this document must be implemented by exactly one property-based test.

**Example property test structure:**

```typescript
import fc from 'fast-check'
import { test, expect } from 'vitest'

// Feature: nextjs-migration, Property 1: Box calculation ceiling
test('boxes_needed = ceil(sqft_needed / sqft_per_box)', () => {
  fc.assert(
    fc.property(
      fc.float({ min: 0.01, max: 10000 }),
      fc.float({ min: 0.01, max: 1000 }),
      (sqftNeeded, sqftPerBox) => {
        const result = Math.ceil(sqftNeeded / sqftPerBox)
        expect(result).toBeGreaterThanOrEqual(1)
        expect(result).toBe(Math.ceil(sqftNeeded / sqftPerBox))
      }
    ),
    { numRuns: 100 }
  )
})
```

### Unit Tests

Unit tests focus on:
- Specific examples for auth flows (login, logout, setup flow)
- Integration points: commission trigger on invoice paid, customer upsert on invoice create
- Error conditions: missing email for send-email, wrong current password for change-password
- Schema migration: all 13 tables exist after `initSchema()` runs
- Invoice number format for a known date

### Test File Organization

```
__tests__/
├── unit/
│   ├── auth.test.ts          # login, logout, setup flow examples
│   ├── invoices.test.ts      # invoice CRUD, number format, commission trigger
│   ├── commissions.test.ts   # commission calculation examples
│   ├── schema.test.ts        # table existence after init
│   └── settings.test.ts      # logo upload, password change
└── property/
    ├── boxes.property.test.ts        # Property 1
    ├── commission.property.test.ts   # Property 2
    ├── jwt.property.test.ts          # Property 3
    ├── domain.property.test.ts       # Property 4
    ├── pdf.property.test.ts          # Property 5
    ├── auth-guard.property.test.ts   # Properties 6, 7, 8
    ├── setup-status.property.test.ts # Property 9
    ├── logo-validation.property.test.ts # Property 10
    ├── license.property.test.ts      # Property 11
    ├── invoice-number.property.test.ts # Property 12
    └── registration.property.test.ts  # Property 13
```
