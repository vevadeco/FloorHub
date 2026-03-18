# Requirements Document

## Introduction

This document covers the full migration of FloorHub — a flooring store management system — from a Python FastAPI backend + React CRA frontend to a single Next.js 14 App Router full-stack application deployed on Vercel. The migration preserves all existing features exactly while introducing three new capabilities: a license validation system for owner registration, stricter middleware-enforced role access, and store branding with a custom logo. A companion minimal Next.js app (the "license server") is also specified here.

All existing functionality (Dashboard, Invoices, Estimates, Invoice Detail, Customers, Inventory/Products, Leads, Expenses, Contractors, Employees, Commissions, Messages, Reports, Analytics, Settings) must be preserved with identical behavior.

---

## Glossary

- **App**: The main FloorHub Next.js 14 full-stack application.
- **License_Server**: The separate minimal Next.js app deployed to Vercel that manages authorized email domains.
- **Owner**: A user with `role = "owner"`. The first user registered in the system.
- **Employee**: A user with `role = "employee"`. Created by the Owner via the Employees page.
- **JWT**: JSON Web Token stored in an HTTP-only cookie, used for session authentication.
- **License**: A record in the License_Server database associating an email domain with a valid FloorHub subscription.
- **Domain**: The part of an email address after the `@` symbol (e.g., `floorhub.com`).
- **Setup_Flow**: The registration screen shown when no users exist in the database.
- **Middleware**: Next.js Edge Middleware (`middleware.ts`) that runs before every request.
- **Route_Handler**: A Next.js App Router API route (`app/api/.../route.ts`).
- **Server_Action**: A Next.js server-side function called directly from React Server Components or Client Components.
- **Vercel_Postgres**: The Neon-backed PostgreSQL database accessed via `@vercel/postgres`.
- **Vercel_Blob**: Vercel's object storage service used for logo uploads.
- **PDF_Generator**: The server-side module using `pdf-lib` or `@react-pdf/renderer` to produce invoice/estimate PDFs.
- **Resend**: The transactional email service accessed via the Resend Node.js SDK.
- **Stripe**: The payment processing service accessed via the Stripe Node.js SDK.
- **Settings_Table**: The single-row `settings` table in Vercel_Postgres storing company configuration including logo.
- **Commission**: A calculated payment owed to an Employee based on profit from a paid invoice.
- **Sidebar**: The persistent navigation component visible to authenticated users.

---

## Requirements

### Requirement 1: Project Structure and Technology Stack

**User Story:** As a developer, I want the application rebuilt as a single Next.js 14 App Router project, so that the frontend and backend share one codebase and deploy as a single Vercel project.

#### Acceptance Criteria

1. THE App SHALL be implemented using Next.js 14 with the App Router (`app/` directory).
2. THE App SHALL use Vercel_Postgres via `@vercel/postgres` as the sole database client.
3. THE App SHALL preserve the existing 13-table PostgreSQL schema without modification to column names or types.
4. THE App SHALL preserve all existing shadcn/ui components and the existing Tailwind CSS configuration.
5. THE App SHALL replace all Python ReportLab PDF generation with PDF_Generator using `pdf-lib` or `@react-pdf/renderer`.
6. THE App SHALL replace all Python Resend calls with the Resend Node.js SDK.
7. THE App SHALL replace all Python Stripe calls with the Stripe Node.js SDK.
8. THE App SHALL remove the `frontend/` and `backend/` directories upon completion of the migration.

---

### Requirement 2: Authentication — JWT in HTTP-only Cookies

**User Story:** As a user, I want my session to be stored securely in an HTTP-only cookie, so that my token is not accessible to JavaScript and is protected from XSS attacks.

#### Acceptance Criteria

1. WHEN a user successfully logs in, THE App SHALL issue a JWT stored in an HTTP-only, `SameSite=Lax`, `Secure` cookie named `floorhub_token`.
2. WHEN a user successfully logs in, THE App SHALL NOT return the JWT in the response body or store it in `localStorage`.
3. WHEN a request arrives at any protected Route_Handler, THE App SHALL read the JWT from the `floorhub_token` cookie and validate it.
4. IF the `floorhub_token` cookie is absent or contains an invalid JWT, THEN THE App SHALL return HTTP 401.
5. IF the `floorhub_token` cookie contains an expired JWT, THEN THE App SHALL return HTTP 401.
6. WHEN a user logs out, THE App SHALL clear the `floorhub_token` cookie by setting it with `Max-Age=0`.
7. THE App SHALL sign JWTs using a secret read from the `JWT_SECRET` environment variable.
8. THE App SHALL set JWT expiry to 24 hours from issuance.

---

### Requirement 3: Setup Flow — First-Run Owner Registration

**User Story:** As a store owner setting up FloorHub for the first time, I want to register my account on first launch, so that I become the system owner without needing a pre-existing account.

#### Acceptance Criteria

1. WHEN a request is made to `GET /api/auth/setup-status`, THE App SHALL return `{ "setupRequired": true }` if zero users exist in the database, and `{ "setupRequired": false }` otherwise.
2. WHEN `setupRequired` is `true`, THE App SHALL display the Setup_Flow registration form instead of the login form.
3. WHEN the Setup_Flow form is submitted, THE App SHALL assign `role = "owner"` to the first registered user regardless of any role field in the request body.
4. IF a registration request arrives at `POST /api/auth/register` and one or more users already exist, THEN THE App SHALL return HTTP 403 with the message `"Owner already registered. Use employee creation instead."`.
5. THE App SHALL hash passwords using bcrypt before storing them in the database.

---

### Requirement 4: License Validation for Owner Registration

**User Story:** As the FloorHub developer, I want owner registration to be gated by a valid license for the store's email domain, so that only paying customers can activate a new FloorHub instance.

#### Acceptance Criteria

1. WHEN the Setup_Flow form is submitted with an owner email, THE App SHALL extract the Domain from the email address.
2. WHEN the Domain is extracted, THE App SHALL send a `POST` request to `{LICENSE_SERVER_URL}/api/check-license` with body `{ "domain": "<domain>" }` before creating the user.
3. IF the License_Server responds with `{ "licensed": true }`, THEN THE App SHALL proceed with owner registration.
4. IF the License_Server responds with `{ "licensed": false }` or returns a non-2xx status, THEN THE App SHALL return HTTP 403 with the message `"This domain is not licensed for FloorHub."` and SHALL NOT create the user.
5. IF the License_Server is unreachable (network error or timeout after 5 seconds), THEN THE App SHALL return HTTP 503 with the message `"License server unavailable. Please try again."`.
6. THE App SHALL read the License_Server base URL from the `LICENSE_SERVER_URL` environment variable.
7. Employee account creation (via `POST /api/users/create-employee`) SHALL NOT perform any license check.

---

### Requirement 5: License Server Application

**User Story:** As the FloorHub developer, I want a separate minimal Vercel app to manage licensed domains, so that I can authorize or revoke FloorHub installations without touching the main app.

#### Acceptance Criteria

1. THE License_Server SHALL be a separate Next.js application deployable to Vercel independently of the App.
2. THE License_Server SHALL store licensed domains in its own Vercel_Postgres database table with columns `(id, domain, created_at)`.
3. WHEN `POST /api/check-license` is called with `{ "domain": "<domain>" }`, THE License_Server SHALL return `{ "licensed": true }` if the domain exists in the table, and `{ "licensed": false }` otherwise.
4. THE License_Server SHALL expose a developer-only admin API at `POST /api/admin/domains` to add a domain, protected by a `ADMIN_SECRET` header matching the `ADMIN_SECRET` environment variable.
5. THE License_Server SHALL expose a developer-only admin API at `DELETE /api/admin/domains/:domain` to remove a domain, protected by the same `ADMIN_SECRET` header.
6. IF a request to `/api/admin/domains` or `/api/admin/domains/:domain` is missing or has an incorrect `ADMIN_SECRET` header, THEN THE License_Server SHALL return HTTP 401.
7. THE License_Server SHALL NOT require user authentication beyond the `ADMIN_SECRET` header for admin routes.

---

### Requirement 6: Middleware-Enforced Role-Based Access Control

**User Story:** As a store owner, I want employees to be restricted to the Invoices page only at the infrastructure level, so that they cannot access sensitive business data even by navigating directly to a URL.

#### Acceptance Criteria

1. THE Middleware SHALL run on all routes matching `/((?!api|_next/static|_next/image|favicon.ico).*)`.
2. WHEN a request arrives and the `floorhub_token` cookie is absent or invalid, THE Middleware SHALL redirect the request to `/login`.
3. WHEN a request arrives from a user with `role = "employee"` for any route other than `/invoices` and `/invoices/[id]`, THE Middleware SHALL redirect the request to `/invoices`.
4. WHEN a request arrives from a user with `role = "owner"`, THE Middleware SHALL allow the request to proceed to any route.
5. THE Middleware SHALL decode the JWT from the `floorhub_token` cookie to determine the user's role without making a database call.
6. THE Sidebar SHALL render only the "Invoices" navigation item for users with `role = "employee"`.
7. WHILE a user has `role = "employee"`, THE App SHALL NOT render navigation links to Dashboard, Leads, Expenses, Inventory, Customers, Contractors, Employees, Commissions, Messages, Reports, Analytics, or Settings in the Sidebar.

---

### Requirement 7: Store Branding — Logo Upload and Display

**User Story:** As a store owner, I want to upload my store's logo in Settings, so that it appears in the app sidebar and on all generated PDF invoices.

#### Acceptance Criteria

1. WHEN the owner visits the Settings page, THE App SHALL display a logo upload control accepting PNG, JPG, and WebP files up to 2 MB.
2. WHEN a valid logo file is uploaded, THE App SHALL store the logo in Vercel_Blob and persist the resulting public URL in the `logo_url` column of the Settings_Table.
3. IF an uploaded file exceeds 2 MB, THEN THE App SHALL return HTTP 400 with the message `"Logo file must be 2 MB or smaller."`.
4. IF an uploaded file is not PNG, JPG, or WebP, THEN THE App SHALL return HTTP 400 with the message `"Logo must be a PNG, JPG, or WebP image."`.
5. WHEN a `logo_url` is present in the Settings_Table, THE Sidebar SHALL display the logo image above the navigation items in place of the default "FloorHub" text logo.
6. WHEN a `logo_url` is present in the Settings_Table, THE PDF_Generator SHALL embed the logo image at the top of every generated invoice and estimate PDF.
7. WHEN no `logo_url` is set, THE Sidebar SHALL display the default text/icon logo and THE PDF_Generator SHALL omit the logo from PDFs.
8. THE App SHALL add a `logo_url TEXT DEFAULT ''` column to the Settings_Table via a migration applied at startup.

---

### Requirement 8: Dashboard

**User Story:** As a store owner, I want a dashboard showing key business metrics, so that I can quickly assess the health of my store.

#### Acceptance Criteria

1. WHEN an owner visits `/`, THE App SHALL display total revenue from paid invoices, net income (revenue minus expenses), new leads count, pending invoices count, products count, total customers count, and total expenses.
2. WHEN an owner visits `/`, THE App SHALL display the 5 most recent invoices with invoice number, customer name, total, and status.
3. WHEN an owner visits `/`, THE App SHALL display the 5 most recent leads with name, project type or source, and status.
4. THE App SHALL serve dashboard data from `GET /api/dashboard/stats` as a Route_Handler.

---

### Requirement 9: Inventory Management

**User Story:** As a store owner or employee, I want to manage flooring products, so that I can track stock and use products when creating invoices.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/products`, `POST /api/products`, `PUT /api/products/[id]`, and `DELETE /api/products/[id]` Route_Handlers.
2. WHEN a product is created or updated, THE App SHALL require `name`, `sku`, `category`, `cost_price`, `selling_price`, and `sqft_per_box` fields.
3. IF a `DELETE /api/products/[id]` request is made by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.
4. THE App SHALL display products in a searchable, filterable table on the `/inventory` page.

---

### Requirement 10: Invoices and Estimates

**User Story:** As a store owner or employee, I want to create invoices and estimates that automatically calculate box quantities from square footage, so that I can accurately quote and bill customers.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/invoices`, `POST /api/invoices`, `GET /api/invoices/[id]`, `PUT /api/invoices/[id]`, and `DELETE /api/invoices/[id]` Route_Handlers.
2. WHEN an invoice item is created with `sqft_needed` and `sqft_per_box`, THE App SHALL calculate `boxes_needed` as `ceil(sqft_needed / sqft_per_box)`.
3. WHEN an invoice is created, THE App SHALL auto-generate an invoice number in the format `INV-YYYYMM-NNNN` (or `EST-YYYYMM-NNNN` for estimates).
4. WHEN an invoice status is updated to `"paid"`, THE App SHALL trigger commission calculation for the employee who created the invoice.
5. WHEN an estimate is converted to an invoice via `POST /api/invoices/[id]/convert-to-invoice`, THE App SHALL create a new invoice record with a new invoice number and `is_estimate = false`.
6. IF a `DELETE /api/invoices/[id]` request is made by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.
7. THE App SHALL support filtering invoices by `is_estimate` query parameter.

---

### Requirement 11: PDF Generation

**User Story:** As a store owner or employee, I want to download a PDF of any invoice or estimate, so that I can share it with customers.

#### Acceptance Criteria

1. WHEN `GET /api/invoices/[id]/pdf` is called, THE PDF_Generator SHALL produce a PDF containing the company name, address, phone, email, invoice number, date, customer details, line items (product name, sq ft, boxes, unit price, total), subtotal, tax, discount, and grand total.
2. WHEN a `logo_url` is present in the Settings_Table, THE PDF_Generator SHALL embed the logo at the top of the PDF.
3. THE App SHALL return the PDF with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="INV-XXXXXX.pdf"`.
4. THE PDF_Generator SHALL implement a round-trip property: for all valid invoice data objects, serializing to PDF SHALL NOT throw an error or produce a zero-byte file.

---

### Requirement 12: Email Sending

**User Story:** As a store owner or employee, I want to email an invoice PDF to a customer, so that I can deliver documents without leaving the app.

#### Acceptance Criteria

1. WHEN `POST /api/invoices/[id]/send-email` is called, THE App SHALL generate the invoice PDF and send it as an attachment to the customer's email address using Resend.
2. THE App SHALL read the Resend API key from the `RESEND_API_KEY` environment variable.
3. IF the customer email address is empty, THEN THE App SHALL return HTTP 400 with the message `"Customer email is required to send invoice."`.
4. IF Resend returns an error, THEN THE App SHALL return HTTP 502 with the message `"Failed to send email."`.

---

### Requirement 13: Stripe Payment Integration

**User Story:** As a store owner, I want to collect online payments for invoices via Stripe, so that customers can pay without visiting the store.

#### Acceptance Criteria

1. WHEN `POST /api/invoices/[id]/create-checkout` is called, THE App SHALL create a Stripe Checkout Session and return the session URL.
2. THE App SHALL read the Stripe secret key from the `STRIPE_SECRET_KEY` environment variable.
3. WHEN `GET /api/invoices/[id]/payment-status` is called, THE App SHALL return the current Stripe payment status for that invoice.
4. THE App SHALL support manual payment recording via `POST /api/invoices/[id]/manual-payment` with fields `amount`, `payment_method`, `reference_number`, `notes`, and `date`.

---

### Requirement 14: Customer Management

**User Story:** As a store owner or employee, I want to manage customer records, so that I can reuse customer details when creating invoices.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/customers`, `POST /api/customers`, `PUT /api/customers/[id]`, and `DELETE /api/customers/[id]` Route_Handlers.
2. WHEN an invoice is created with a new customer ID, THE App SHALL automatically upsert the customer record into the customers table.
3. IF a `DELETE /api/customers/[id]` request is made by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.

---

### Requirement 15: Lead Management

**User Story:** As a store owner or employee, I want to track sales leads, so that I can follow up and convert prospects into customers.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/leads`, `POST /api/leads`, `PUT /api/leads/[id]`, and `DELETE /api/leads/[id]` Route_Handlers.
2. THE App SHALL support lead statuses: `new`, `contacted`, `qualified`, `proposal`, `won`, `lost`.
3. THE App SHALL support lead sources: `manual`, `facebook`, `website`.
4. THE App SHALL expose `POST /api/leads/facebook-webhook` to receive Facebook Lead Ads payloads and create lead records.
5. IF a `DELETE /api/leads/[id]` request is made by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.

---

### Requirement 16: Expense Tracking

**User Story:** As a store owner or employee, I want to record business expenses, so that I can track costs and calculate net income.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/expenses`, `POST /api/expenses`, `PUT /api/expenses/[id]`, and `DELETE /api/expenses/[id]` Route_Handlers.
2. THE App SHALL support expense categories: `supplier`, `employee`, `contractor`, `utilities`, `rent`, `other`.
3. THE App SHALL support payment methods: `cash`, `check`, `bank_transfer`, `card`, `other`.
4. IF a `DELETE /api/expenses/[id]` request is made by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.

---

### Requirement 17: Contractor Management

**User Story:** As a store owner, I want to maintain a contractor phonebook, so that employees can look up contractors and I can manage the list.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/contractors`, `POST /api/contractors`, `PUT /api/contractors/[id]`, and `DELETE /api/contractors/[id]` Route_Handlers.
2. THE App SHALL allow all authenticated users to read contractor records.
3. IF a `POST /api/contractors`, `PUT /api/contractors/[id]`, or `DELETE /api/contractors/[id]` request is made by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.

---

### Requirement 18: Employee Account Management

**User Story:** As a store owner, I want to create and manage employee accounts, so that staff can log in with appropriate access.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/users`, `POST /api/users/create-employee`, `DELETE /api/users/[id]`, and `PUT /api/users/[id]/commission-rate` Route_Handlers.
2. WHEN `POST /api/users/create-employee` is called, THE App SHALL create a user with `role = "employee"` regardless of any role field in the request body.
3. IF `POST /api/users/create-employee`, `DELETE /api/users/[id]`, or `PUT /api/users/[id]/commission-rate` is called by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.
4. IF a `DELETE /api/users/[id]` request targets a user with `role = "owner"`, THEN THE App SHALL return HTTP 403 with the message `"Cannot delete the owner account."`.
5. WHEN `PUT /api/users/[id]/commission-rate` is called with a `commission_rate` outside the range 0–100, THE App SHALL return HTTP 400.

---

### Requirement 19: Commission Tracking

**User Story:** As a store owner, I want commissions to be automatically calculated when invoices are paid, so that I can track and pay employee earnings accurately.

#### Acceptance Criteria

1. WHEN an invoice status transitions to `"paid"`, THE App SHALL calculate the commission for the employee who created the invoice using the formula: `commission_amount = max(0, profit) * commission_rate / 100`, where `profit = sum over items of (unit_price - cost_price) * boxes_needed`.
2. THE App SHALL upsert the commission record using `(invoice_id, employee_id)` as the unique key.
3. THE App SHALL provide `GET /api/commissions`, `POST /api/commissions/[id]/mark-paid`, and `POST /api/commissions/[id]/mark-unpaid` Route_Handlers.
4. IF any commission Route_Handler is called by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.

---

### Requirement 20: Internal Messaging

**User Story:** As a store owner, I want to broadcast messages to all employees, so that I can communicate announcements without leaving the app.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/messages`, `POST /api/messages`, and `POST /api/messages/[id]/mark-read` Route_Handlers.
2. WHEN `GET /api/messages/unread-count` is called, THE App SHALL return the count of messages not yet read by the requesting user.
3. THE App SHALL support message priorities: `low`, `normal`, `high`, `urgent`.
4. IF `POST /api/messages` is called by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.

---

### Requirement 21: Reports

**User Story:** As a store owner, I want financial and transaction reports, so that I can review business performance over time.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/reports/financial` returning total revenue, total expenses, net income, and gross profit for a given date range.
2. THE App SHALL provide `GET /api/reports/transactions` returning a paginated list of all invoices and manual payments for a given date range.
3. IF either reports Route_Handler is called by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.

---

### Requirement 22: Analytics

**User Story:** As a store owner, I want analytics charts showing revenue trends and top products, so that I can make data-driven decisions.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/analytics` returning monthly revenue for the past 12 months, top 5 products by revenue, lead conversion rate, and expense breakdown by category.
2. IF `GET /api/analytics` is called by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.

---

### Requirement 23: Settings Management

**User Story:** As a store owner, I want to configure company information, tax rate, Facebook API credentials, and my store logo, so that the app reflects my business.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/settings` and `PUT /api/settings` Route_Handlers.
2. THE App SHALL provide `POST /api/settings/logo` for logo upload, accepting `multipart/form-data`.
3. IF `PUT /api/settings` or `POST /api/settings/logo` is called by a user with `role = "employee"`, THEN THE App SHALL return HTTP 403.
4. THE App SHALL allow all authenticated users to read settings via `GET /api/settings`.
5. THE App SHALL provide `POST /api/auth/change-password` allowing any authenticated user to change their own password by supplying the correct current password.
6. IF the current password supplied to `POST /api/auth/change-password` does not match the stored hash, THEN THE App SHALL return HTTP 401.

---

### Requirement 24: Address Autocomplete

**User Story:** As a user creating an invoice, I want address suggestions as I type, so that I can enter customer addresses quickly and accurately.

#### Acceptance Criteria

1. THE App SHALL provide `GET /api/address/suggestions?query=<string>` returning a list of address suggestion objects with a `full_address` field.
2. WHEN the query string is fewer than 2 characters, THE App SHALL return an empty array.
3. THE App SHALL provide `GET /api/address/states` returning the list of US state names and abbreviations.

---

### Requirement 25: Database Schema Migration at Startup

**User Story:** As a developer, I want the database schema to be created or updated automatically on app startup, so that I don't need to run manual migrations.

#### Acceptance Criteria

1. WHEN the App starts, THE App SHALL execute `CREATE TABLE IF NOT EXISTS` statements for all 13 existing tables using the existing column definitions.
2. WHEN the App starts, THE App SHALL execute `ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT ''` to add the logo column without breaking existing deployments.
3. THE App SHALL run schema initialization in a startup module imported by the Next.js instrumentation hook (`instrumentation.ts`).
