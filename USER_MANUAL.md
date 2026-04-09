# FloorHub User Manual

FloorHub is a business management platform built for flooring companies. It handles invoicing, inventory, customers, employees, delivery orders, installation jobs, returns, commissions, and more — all from a single dashboard.

---

## Getting Started

### Logging In

Navigate to your FloorHub URL and enter your email and password. If your account has Two-Factor Authentication (2FA) enabled, you'll be prompted to enter a 6-digit code from your authenticator app after entering your credentials.

### Auto Logout

For security, FloorHub automatically logs you out after 30 minutes of inactivity. Any unsaved changes will be lost, so save your work regularly.

### Dark Mode

Click the theme toggle icon in the top header bar to switch between light and dark mode. Your preference is saved in the browser.

---

## Dashboard

The main dashboard shows key business metrics at a glance:

- Total revenue collected
- Pending invoices count
- Total expenses
- Net income
- Gross profit and profit margin
- Recent invoices and leads

All figures update in real time as you create invoices, record payments, and manage expenses.

---

## Invoices

### Creating an Invoice

1. Go to **Invoices** in the sidebar
2. Click **New Invoice** (or **New Estimate** for quotes)
3. Select or create a customer
4. Add line items by selecting products from your inventory
5. Adjust quantities (sq ft or boxes), and the system calculates totals automatically
6. Set the tax rate, discount, and any notes
7. Optionally set a **Job Type** (Installation, Delivery, or Pickup) and a scheduled date
8. Click **Create**

### Editing an Invoice

Invoices can be edited within 30 days of creation. Click the **Edit** button on the invoice detail page to modify customer info, line items, totals, job type, and scheduled date.

### Recording Payments

On the invoice detail page:
- Click **Record Payment** to log a manual payment (cash, check, bank transfer, card)
- If Stripe or Square is configured, click **Pay Online** to generate a checkout link
- If the customer has **store credit**, a blue banner appears showing the available balance — click **Apply Store Credit** to use it

### Downloading and Printing

- Click **PDF** to download the invoice as a PDF
- Click **Print** to open the PDF in a new tab for printing
- Click **Email** to send the invoice to the customer via email (requires Resend API key in Settings)

### Converting Estimates

Estimates can be converted to invoices by clicking the **Convert** button on the estimate detail page.

### Creating Returns

On a completed invoice (within 30 days), click **Create Return** to initiate a return. See the Returns section below.

---

## Customers

### Managing Customers

Go to **Customers** to view, search, create, edit, and delete customer records. Each customer has: name, email, phone, address, city, state, ZIP, and notes.

### Store Credit

If a customer has store credit (issued from a return), their balance appears in the customers table and in the edit dialog. The edit dialog also shows the full store credit ledger — every credit and debit transaction with dates and descriptions.

---

## Inventory (Products)

Go to **Inventory** to manage your product catalog. Each product has:
- Name, SKU, category
- Cost price and selling price
- Square feet per box
- Stock (boxes on hand)
- Supplier and description

Products are selected when creating invoice line items. The system uses sq ft per box to calculate boxes needed and total price.

---

## Leads

Go to **Leads** to track potential customers. Each lead has: name, contact info, source, status, project type, estimated sq ft, and assigned employee. Leads can be moved through statuses (new, contacted, qualified, proposal, won, lost).

---

## Delivery Orders

### How Delivery Orders Work

When an invoice has its **Job Type** set to "Delivery" (either during creation or by editing), it appears on the **Delivery Orders** page.

### Setting Up a Delivery Order

1. Go to **Delivery Orders**
2. Find the invoice and click **Set Up Order**
3. Set the delivery date, status, and any notes
4. Click **Save** — a DO number (e.g., DO-0001) is automatically assigned

### Managing Delivery Orders

- Change the status (Pending, Scheduled, In Transit, Delivered, Cancelled)
- Download a PDF of the delivery order (no pricing — just items and quantities)
- Send the delivery order via email to a delivery company

---

## Installation Jobs

Go to **Installation Jobs** to manage invoices marked with the "Installation" job type. Similar to delivery orders, you can track scheduling and status for installation work.

---

## Returns

### Creating a Return

1. Go to **Returns** and click **New Return**
2. Search for the invoice by number
3. Adjust the return quantity for each line item (defaults to full quantity)
4. The system calculates the restocking fee based on the configured percentage in Settings
5. Optionally check **Waive Restocking Fee** to remove the fee for this return
6. Choose a **Refund Method**: Original Payment or Store Credit
7. Enter a reason, optional reference number, and notes
8. Click **Submit Return**

### Restocking Fee

The restocking charge percentage is configured in **Settings** (defaults to 20%). It's deducted from the refund amount. The owner can waive it on a per-return basis using the checkbox.

### Store Credit Refunds

When "Store Credit" is selected as the refund method, the net refund amount is added to the customer's store credit balance. This credit is automatically available for use on future invoices. A confirmation dialog shows the credited amount.

### Return Statuses

Returns go through statuses: Pending, Approved, Rejected, Completed. The owner can change the status from the returns table.

---

## Commissions

Go to **Commissions** to view and manage employee commissions. Commissions are automatically calculated when an invoice is marked as paid, based on the employee's commission rate and the invoice profit margin.

The owner can mark commissions as paid or unpaid.

Employees see their own commissions under **My Commissions**.

---

## Calendar

Go to **Calendar** to see a monthly view of scheduled jobs (installations, deliveries, pickups) based on the scheduled dates set on invoices.

---

## Expenses

Go to **Expenses** to track business expenses. Each expense has: category, description, amount, payment method, reference number, vendor name, and date. Expenses are subtracted from revenue in the dashboard profit calculations.

---

## Contractors

Go to **Contractors** to manage your contractor database. Each contractor has: name, company, phone, email, specialty, address, notes, and rating.

---

## Employees

Go to **Employees** (owner only) to manage user accounts. You can:
- Create new employee accounts with email and password
- Set commission rates per employee
- View and manage all employee records

---

## Messages

Go to **Messages** to send and view internal messages. Messages have a title, content, and priority level (low, normal, high, urgent). All users can read messages; read status is tracked per user.

---

## Reports & Analytics

- **Reports**: View business reports and summaries
- **Analytics**: Visual charts and graphs of business performance

Both are available to the owner only.

---

## Settings

The Settings page (owner only) contains all global configuration:

### Company Information
- Company name, address, phone, email
- Logo upload
- Default tax rate
- Minimum floor price (margin protection)
- Restocking charge percentage (for returns, default 20%)

### Email (Resend)
- Resend API key and from email address for sending invoices and delivery orders via email

### Payment Gateway
- Choose between None, Stripe, or Square
- Configure API keys for online payment processing

### Address Autocomplete
- Amazon Location Service or Geoapify API keys for address suggestions

### Terms and Conditions
- Default terms text that appears on printed invoices

### Security
- Two-Factor Authentication (2FA) enrollment and management
- Owner can require 2FA for all employees
- Change password

---

## Two-Factor Authentication (2FA)

### Enrolling in 2FA

1. Go to **Settings**
2. Find the Security / 2FA section
3. Click **Enable 2FA**
4. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
5. Enter the 6-digit verification code to confirm enrollment

### Logging In with 2FA

After entering your email and password, you'll be prompted for a 6-digit code from your authenticator app.

### Disabling 2FA

Go to Settings and click **Disable 2FA**. You'll need to enter a verification code to confirm.

### Owner: Requiring 2FA for All Employees

The owner can toggle a setting to require all employees to set up 2FA. Employees will be prompted to enroll on their next login.

---

## User Roles

- **Owner**: Full access to all features including Settings, Employees, Expenses, Reports, Analytics, and Contractors
- **Employee**: Limited access to Invoices, Calendar, My Commissions, Leads, and Messages

---

## Keyboard Shortcuts and Tips

- Use the search bar on most pages to quickly filter records
- Invoice numbers are auto-generated in the format INV-YYYYMM-XXXX
- Delivery order numbers are auto-generated as DO-XXXX
- The app is fully responsive — works on desktop, tablet, and mobile
- The sidebar collapses to a hamburger menu on mobile devices
