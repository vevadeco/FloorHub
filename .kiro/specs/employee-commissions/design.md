# Design Document: Employee Commissions

## Overview

This feature adds employee commission management to FloorHub. It covers three areas:

1. **Database migration** — migrate the entire backend from MongoDB (motor) to PostgreSQL (asyncpg + SQLAlchemy async), replacing all collections with relational tables.
2. **Deployment readiness** — add `vercel.json` for craco SPA deployment, and clean up unused dependencies from `frontend/package.json` and `backend/requirements.txt`.
3. **Commission management** — store a commission rate per employee, auto-calculate commissions when an invoice is marked paid, expose a commissions API, and add a Commissions admin page to the frontend.

The design follows the existing single-file FastAPI backend pattern (`backend/server.py`) and the existing React page pattern under `frontend/src/pages/`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React 19 + Tailwind + Shadcn, craco build)   │
│                                                         │
│  /employees  ──► Employees.js  (+ commission_rate col)  │
│  /commissions ──► Commissions.js  (owner only)          │
│  frontend/src/lib/api.js  (axios, all API calls)        │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / JWT Bearer
┌────────────────────────▼────────────────────────────────┐
│  Backend (FastAPI, single file: backend/server.py)      │
│                                                         │
│  PUT  /api/users/{id}/commission-rate                   │
│  GET  /api/users  (now includes commission_rate)        │
│  GET  /api/commissions                                  │
│  GET  /api/commissions/employee/{id}                    │
│  POST /api/commissions/{id}/mark-paid                   │
│  POST /api/commissions/{id}/mark-unpaid                 │
│                                                         │
│  Commission trigger: inside update_invoice() when       │
│  status transitions to "paid"                           │
└────────────────────────┬────────────────────────────────┘
                         │ asyncpg / SQLAlchemy async
┌────────────────────────▼────────────────────────────────┐
│  PostgreSQL                                             │
│  tables: users, products, customers, invoices,          │
│          invoice_items, leads, expenses, contractors,   │
│          settings, payment_transactions,                │
│          manual_payments, messages,                     │
│          commissions (new)                              │
└─────────────────────────────────────────────────────────┘
```

**Deployment topology:**
- Frontend: Vercel (static SPA, craco build output at `frontend/build`)
- Backend: separate host (e.g. Railway, Render, Fly.io) with a managed PostgreSQL instance
- `vercel.json` at repo root handles SPA routing rewrites; no backend serverless functions in Vercel config
- `DATABASE_URL` environment variable replaces `MONGO_URL` and `DB_NAME`

---

## Components and Interfaces

### 1. vercel.json (new file at repo root)

Configures Vercel to build the craco SPA and rewrite all non-file paths to `index.html`.

### 2. Database layer (backend/server.py)

Replace motor/MongoDB with SQLAlchemy async + asyncpg.

**Connection setup:**
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy import text

DATABASE_URL = os.environ['DATABASE_URL']  # postgresql+asyncpg://...
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

**Session dependency:**
```python
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

All route handlers receive `db: AsyncSession = Depends(get_db)` instead of using the global `db` object.

**Schema creation:** On startup, run `CREATE TABLE IF NOT EXISTS` statements for all tables (no ORM migrations needed for this project — raw SQL DDL in a startup event).

### 3. backend/server.py — full migration

Every route that previously used `db.<collection>.find_one(...)`, `db.<collection>.insert_one(...)`, etc. is rewritten to use parameterised SQL via `await db.execute(text(...), {...})`.

Invoice items are stored in a separate `invoice_items` table (normalised) rather than as embedded JSON. The `invoices` table stores scalar fields only; items are joined when fetching.

For fields that were previously free-form JSON (e.g. `metadata` on payment transactions, `read_by` list on messages), use PostgreSQL `JSONB` or `TEXT[]` columns.

### 4. New Pydantic models

```python
class CommissionRateUpdate(BaseModel):
    commission_rate: float  # validated: 0.0 <= x <= 100.0

class CommissionRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    invoice_id: str
    invoice_number: str
    invoice_date: str
    profit: float
    commission_rate: float
    commission_amount: float
    status: str = "unpaid"   # "unpaid" | "paid"
    date_paid: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

### 5. UserResponse (modified)

```python
class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    commission_rate: float = 0.0
```

### 6. New/modified routes

- `PUT /api/users/{user_id}/commission-rate` — owner only, validates 0–100, updates `users` table
- `GET /api/users` — modified to include `commission_rate` column
- `PUT /api/invoices/{invoice_id}` — modified to call `calculate_commission()` when status transitions to `"paid"`
- `GET /api/commissions` — owner only, returns all commission records
- `GET /api/commissions/employee/{employee_id}` — owner or self
- `POST /api/commissions/{commission_id}/mark-paid` — owner only, sets status + inserts expense row
- `POST /api/commissions/{commission_id}/mark-unpaid` — owner only, reverts status

### 7. New helper function

```python
async def calculate_commission(invoice_id: str, db: AsyncSession):
    # 1. Fetch invoice + items + employee
    # 2. For each item, look up product.cost_price
    # 3. profit = sum(max(0, unit_price - cost_price) * boxes_needed)
    # 4. commission_amount = max(0, profit * rate / 100)
    # 5. Upsert into commissions ON CONFLICT (invoice_id, employee_id) DO UPDATE
```

### 8. frontend/src/pages/Commissions.js (new)

Owner-only page at `/commissions`. Displays a summary card (total unpaid / total paid) and a filterable table of all commission records with Mark Paid / Mark Unpaid actions.

### 9. frontend/src/pages/Employees.js (modified)

Adds a "Commission Rate" column with an inline edit dialog per row.

### 10. frontend/src/App.js (modified)

Adds `<Route path="/commissions" ...>` with `Commissions` page.

### 11. frontend/src/components/Layout.js (modified)

Adds a "Commissions" nav item (owner only) with a `DollarSign` icon.

### 12. Dependency changes

**backend/requirements.txt:**
- Remove: `motor`, `pymongo`, all dev/AI/ML/cloud packages (see Requirements 2–3)
- Add: `sqlalchemy[asyncio]`, `asyncpg`, `alembic` (optional, for future migrations)

**frontend/package.json:**
- Remove: `jspdf`, `cra-template`, `next-themes`

---

## Data Models

### PostgreSQL schema

```sql
-- Users
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'employee',
    password    TEXT NOT NULL,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    sku             TEXT NOT NULL,
    category        TEXT NOT NULL,
    cost_price      NUMERIC(10,2) NOT NULL,
    selling_price   NUMERIC(10,2) NOT NULL,
    sqft_per_box    NUMERIC(10,4) NOT NULL,
    stock_boxes     INTEGER NOT NULL DEFAULT 0,
    description     TEXT DEFAULT '',
    supplier        TEXT DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT DEFAULT '',
    phone       TEXT DEFAULT '',
    address     TEXT DEFAULT '',
    city        TEXT DEFAULT '',
    state       TEXT DEFAULT '',
    zip_code    TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id               TEXT PRIMARY KEY,
    invoice_number   TEXT NOT NULL,
    customer_id      TEXT NOT NULL,
    customer_name    TEXT NOT NULL,
    customer_email   TEXT DEFAULT '',
    customer_phone   TEXT DEFAULT '',
    customer_address TEXT DEFAULT '',
    subtotal         NUMERIC(10,2) NOT NULL,
    tax_rate         NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    tax_amount       NUMERIC(10,2) NOT NULL DEFAULT 0.0,
    discount         NUMERIC(10,2) NOT NULL DEFAULT 0.0,
    total            NUMERIC(10,2) NOT NULL,
    notes            TEXT DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'draft',
    is_estimate      BOOLEAN NOT NULL DEFAULT FALSE,
    created_by       TEXT DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoice Items (normalised from embedded array)
CREATE TABLE IF NOT EXISTS invoice_items (
    id              TEXT PRIMARY KEY,
    invoice_id      TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id      TEXT NOT NULL,
    product_name    TEXT NOT NULL,
    sqft_needed     NUMERIC(10,4) NOT NULL,
    sqft_per_box    NUMERIC(10,4) NOT NULL,
    boxes_needed    INTEGER NOT NULL,
    unit_price      NUMERIC(10,2) NOT NULL,
    total_price     NUMERIC(10,2) NOT NULL
);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT DEFAULT '',
    phone           TEXT DEFAULT '',
    source          TEXT NOT NULL DEFAULT 'manual',
    status          TEXT NOT NULL DEFAULT 'new',
    notes           TEXT DEFAULT '',
    project_type    TEXT DEFAULT '',
    estimated_sqft  NUMERIC(10,4) DEFAULT 0.0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id               TEXT PRIMARY KEY,
    category         TEXT NOT NULL,
    description      TEXT NOT NULL,
    amount           NUMERIC(10,2) NOT NULL,
    payment_method   TEXT DEFAULT 'cash',
    reference_number TEXT DEFAULT '',
    vendor_name      TEXT DEFAULT '',
    date             TEXT NOT NULL,
    created_by       TEXT DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contractors
CREATE TABLE IF NOT EXISTS contractors (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    company     TEXT DEFAULT '',
    phone       TEXT NOT NULL,
    email       TEXT DEFAULT '',
    specialty   TEXT DEFAULT '',
    address     TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    rating      INTEGER DEFAULT 5,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings (single row)
CREATE TABLE IF NOT EXISTS settings (
    id                  TEXT PRIMARY KEY DEFAULT 'company_settings',
    company_name        TEXT DEFAULT '',
    company_address     TEXT DEFAULT '',
    company_phone       TEXT DEFAULT '',
    company_email       TEXT DEFAULT '',
    tax_rate            NUMERIC(5,2) DEFAULT 0.0,
    facebook_api_token  TEXT DEFAULT '',
    facebook_page_id    TEXT DEFAULT '',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment Transactions (Stripe)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    amount          NUMERIC(10,2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'usd',
    status          TEXT NOT NULL DEFAULT 'pending',
    payment_status  TEXT NOT NULL DEFAULT 'initiated',
    invoice_id      TEXT,
    customer_email  TEXT DEFAULT '',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manual Payments
CREATE TABLE IF NOT EXISTS manual_payments (
    id               TEXT PRIMARY KEY,
    invoice_id       TEXT NOT NULL,
    amount           NUMERIC(10,2) NOT NULL,
    payment_method   TEXT NOT NULL DEFAULT 'cash',
    reference_number TEXT DEFAULT '',
    notes            TEXT DEFAULT '',
    date             TEXT NOT NULL,
    created_by       TEXT DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    priority        TEXT NOT NULL DEFAULT 'normal',
    created_by      TEXT DEFAULT '',
    created_by_name TEXT DEFAULT '',
    read_by         TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Commissions (new)
CREATE TABLE IF NOT EXISTS commissions (
    id               TEXT PRIMARY KEY,
    employee_id      TEXT NOT NULL,
    employee_name    TEXT NOT NULL,
    invoice_id       TEXT NOT NULL,
    invoice_number   TEXT NOT NULL,
    invoice_date     TEXT NOT NULL,
    profit           NUMERIC(10,2) NOT NULL DEFAULT 0.0,
    commission_rate  NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0.0,
    status           TEXT NOT NULL DEFAULT 'unpaid',
    date_paid        TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (invoice_id, employee_id)
);
```

---

## Correctness Properties

### Property 1: Commission rate round-trip

*For any* employee user and any commission rate value in [0.0, 100.0], setting the rate via `PUT /api/users/{id}/commission-rate` and then fetching the user via `GET /api/users` should return the same rate that was set.

**Validates: Requirements 4.1, 4.2, 4.4**

### Property 2: Commission rate validation rejects out-of-range values

*For any* commission rate value strictly less than 0.0 or strictly greater than 100.0, the `PUT /api/users/{id}/commission-rate` endpoint should return HTTP 422 and the stored rate should remain unchanged.

**Validates: Requirements 4.3**

### Property 3: Commission calculation correctness

*For any* invoice with any set of line items and any employee with any commission rate, the calculated `commission_amount` stored in the commission record should equal `max(0, sum((item.unit_price - product.cost_price) * item.boxes_needed for each item)) * (commission_rate / 100)`.

**Validates: Requirements 5.1, 5.2, 5.6**

### Property 4: Commission record upsert on paid transition

*For any* invoice that transitions to `paid` status, exactly one commission record should exist for the `(invoice_id, employee_id)` pair (enforced by the `UNIQUE` constraint), and its `commission_amount` should reflect the current invoice items and employee rate.

**Validates: Requirements 5.3, 5.5**

### Property 5: GET /api/commissions returns all records with required fields

*For any* set of commission records in the database, `GET /api/commissions` should return all of them, each containing `employee_name`, `invoice_number`, `invoice_date`, `profit`, `commission_amount`, and `status`.

**Validates: Requirements 6.1**

### Property 6: Employee commission filter

*For any* employee ID, `GET /api/commissions/employee/{employee_id}` should return only records where `employee_id` matches.

**Validates: Requirements 6.2**

### Property 7: Mark-paid creates expense and updates status

*For any* unpaid commission record, calling `POST /api/commissions/{id}/mark-paid` should result in: (a) `status = "paid"` with `date_paid` set to today, and (b) a new row in `expenses` with `category="employee"`, `vendor_name=employee_name`, `amount=commission_amount`.

**Validates: Requirements 6.3, 6.4, 9.1, 9.2**

### Property 8: Mark-paid then mark-unpaid restores unpaid state

*For any* commission record, mark-paid followed by mark-unpaid should result in `status="unpaid"` and `date_paid=null`.

**Validates: Requirements 6.5**

### Property 9: Commission table renders all required columns

*For any* list of commission records, the rendered Commissions page table should contain a row for each record with all required columns.

**Validates: Requirements 7.2**

### Property 10: Action button matches status

*For any* commission record, `status="unpaid"` shows "Mark Paid" and `status="paid"` shows "Mark Unpaid" — never both, never neither.

**Validates: Requirements 7.3**

### Property 11: Summary totals are correct

*For any* set of commission records, the summary card totals should equal the sum of `commission_amount` grouped by status.

**Validates: Requirements 7.4**

### Property 12: Filter correctness

*For any* combination of employee and status filters, only matching records should be visible.

**Validates: Requirements 7.5**

### Property 13: Commission rate column renders for all employees

*For any* list of users, the Employees page should render a "Commission Rate" cell for every row.

**Validates: Requirements 8.1**

### Property 14: Commission rate UI validation

*For any* value outside [0, 100], the Employees page should show a validation error and not call the API.

**Validates: Requirements 8.4**

### Property 15: Financial report includes commission expenses

*For any* set of commissions marked as paid, `GET /api/reports/financial` `expense_by_category.employee` should include those commission amounts.

**Validates: Requirements 9.4**

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `commission_rate` outside [0, 100] | HTTP 422 with validation detail |
| `user_id` not found on commission-rate PUT | HTTP 404 |
| `commission_id` not found on mark-paid/unpaid | HTTP 404 |
| `employee_id` not found when calculating commission | Skip commission creation, log warning |
| Product `cost_price` not found for an invoice item | Use `0.0` as cost price |
| Invoice has no `created_by` | Skip commission calculation silently |
| Non-owner accessing owner-only endpoints | HTTP 403 |
| Employee accessing another employee's commissions | HTTP 403 |
| Invoice profit is zero or negative | `commission_amount = 0.0`, record still created |
| DB connection failure | HTTP 500, logged |

---

## Testing Strategy

### Unit tests

- `vercel.json` has correct build command, output dir, and rewrite rule
- `package.json` does not contain `jspdf`, `cra-template`, `next-themes`
- `requirements.txt` does not contain dev/AI/cloud packages; does contain `sqlalchemy`, `asyncpg`
- Commission calculation with zero-profit invoice returns `commission_amount = 0.0`
- Commission calculation when a product is missing uses `cost_price = 0.0`
- `GET /api/commissions/employee/{id}` returns 403 for a different employee
- Commission record not created when invoice has no `created_by`
- `GET /api/users` returns `commission_rate = 0.0` for users without the field set

### Property-based tests

Use **Hypothesis** (Python) for backend, **fast-check** (JS) for frontend. Minimum 100 iterations each.

**Backend (Hypothesis):**

```python
# Feature: employee-commissions, Property 1: commission rate round-trip
@given(rate=st.floats(min_value=0.0, max_value=100.0))
def test_commission_rate_round_trip(rate): ...

# Feature: employee-commissions, Property 2: commission rate validation
@given(rate=st.one_of(st.floats(max_value=-0.001), st.floats(min_value=100.001)))
def test_commission_rate_rejects_out_of_range(rate): ...

# Feature: employee-commissions, Property 3: commission calculation correctness
@given(items=st.lists(invoice_item_strategy()), rate=st.floats(min_value=0.0, max_value=100.0))
def test_commission_calculation(items, rate): ...

# Feature: employee-commissions, Property 4: commission record upsert
@given(invoice=invoice_strategy(), rate=st.floats(min_value=0.0, max_value=100.0))
def test_commission_upsert_on_paid_transition(invoice, rate): ...

# Feature: employee-commissions, Property 7: mark-paid creates expense
@given(commission=commission_record_strategy())
def test_mark_paid_creates_expense_and_updates_status(commission): ...

# Feature: employee-commissions, Property 8: mark-paid then mark-unpaid round-trip
@given(commission=commission_record_strategy())
def test_mark_paid_then_unpaid_restores_state(commission): ...

# Feature: employee-commissions, Property 15: financial report includes commission expenses
@given(commissions=st.lists(commission_record_strategy(), min_size=1))
def test_financial_report_includes_commission_expenses(commissions): ...
```

**Frontend (fast-check):**

```js
// Feature: employee-commissions, Property 9: commission table renders all columns
fc.assert(fc.property(fc.array(commissionRecordArb), records => { ... }));

// Feature: employee-commissions, Property 10: action button matches status
fc.assert(fc.property(commissionRecordArb, record => { ... }));

// Feature: employee-commissions, Property 11: summary totals
fc.assert(fc.property(fc.array(commissionRecordArb), records => { ... }));

// Feature: employee-commissions, Property 12: filter correctness
fc.assert(fc.property(fc.array(commissionRecordArb), filterArb, (records, filter) => { ... }));

// Feature: employee-commissions, Property 13: commission rate column
fc.assert(fc.property(fc.array(userArb), users => { ... }));

// Feature: employee-commissions, Property 14: commission rate UI validation
fc.assert(fc.property(invalidRateArb, rate => { ... }));
```
