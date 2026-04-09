# Implementation Plan: Store Credit

## Overview

Implement store credit capabilities for FloorHub by extending the settings, returns, invoicing, and customer subsystems. Work proceeds bottom-up: schema and types first, then API routes, then UI wiring. Each task builds on the previous one so there is no orphaned code.

## Tasks

- [x] 1. Database schema and TypeScript type updates
  - [x] 1.1 Add schema migrations in `lib/schema.ts`
    - Add `restocking_charge_percentage NUMERIC(5,2) NOT NULL DEFAULT 20.00` column to `settings` table
    - Add `store_credit_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00` column to `customers` table
    - Add `refund_method TEXT NOT NULL DEFAULT 'original_payment'` column to `returns` table
    - Add `waive_restocking BOOLEAN NOT NULL DEFAULT FALSE` column to `returns` table
    - Create `store_credit_ledger` table with id, customer_id, transaction_type, amount, reference_type, reference_id, description, created_at columns and index on customer_id
    - _Requirements: 1.2, 2.4, 3.4, 4.1, 6.1, 6.2_

  - [x] 1.2 Add TypeScript types to `types/index.ts`
    - Add `RefundMethod`, `StoreCreditTransactionType`, `StoreCreditReferenceType` type aliases
    - Add `StoreCreditLedgerEntry` interface
    - Add `restocking_charge_percentage` to `Settings` interface
    - Add `store_credit_balance` to `Customer` interface
    - _Requirements: 1.2, 3.4, 4.1, 6.2_

- [x] 2. Implement restocking charge configuration and return enhancements
  - [x] 2.1 Modify `GET /api/settings` and `PUT /api/settings` routes to include `restocking_charge_percentage`
    - Ensure the field is returned in GET and accepted/persisted in PUT
    - Validate the value is between 0 and 100 inclusive
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 2.2 Create a pure utility function for restocking fee calculation in `lib/store-credit.ts`
    - Function takes refund amount, restocking percentage, and waive flag
    - Returns restocking fee and net refund, rounded to 2 decimal places
    - When waive is true, restocking fee is 0
    - _Requirements: 1.5, 2.2, 2.3_

  - [ ]* 2.3 Write property test for restocking fee calculation
    - **Property 3: Restocking fee calculation with waiver**
    - **Validates: Requirements 1.5, 2.2, 2.3, 2.5**

  - [x] 2.4 Modify `POST /api/returns` to use configurable restocking percentage and support waiver and refund method
    - Read `restocking_charge_percentage` from settings table instead of hardcoded 0.20
    - Accept `waive_restocking` boolean and `refund_method` field from request body
    - Use the utility function from 2.2 for fee calculation
    - Store `refund_method` and `waive_restocking` on the return record
    - When `refund_method` is "store_credit": create a `store_credit_ledger` entry (type "credit") and increase the customer's `store_credit_balance`
    - When `refund_method` is "original_payment": do not create any ledger entry
    - Use a database transaction for balance updates
    - _Requirements: 1.5, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 3.5, 4.2, 6.3_

  - [ ]* 2.5 Write property tests for return creation logic
    - **Property 4: Return record field persistence**
    - **Validates: Requirements 2.4, 3.4**
    - **Property 5: Store credit issuance creates correct ledger entry**
    - **Validates: Requirements 3.2, 3.5, 6.2, 6.3**
    - **Property 6: Original payment creates no ledger entry**
    - **Validates: Requirements 3.3**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement store credit application on invoices
  - [x] 4.1 Create `GET /api/customers/[id]/store-credit` route
    - Return the customer's `store_credit_balance` and their `store_credit_ledger` entries ordered by created_at descending
    - _Requirements: 4.5, 6.5_

  - [x] 4.2 Create `POST /api/invoices/[id]/apply-store-credit` route
    - Accept `{ amount }` in request body
    - Look up the invoice and its customer
    - Validate: amount > 0, amount ≤ customer's store_credit_balance, amount ≤ invoice outstanding balance
    - Use `SELECT ... FOR UPDATE` on the customer row within a transaction to prevent race conditions
    - Create a debit `store_credit_ledger` entry referencing the invoice
    - Decrease the customer's `store_credit_balance`
    - Record a manual payment entry for the applied amount (payment_method: "store_credit")
    - If total payments now cover the invoice total, mark invoice as paid and trigger commission calculation
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6, 6.4_

  - [ ]* 4.3 Write property tests for store credit application
    - **Property 8: Store credit application deducts correct amount**
    - **Validates: Requirements 5.3**
    - **Property 9: Store credit redemption creates correct ledger entry**
    - **Validates: Requirements 5.4, 6.4**
    - **Property 10: Invoice status after store credit application**
    - **Validates: Requirements 5.5, 5.6**

  - [ ]* 4.4 Write property tests for balance invariants
    - **Property 7: Balance non-negativity invariant**
    - **Validates: Requirements 4.4**
    - **Property 11: Ledger consistency invariant**
    - **Validates: Requirements 4.2, 4.3, 6.6**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update Settings Page UI
  - [x] 6.1 Add "Restocking Charge (%)" input to the Company Information card in `app/(dashboard)/settings/page.tsx`
    - Number input with min=0, max=100, step=0.01
    - Wire to settings state and save flow
    - _Requirements: 1.1, 1.4_

  - [ ]* 6.2 Write property test for settings round-trip
    - **Property 1: Settings restocking percentage round-trip**
    - **Validates: Requirements 1.2**
    - **Property 2: Restocking percentage validation**
    - **Validates: Requirements 1.4**

- [x] 7. Update Returns Page UI
  - [x] 7.1 Modify the new return dialog in `app/(dashboard)/returns/page.tsx`
    - Fetch `restocking_charge_percentage` from settings and use it instead of the hardcoded `RESTOCKING_RATE` constant
    - Add a "Waive Restocking Fee" checkbox that sets restocking fee to 0 when checked and recalculates totals live
    - Add a "Refund Method" select with "Original Payment" and "Store Credit" options
    - Send `waive_restocking` and `refund_method` fields in the POST request body
    - Show confirmation of store credit amount issued after successful submission when refund method is "store_credit"
    - _Requirements: 1.5, 2.1, 2.5, 3.1, 3.6_

- [x] 8. Update Invoice Detail Page UI
  - [x] 8.1 Add store credit display and application to the invoice detail page `app/(dashboard)/invoices/[id]/page.tsx`
    - When viewing an invoice, fetch the customer's `store_credit_balance` via `GET /api/customers/[id]/store-credit`
    - If balance > 0 and invoice is not fully paid, show an info banner with available store credit
    - Add an "Apply Store Credit" button that calls `POST /api/invoices/[id]/apply-store-credit` with the appropriate amount (min of balance, outstanding)
    - After applying, refresh the payments list and invoice status
    - If customer has zero balance, do not show store credit UI
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7_

- [x] 9. Update Customers Page UI
  - [x] 9.1 Display store credit balance on the customers list and detail view in `app/(dashboard)/customers/page.tsx`
    - Add a "Store Credit" column to the customers table that shows the balance when > 0
    - In the customer edit/detail dialog, add a section showing the store credit ledger history fetched from `GET /api/customers/[id]/store-credit`
    - _Requirements: 4.5, 6.5_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The implementation uses TypeScript throughout, following existing FloorHub patterns
