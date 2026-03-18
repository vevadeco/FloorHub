# Requirements Document

## Introduction

This feature adds employee commission management to FloorHub, a flooring store management system. It covers two areas:

1. **Deployment readiness**: Prepare the frontend for Vercel deployment (craco-based React SPA) and clean up unused dependencies from both `frontend/package.json` and `backend/requirements.txt`.

2. **Employee commission management**: Allow the store owner to assign a commission rate per employee, automatically calculate commissions from invoice profit (selling price minus cost price per item), view all commissions with paid/unpaid status on a dedicated admin page, mark commissions as paid (which records them as an expense under employee salary), and include commission totals in the accounting/expenses section.

## Glossary

- **Commission_Calculator**: The backend service responsible for computing commission amounts from invoice data.
- **Commission_Record**: A stored document representing a calculated commission for one employee on one invoice, including paid/unpaid status.
- **Commission_Page**: The frontend admin page displaying all commission records per employee.
- **Expense_Recorder**: The backend service that creates expense entries when a commission is marked as paid.
- **Invoice_Item**: A line item on an invoice containing `product_id`, `unit_price`, `boxes_needed`, and `total_price`.
- **Product**: An inventory item with `cost_price` and `selling_price` fields.
- **Profit**: The difference between the selling price and cost price of a product, multiplied by the number of boxes sold on an invoice item.
- **Commission_Rate**: A percentage value (0–100) stored per employee user, representing the share of profit earned as commission.
- **Owner**: A user with role `owner` who has full administrative access.
- **Employee**: A user with role `employee` who can view their own commissions but cannot manage rates or mark payments.
- **Vercel_Config**: The `vercel.json` file at the repository root that configures the frontend SPA build and routing for Vercel deployment.

---

## Requirements

### Requirement 1: Vercel Deployment Configuration

**User Story:** As a store owner, I want the frontend deployed on Vercel, so that the app is publicly accessible without managing my own hosting.

#### Acceptance Criteria

1. THE Vercel_Config SHALL define a build command of `cd frontend && yarn install && yarn build` and an output directory of `frontend/build`.
2. THE Vercel_Config SHALL include a rewrite rule that maps all non-file paths to `/index.html` so that React Router client-side routing works correctly after deployment.
3. WHERE the backend is deployed separately, THE Vercel_Config SHALL NOT include any backend serverless function configuration.

---

### Requirement 2: Frontend Dependency Cleanup

**User Story:** As a developer, I want unused packages removed from `frontend/package.json`, so that the build is leaner and Vercel deployment is faster.

#### Acceptance Criteria

1. THE Frontend SHALL remove `jspdf` from `dependencies` because PDF generation is handled server-side via ReportLab.
2. THE Frontend SHALL remove `cra-template` from `dependencies` because it is a project scaffolding tool not needed at runtime.
3. THE Frontend SHALL remove `next-themes` from `dependencies` because the app uses a fixed theme and does not implement a theme switcher.
4. WHEN the cleanup is applied, THE Frontend SHALL retain all packages that are imported in any file under `frontend/src/`.

---

### Requirement 3: Backend Dependency Cleanup

**User Story:** As a developer, I want unused packages removed from `backend/requirements.txt`, so that the deployment image is smaller and install time is reduced.

#### Acceptance Criteria

1. THE Backend SHALL remove packages that are not imported anywhere in `backend/server.py` and are not transitive runtime dependencies of packages that are imported.
2. THE Backend SHALL retain `fastapi`, `motor`, `pymongo`, `pydantic`, `bcrypt`, `PyJWT`, `python-dotenv`, `uvicorn`, `starlette`, `reportlab`, `resend`, `stripe`, `emergentintegrations`, `python-multipart`, `email-validator`, `httpx`, and `anyio` as they are directly used.
3. THE Backend SHALL remove development/linting tools (`black`, `flake8`, `isort`, `mypy`, `pytest`, `pycodestyle`, `pyflakes`, `mccabe`) from `requirements.txt` as they are not needed at runtime.
4. THE Backend SHALL remove AI/ML packages (`google-genai`, `google-generativeai`, `google-ai-generativelanguage`, `openai`, `litellm`, `huggingface_hub`, `tokenizers`, `tiktoken`, `numpy`, `pandas`, `pillow`) that are not imported in `server.py`.
5. THE Backend SHALL remove cloud/storage packages (`boto3`, `botocore`, `s3transfer`, `s5cmd`) that are not imported in `server.py`.

---

### Requirement 4: Commission Rate per Employee

**User Story:** As a store owner, I want to set a commission rate for each employee, so that the system can automatically calculate how much each employee earns per sale.

#### Acceptance Criteria

1. THE Owner SHALL be able to set a `commission_rate` (a decimal percentage, e.g. `5.0` for 5%) on any employee user via a `PUT /api/users/{user_id}/commission-rate` endpoint.
2. WHEN a commission rate is set, THE System SHALL store the value on the user document in MongoDB.
3. THE System SHALL enforce that the commission rate is a number between `0.0` and `100.0` inclusive; IF a value outside this range is submitted, THEN THE System SHALL return HTTP 422.
4. THE Owner SHALL be able to view the commission rate for all employees on the Employees page alongside their name and email.
5. WHEN no commission rate has been set for an employee, THE System SHALL treat the rate as `0.0`.

---

### Requirement 5: Commission Calculation

**User Story:** As a store owner, I want commissions calculated automatically from invoice profit, so that I don't have to compute them manually.

#### Acceptance Criteria

1. WHEN an invoice with status `paid` is associated with an employee (via `created_by`), THE Commission_Calculator SHALL compute the profit for that invoice as the sum of `(unit_price - cost_price) * boxes_needed` for each Invoice_Item, where `cost_price` is looked up from the Product by `product_id`.
2. THE Commission_Calculator SHALL compute the commission amount as `profit * (commission_rate / 100)` for the employee who created the invoice.
3. WHEN a Commission_Record does not yet exist for a given invoice and employee pair, THE Commission_Calculator SHALL create one with status `unpaid`.
4. WHEN a product's `cost_price` cannot be found for an Invoice_Item, THE Commission_Calculator SHALL use `0.0` as the cost price for that item.
5. THE Commission_Calculator SHALL recalculate and update the Commission_Record whenever an invoice transitions to `paid` status.
6. FOR ALL invoices where profit is zero or negative, THE Commission_Calculator SHALL set the commission amount to `0.0` (commissions are never negative).

---

### Requirement 6: Commission Records API

**User Story:** As a store owner, I want a dedicated API to list and manage commission records, so that I can review and pay out commissions.

#### Acceptance Criteria

1. THE System SHALL expose `GET /api/commissions` (owner only) returning all Commission_Records with employee name, invoice number, invoice date, profit, commission amount, and paid status.
2. THE System SHALL expose `GET /api/commissions/employee/{employee_id}` returning Commission_Records for a specific employee (accessible by owner or the employee themselves).
3. THE System SHALL expose `POST /api/commissions/{commission_id}/mark-paid` (owner only) that sets the Commission_Record status to `paid` and records the date paid.
4. WHEN `mark-paid` is called, THE Expense_Recorder SHALL create an Expense entry with category `employee`, description `Commission payment - {employee_name} - {invoice_number}`, and amount equal to the commission amount.
5. THE System SHALL expose `POST /api/commissions/{commission_id}/mark-unpaid` (owner only) that reverts the Commission_Record status to `unpaid`.
6. IF a Commission_Record with the given ID does not exist, THEN THE System SHALL return HTTP 404.

---

### Requirement 7: Commission Admin Page (Frontend)

**User Story:** As a store owner, I want a dedicated commissions page in the admin UI, so that I can see all commissions at a glance and mark them as paid.

#### Acceptance Criteria

1. THE Commission_Page SHALL be accessible at `/commissions` and visible only to users with the `owner` role.
2. THE Commission_Page SHALL display a table with columns: Employee Name, Invoice Number, Invoice Date, Profit, Commission Rate, Commission Amount, Status (paid/unpaid), and an action button.
3. WHEN the status is `unpaid`, THE Commission_Page SHALL show a "Mark Paid" button; WHEN the status is `paid`, THE Commission_Page SHALL show a "Mark Unpaid" button.
4. THE Commission_Page SHALL display a summary card showing total unpaid commissions and total paid commissions.
5. THE Commission_Page SHALL allow filtering by employee and by paid/unpaid status.
6. WHEN the owner clicks "Mark Paid", THE Commission_Page SHALL call the mark-paid API, show a success toast, and refresh the list.

---

### Requirement 8: Commission Rate UI on Employees Page

**User Story:** As a store owner, I want to set commission rates directly from the Employees page, so that I don't need to navigate away to configure rates.

#### Acceptance Criteria

1. THE Employees page SHALL display a "Commission Rate" column showing the current rate (as a percentage) for each employee.
2. THE Owner SHALL be able to click an edit icon next to the commission rate to open an inline input or dialog for updating the rate.
3. WHEN the rate is saved, THE Employees page SHALL call `PUT /api/users/{user_id}/commission-rate` and show a success toast.
4. IF the entered rate is not a number between 0 and 100, THEN THE Employees page SHALL display a validation error and SHALL NOT submit the request.

---

### Requirement 9: Commissions in Expenses Section

**User Story:** As a store owner, I want paid commissions to appear in the Expenses section, so that my accounting reflects the true cost of employee salaries.

#### Acceptance Criteria

1. WHEN a commission is marked as paid via the API, THE Expense_Recorder SHALL automatically create an Expense record with category `employee`.
2. THE created Expense record SHALL include the employee name as `vendor_name`, the commission amount as `amount`, and today's date as `date`.
3. THE Expenses page SHALL display commission-related expenses with the category label "Employee Payment" (which already maps to the `employee` category).
4. THE financial reports endpoint (`GET /api/reports/financial`) SHALL include commission expenses in the `expense_by_category.employee` total without any additional changes, since they are stored as standard Expense records.
