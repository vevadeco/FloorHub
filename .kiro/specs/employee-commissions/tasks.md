# Implementation Plan: Employee Commissions

## Overview

Full backend migration from MongoDB/motor to PostgreSQL/SQLAlchemy async + asyncpg, followed by the employee commission feature, frontend additions, and deployment configuration. Tasks are ordered so the DB migration is a prerequisite for all subsequent work.

## Tasks

- [x] 1. Clean up dependencies and add deployment config
  - Remove `jspdf`, `cra-template`, `next-themes` from `frontend/package.json` dependencies
  - Remove dev/linting tools (`black`, `flake8`, `isort`, `mypy`, `pytest`, `pycodestyle`, `pyflakes`, `mccabe`), AI/ML packages (`google-genai`, `google-generativeai`, `google-ai-generativelanguage`, `openai`, `litellm`, `huggingface_hub`, `tokenizers`, `tiktoken`, `numpy`, `pandas`, `pillow`), and cloud/storage packages (`boto3`, `botocore`, `s3transfer`, `s5cmd`) from `backend/requirements.txt`
  - Add `sqlalchemy[asyncio]`, `asyncpg` to `backend/requirements.txt`; remove `motor`, `pymongo`
  - Create `vercel.json` at repo root with build command `cd frontend && yarn install && yarn build`, output directory `frontend/build`, and a catch-all rewrite rule to `/index.html`
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 1.1 Verify vercel.json structure
    - Assert `vercel.json` contains correct `buildCommand`, `outputDirectory`, and a rewrite from `/((?!.*\\.).*)`  to `/index.html`
    - Assert `package.json` does not contain `jspdf`, `cra-template`, `next-themes`
    - Assert `requirements.txt` does not contain removed packages; does contain `sqlalchemy`, `asyncpg`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.3, 3.4, 3.5_

- [x] 2. Migrate backend/server.py — DB layer setup
  - Replace `motor.motor_asyncio.AsyncIOMotorClient` imports with `sqlalchemy.ext.asyncio` imports (`create_async_engine`, `AsyncSession`, `sessionmaker`) and `sqlalchemy.text`
  - Remove `MONGO_URL` / `DB_NAME` env vars; read `DATABASE_URL` from environment
  - Add `get_db()` async generator dependency that yields an `AsyncSession`
  - Add `@app.on_event("startup")` handler that runs all `CREATE TABLE IF NOT EXISTS` DDL statements from the design (users, products, customers, invoices, invoice_items, leads, expenses, contractors, settings, payment_transactions, manual_payments, messages, commissions)
  - _Requirements: 4.1, 4.2, 5.1, 5.3_

- [x] 3. Migrate auth and user routes to PostgreSQL
  - Rewrite `POST /api/auth/register` using parameterised `INSERT INTO users` via `db.execute(text(...), {...})`
  - Rewrite `POST /api/auth/login` using `SELECT` from users table
  - Rewrite `GET /api/auth/me` using `SELECT` from users table
  - Add `commission_rate NUMERIC(5,2)` to `UserResponse` model (default `0.0`)
  - Rewrite `GET /api/users` to include `commission_rate` column
  - Add `PUT /api/users/{user_id}/commission-rate` endpoint (owner only) that validates 0.0–100.0 and updates the users table
  - Rewrite employee creation/deletion routes using SQL
  - All route handlers receive `db: AsyncSession = Depends(get_db)` instead of global `db`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 3.1 Write property test for commission rate round-trip (Property 1)
    - **Property 1: Commission rate round-trip**
    - **Validates: Requirements 4.1, 4.2, 4.4**
    - Use `@given(rate=st.floats(min_value=0.0, max_value=100.0))` with Hypothesis
    - Set rate via `PUT /api/users/{id}/commission-rate`, fetch via `GET /api/users`, assert stored rate equals set rate

  - [ ]* 3.2 Write property test for commission rate validation (Property 2)
    - **Property 2: Commission rate validation rejects out-of-range values**
    - **Validates: Requirements 4.3**
    - Use `@given(rate=st.one_of(st.floats(max_value=-0.001), st.floats(min_value=100.001)))`
    - Assert endpoint returns HTTP 422 and stored rate is unchanged

- [x] 4. Migrate product routes to PostgreSQL
  - Rewrite `POST /api/products`, `GET /api/products`, `GET /api/products/{id}`, `PUT /api/products/{id}`, `DELETE /api/products/{id}` using parameterised SQL
  - _Requirements: 5.1_

- [x] 5. Migrate customer routes to PostgreSQL
  - Rewrite `POST /api/customers`, `GET /api/customers`, `GET /api/customers/{id}`, `PUT /api/customers/{id}`, `DELETE /api/customers/{id}` using parameterised SQL
  - _Requirements: 5.1_

- [x] 6. Migrate invoice routes to PostgreSQL (including invoice_items normalisation)
  - Rewrite `generate_invoice_number()` using `SELECT COUNT(*)` from invoices table
  - Rewrite `POST /api/invoices`: insert into `invoices` table (scalar fields only), then insert each item into `invoice_items` table; upsert customer if not exists
  - Rewrite `GET /api/invoices` and `GET /api/invoices/{id}`: JOIN invoices with invoice_items, reconstruct `items` list in response
  - Rewrite `PUT /api/invoices/{id}`: update invoices row, delete + re-insert invoice_items rows; detect status transition to `"paid"` and call `calculate_commission(invoice_id, db)`
  - Rewrite `DELETE /api/invoices/{id}` (invoice_items cascade via FK)
  - Rewrite `POST /api/invoices/{id}/convert-to-invoice` using SQL
  - Rewrite `GET /api/invoices/{id}/pdf` to fetch invoice + items via JOIN
  - Rewrite `POST /api/invoices/{id}/send-email` to fetch invoice + items via JOIN; update status via SQL
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 7. Implement commission calculation helper
  - Add `async def calculate_commission(invoice_id: str, db: AsyncSession)` function
  - Fetch invoice row + invoice_items rows; fetch employee user by `created_by`; if no `created_by`, log warning and return
  - For each item, look up `cost_price` from products table; use `0.0` if not found
  - Compute `profit = sum(max(0, unit_price - cost_price) * boxes_needed)`; `commission_amount = max(0, profit * rate / 100)`
  - Upsert into commissions table: `INSERT ... ON CONFLICT (invoice_id, employee_id) DO UPDATE SET ...`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 7.1 Write property test for commission calculation correctness (Property 3)
    - **Property 3: Commission calculation correctness**
    - **Validates: Requirements 5.1, 5.2, 5.6**
    - Use `@given(items=st.lists(invoice_item_strategy()), rate=st.floats(min_value=0.0, max_value=100.0))`
    - Assert `commission_amount == max(0, sum((unit_price - cost_price) * boxes_needed)) * rate / 100`

  - [ ]* 7.2 Write property test for commission upsert on paid transition (Property 4)
    - **Property 4: Commission record upsert on paid transition**
    - **Validates: Requirements 5.3, 5.5**
    - Use `@given(invoice=invoice_strategy(), rate=st.floats(min_value=0.0, max_value=100.0))`
    - Assert exactly one commission record exists per `(invoice_id, employee_id)` after transition to paid

- [x] 8. Add commission API routes
  - Add `GET /api/commissions` (owner only): SELECT all rows from commissions table, return list of `CommissionRecord`
  - Add `GET /api/commissions/employee/{employee_id}` (owner or self): SELECT where `employee_id` matches; return 403 if non-owner accessing another employee's records
  - Add `POST /api/commissions/{commission_id}/mark-paid` (owner only): UPDATE commissions SET status='paid', date_paid=today; INSERT into expenses with category='employee', vendor_name=employee_name, amount=commission_amount, description=`Commission payment - {employee_name} - {invoice_number}`, date=today
  - Add `POST /api/commissions/{commission_id}/mark-unpaid` (owner only): UPDATE commissions SET status='unpaid', date_paid=NULL
  - Add `CommissionRateUpdate` and `CommissionRecord` Pydantic models
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 8.1 Write property test for GET /api/commissions returns all records (Property 5)
    - **Property 5: GET /api/commissions returns all records with required fields**
    - **Validates: Requirements 6.1**
    - Assert all inserted records are returned with required fields present

  - [ ]* 8.2 Write property test for employee commission filter (Property 6)
    - **Property 6: Employee commission filter**
    - **Validates: Requirements 6.2**
    - Use `@given(employee_id=st.uuids())` — assert only matching employee_id records returned

  - [ ]* 8.3 Write property test for mark-paid creates expense (Property 7)
    - **Property 7: Mark-paid creates expense and updates status**
    - **Validates: Requirements 6.3, 6.4, 9.1, 9.2**
    - Use `@given(commission=commission_record_strategy())`
    - Assert status='paid', date_paid set, and expense row created with correct fields

  - [ ]* 8.4 Write property test for mark-paid then mark-unpaid round-trip (Property 8)
    - **Property 8: Mark-paid then mark-unpaid restores unpaid state**
    - **Validates: Requirements 6.5**
    - Use `@given(commission=commission_record_strategy())`
    - Assert status='unpaid' and date_paid=null after round-trip

- [x] 9. Migrate remaining routes to PostgreSQL
  - Rewrite lead routes (`POST`, `GET`, `GET/{id}`, `PUT/{id}`, `DELETE/{id}`, facebook webhook) using SQL
  - Rewrite expense routes using SQL
  - Rewrite contractor routes using SQL
  - Rewrite settings routes using SQL (upsert single row with id='company_settings')
  - Rewrite payment transaction routes (Stripe webhook, manual payments) using SQL; store `metadata` as JSONB
  - Rewrite message routes using SQL; store `read_by` as `TEXT[]`
  - Rewrite reports/analytics/dashboard routes using SQL aggregations
  - _Requirements: 3.1, 3.2, 9.3, 9.4_

- [ ] 10. Checkpoint — backend migration complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Add Commissions page to frontend
  - Create `frontend/src/pages/Commissions.js`
  - Fetch all commissions from `GET /api/commissions` on mount
  - Render summary card with total unpaid and total paid commission amounts
  - Render filterable table with columns: Employee Name, Invoice Number, Invoice Date, Profit, Commission Rate, Commission Amount, Status, Action
  - "Mark Paid" button for unpaid records; "Mark Unpaid" button for paid records; each calls the respective API, shows a success toast, and refreshes the list
  - Add employee filter (select) and status filter (select: all / unpaid / paid)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 11.1 Write property test for commission table renders all columns (Property 9)
    - **Property 9: Commission table renders all required columns**
    - **Validates: Requirements 7.2**
    - Use `fc.assert(fc.property(fc.array(commissionRecordArb), records => { ... }))` with fast-check
    - Assert a row exists for each record with all required column cells

  - [ ]* 11.2 Write property test for action button matches status (Property 10)
    - **Property 10: Action button matches status**
    - **Validates: Requirements 7.3**
    - Use `fc.assert(fc.property(commissionRecordArb, record => { ... }))`
    - Assert unpaid → "Mark Paid" button; paid → "Mark Unpaid" button; never both, never neither

  - [ ]* 11.3 Write property test for summary totals (Property 11)
    - **Property 11: Summary totals are correct**
    - **Validates: Requirements 7.4**
    - Use `fc.assert(fc.property(fc.array(commissionRecordArb), records => { ... }))`
    - Assert displayed totals equal sum of commission_amount grouped by status

  - [ ]* 11.4 Write property test for filter correctness (Property 12)
    - **Property 12: Filter correctness**
    - **Validates: Requirements 7.5**
    - Use `fc.assert(fc.property(fc.array(commissionRecordArb), filterArb, (records, filter) => { ... }))`
    - Assert only records matching active filters are visible in the table

- [x] 12. Update Employees page with commission rate column
  - In `frontend/src/pages/Employees.js`, add a "Commission Rate" column to the employees table showing the current rate as a percentage
  - Add an edit icon per row that opens a dialog/inline input pre-filled with the current rate
  - On save, call `PUT /api/users/{user_id}/commission-rate`; show success toast on success
  - Validate input client-side: must be a number between 0 and 100; show validation error and block submission if invalid
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 12.1 Write property test for commission rate column renders for all employees (Property 13)
    - **Property 13: Commission rate column renders for all employees**
    - **Validates: Requirements 8.1**
    - Use `fc.assert(fc.property(fc.array(userArb), users => { ... }))`
    - Assert a "Commission Rate" cell is rendered for every user row

  - [ ]* 12.2 Write property test for commission rate UI validation (Property 14)
    - **Property 14: Commission rate UI validation**
    - **Validates: Requirements 8.4**
    - Use `fc.assert(fc.property(invalidRateArb, rate => { ... }))`
    - Assert validation error is shown and API is not called for values outside [0, 100]

- [x] 13. Wire Commissions page into App.js and Layout.js
  - In `frontend/src/App.js`, import `Commissions` from `./pages/Commissions` and add `<Route path="/commissions" element={<ProtectedRoute><Commissions /></ProtectedRoute>} />`
  - In `frontend/src/components/Layout.js`, add a `{ icon: DollarSign, label: "Commissions", path: "/commissions", ownerOnly: true }` entry to `navItems` (after Employees)
  - _Requirements: 7.1_

- [x] 14. Verify financial report includes commission expenses (Property 15)
  - Confirm `GET /api/reports/financial` aggregates expenses by category from the expenses table; since mark-paid inserts a standard expense row with category='employee', no additional changes are needed
  - Add a unit test asserting that after marking a commission paid, the financial report's `expense_by_category.employee` total includes the commission amount
  - _Requirements: 9.3, 9.4_

  - [ ]* 14.1 Write property test for financial report includes commission expenses (Property 15)
    - **Property 15: Financial report includes commission expenses**
    - **Validates: Requirements 9.4**
    - Use `@given(commissions=st.lists(commission_record_strategy(), min_size=1))`
    - Assert `expense_by_category.employee` equals sum of commission_amount for all paid commissions

- [ ] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use Hypothesis (backend) and fast-check (frontend); minimum 100 iterations each
- The DB migration (tasks 2–9) must be complete before frontend tasks (11–13) can be tested end-to-end
- `invoice_items` moves from embedded array to a separate table — all invoice reads must JOIN and reconstruct the `items` list
- `DATABASE_URL` must be in `postgresql+asyncpg://...` format for SQLAlchemy async engine
