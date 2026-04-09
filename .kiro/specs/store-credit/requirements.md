# Requirements Document

## Introduction

The Store Credit feature extends FloorHub's returns and invoicing workflows. When processing a return, the store owner can choose to issue the refund as store credit instead of refunding via the original payment method. Store credit is tracked per customer and automatically applied to future invoices. Additionally, the restocking charge percentage becomes configurable in Settings (rather than hardcoded at 20%), and the store owner can waive the restocking charge on a per-return basis.

## Glossary

- **System**: The FloorHub Next.js application.
- **Store_Credit**: A monetary balance held on behalf of a customer, issued from a return refund, that can be applied toward future invoice payments.
- **Store_Credit_Ledger**: A record of all store credit transactions (issuances and redemptions) for a customer, providing a full audit trail.
- **Refund_Method**: The method by which a return refund is issued — either `original_payment` (cash/card refund) or `store_credit`.
- **Restocking_Charge_Percentage**: A configurable percentage (stored in the `settings` table) that is deducted from the return refund amount as a restocking fee.
- **Restocking_Waiver**: A per-return flag indicating that the restocking charge is waived entirely for that return.
- **Returns_Page**: The dashboard page at `/returns` for creating and managing product returns.
- **Settings_Page**: The dashboard page at `/settings` for managing company and account configuration.
- **Invoice**: An existing FloorHub record in the `invoices` table representing a customer order.
- **Customer**: A record in the `customers` table representing a buyer.

---

## Requirements

### Requirement 1: Configurable Restocking Charge Percentage

**User Story:** As a store owner, I want to configure the restocking charge percentage in Settings, so that I can adjust the fee to match my store's return policy.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a "Restocking Charge (%)" input field in the Company Information section.
2. THE System SHALL store the Restocking_Charge_Percentage value in the `settings` table.
3. THE System SHALL default the Restocking_Charge_Percentage to 20 when no value has been configured.
4. WHEN a user enters a Restocking_Charge_Percentage value, THE System SHALL accept values between 0 and 100 inclusive.
5. WHEN a return is created, THE System SHALL calculate the restocking fee using the current Restocking_Charge_Percentage from the `settings` table instead of a hardcoded value.

---

### Requirement 2: Restocking Charge Waiver on Returns

**User Story:** As a store owner, I want to waive the restocking charge on a per-return basis, so that I can accommodate special circumstances without changing the global setting.

#### Acceptance Criteria

1. THE Returns_Page SHALL display a "Waive Restocking Fee" checkbox in the new return dialog.
2. WHEN the "Waive Restocking Fee" checkbox is checked, THE System SHALL set the restocking fee to zero for that return.
3. WHEN the "Waive Restocking Fee" checkbox is unchecked, THE System SHALL calculate the restocking fee using the configured Restocking_Charge_Percentage.
4. THE System SHALL store the Restocking_Waiver flag on the return record for audit purposes.
5. WHEN the waiver checkbox state changes, THE Returns_Page SHALL immediately recalculate and display the updated net refund amount.

---

### Requirement 3: Refund as Store Credit

**User Story:** As a store owner, I want to issue a return refund as store credit instead of a cash refund, so that the customer's refund value stays within my business.

#### Acceptance Criteria

1. THE Returns_Page SHALL display a "Refund Method" selector in the new return dialog with options: "Original Payment" and "Store Credit".
2. WHEN the user selects "Store Credit" as the Refund_Method, THE System SHALL create a Store_Credit_Ledger entry crediting the net refund amount to the customer's store credit balance.
3. WHEN the user selects "Original Payment" as the Refund_Method, THE System SHALL process the return without creating a store credit entry.
4. THE System SHALL store the selected Refund_Method on the return record.
5. THE System SHALL link the Store_Credit_Ledger entry to the return record and the customer record.
6. WHEN a return with Refund_Method "Store Credit" is created, THE System SHALL display a confirmation indicating the store credit amount issued.

---

### Requirement 4: Customer Store Credit Balance Tracking

**User Story:** As a store owner, I want to see each customer's current store credit balance, so that I can inform customers of their available credit and track outstanding liabilities.

#### Acceptance Criteria

1. THE System SHALL maintain a `store_credit_balance` field on each customer record representing the current available store credit.
2. WHEN a store credit is issued from a return, THE System SHALL increase the customer's `store_credit_balance` by the net refund amount.
3. WHEN store credit is redeemed against an invoice, THE System SHALL decrease the customer's `store_credit_balance` by the redeemed amount.
4. THE System SHALL ensure the `store_credit_balance` value is never negative.
5. THE System SHALL display the customer's current store credit balance on the customer detail view.

---

### Requirement 5: Automatic Store Credit Application on Invoices

**User Story:** As a store owner, I want store credit to be automatically applied when recording a payment for a customer's invoice, so that the customer receives their credit without manual calculations.

#### Acceptance Criteria

1. WHEN a manual payment is recorded for an invoice, THE System SHALL check the customer's available `store_credit_balance`.
2. WHILE a customer has a positive `store_credit_balance`, THE System SHALL display the available store credit amount on the invoice payment screen.
3. WHEN the user confirms applying store credit to an invoice, THE System SHALL deduct the lesser of the invoice outstanding balance and the customer's `store_credit_balance`.
4. WHEN store credit is applied, THE System SHALL create a Store_Credit_Ledger entry recording the redemption with a reference to the invoice.
5. WHEN store credit covers the full invoice amount, THE System SHALL mark the invoice as paid.
6. WHEN store credit covers only part of the invoice amount, THE System SHALL reduce the outstanding balance and leave the remaining amount due for collection via other payment methods.
7. IF the customer has zero store credit balance, THEN THE System SHALL proceed with the normal payment flow without displaying store credit options.

---

### Requirement 6: Store Credit Ledger and Audit Trail

**User Story:** As a store owner, I want a full history of all store credit transactions for each customer, so that I can audit credits issued and redeemed.

#### Acceptance Criteria

1. THE System SHALL maintain a `store_credit_ledger` table recording every store credit transaction.
2. THE Store_Credit_Ledger SHALL store for each entry: customer ID, transaction type (credit or debit), amount, reference type (return or invoice), reference ID, description, and timestamp.
3. WHEN a store credit is issued, THE System SHALL create a ledger entry with transaction type "credit".
4. WHEN a store credit is redeemed, THE System SHALL create a ledger entry with transaction type "debit".
5. THE System SHALL display the store credit transaction history on the customer detail view.
6. FOR ALL store credit transactions for a customer, the sum of credit entries minus the sum of debit entries SHALL equal the customer's current `store_credit_balance` (ledger consistency property).
