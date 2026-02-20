# FloorHub - Flooring Store Management System PRD

## Original Problem Statement
Create a web app for flooring store owners. This will include employee login and owner login. The ability to add in inventory along with cost price and selling price. An invoicing and estimating platform that will allow you to invoice accurately in square feet that will be converted into the number of boxes for that particular product (already preset in inventory - number of square feet per box). Include a lead generation system where incoming leads can be stored from facebook ads. Include an expensing and payment system to record expenses, supplier payments, employee payments, contractor payments. Include a phonebook visible to employees and editable by the owner that displays contractor details. Invoicing system should save customer details as well.

## User Choices
- JWT-based authentication (email/password)
- Manual lead entry with API functionality for Facebook leads (credentials stored in backend)
- PDF generation and email functionality for invoices
- Both manual recording and actual payment processing (Stripe)
- Modern, easy on the eyes design

## Architecture

### Tech Stack
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Framer Motion
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: JWT tokens
- **Payments**: Stripe (test mode enabled)
- **PDF Generation**: ReportLab
- **Email**: Resend API (ready for configuration)

### Design System
- **Theme**: Organic & Earthy - Stone/Clay palette
- **Typography**: Manrope (headings) + DM Sans (body)
- **Accent Color**: Terracotta/Clay (#ea580c)
- **Layout**: Bento Grid dashboard, responsive sidebar

## User Personas

### 1. Store Owner
- Full access to all features
- Can manage inventory, invoices, leads, expenses
- Can add/edit/delete contractors in phonebook
- Can manage company settings and Facebook API credentials
- Can delete products, leads, expenses, contractors

### 2. Employee
- View access to all data
- Can create/edit products, invoices, leads, expenses
- Can view contractor phonebook (read-only)
- Cannot delete most items
- Cannot modify company settings

## Core Requirements (Static)

1. **Authentication**
   - JWT-based login/registration
   - First registered user becomes owner
   - Role-based access control (owner/employee)

2. **Inventory Management**
   - Products with SKU, category, cost/selling price
   - Sq Ft per Box specification for invoicing calculations
   - Stock tracking in boxes

3. **Invoicing & Estimating**
   - Convert square feet to boxes (ceiling calculation)
   - PDF generation with company branding
   - Email invoices to customers
   - Convert estimates to invoices
   - Stripe payment integration

4. **Lead Management**
   - Manual lead entry
   - Facebook webhook endpoint ready
   - Status tracking (new → contacted → qualified → proposal → won/lost)

5. **Expense Tracking**
   - Categorized expenses (supplier, employee, contractor, utilities, etc.)
   - Date picker with calendar component
   - Payment method tracking

6. **Contractor Phonebook**
   - Visible to all employees
   - Editable only by owner
   - Rating system
   - Specialty categorization

7. **Company Settings**
   - Company information for invoices
   - Default tax rate
   - Facebook API credentials storage

## What's Been Implemented (Jan 2026)

### Backend APIs
- [x] User authentication (register, login, me)
- [x] Products CRUD
- [x] Customers CRUD
- [x] Invoices/Estimates CRUD
- [x] Invoice PDF generation
- [x] Invoice email sending (Resend)
- [x] Leads CRUD
- [x] Expenses CRUD
- [x] Contractors CRUD
- [x] Settings CRUD
- [x] Dashboard stats
- [x] Stripe checkout integration
- [x] Payment status polling
- [x] Facebook webhook endpoint (ready)
- [x] Manual payment recording
- [x] Messages system (owner broadcasts)
- [x] Employee account creation
- [x] Password change
- [x] Financial reports API
- [x] Transaction reports API
- [x] Analytics API
- [x] Address suggestions

### Frontend Pages
- [x] Login/Register page
- [x] Dashboard with bento grid stats
- [x] Inventory management
- [x] Invoices & Estimates (with sq ft to boxes conversion)
- [x] Invoice detail with PDF download + Manual Payments
- [x] Customer database
- [x] Lead management
- [x] Expense tracking
- [x] Contractor phonebook
- [x] Settings page with password change
- [x] Reports page (Financial + Transactions)
- [x] Analytics page with charts
- [x] Messages system
- [x] Employee management (owner only)

### Features
- [x] Role-based access control
- [x] Responsive design (mobile + desktop)
- [x] Modern UI with Manrope/DM Sans fonts
- [x] Terracotta accent color theme
- [x] Toast notifications
- [x] Search and filter capabilities
- [x] Calendar date picker (Shadcn)
- [x] Charts and graphs (Recharts)
- [x] Address autocomplete
- [x] Email notifications (Resend API configured)

## Prioritized Backlog

### P0 (Critical) - DONE
- All core features implemented

### P1 (High Priority) - Future
- Email service configuration (RESEND_API_KEY needed from user)
- Production Stripe keys
- Facebook Lead Ads full integration

### P2 (Medium Priority) - Future
- Dashboard charts/graphs
- Invoice templates customization
- Bulk import/export for products
- Customer communication history
- Employee management panel

### P3 (Nice to Have) - Future
- Mobile app version
- Offline support
- Multi-location support
- Inventory alerts
- Reporting dashboard

## Test Credentials
- **Owner Account**: owner@floorhub.com / test123456
- **Stripe**: Test mode enabled with sk_test_emergent
- **Resend Email**: API key configured (re_4r5N4ZKq_...)

## Next Tasks
1. ~~Configure RESEND_API_KEY for email functionality~~ ✓ Done
2. Set up Facebook Lead Ads webhook with API credentials
3. Add more chart visualizations to Analytics
4. Consider adding inventory stock alerts
