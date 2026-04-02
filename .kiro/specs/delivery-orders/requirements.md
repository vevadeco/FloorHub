# Requirements Document

## Introduction

The Delivery Orders feature adds a dedicated section to the FloorHub dashboard for managing delivery orders. A delivery order is automatically derived from any invoice whose `job_type` is set to `"delivery"`. Each delivery order gets a unique delivery order ID (separate from the invoice number) and can generate a PDF document that shows only item quantities and boxes — no pricing — suitable for sending directly to a delivery company via email.

## Glossary

- **Delivery_Order**: A record derived from an invoice with `job_type = 'delivery'`, containing a unique delivery order ID, delivery address, line items (product name + qty/boxes), and optional notes.
- **Delivery_Order_ID**: A unique identifier for a delivery order, distinct from the invoice number (e.g., `DO-0001`).
- **Delivery_PDF**: A PDF document generated from a delivery order that contains no pricing information — only the delivery order ID, customer delivery address, item list (product name + boxes), and notes.
- **Invoice**: An existing FloorHub record in the `invoices` table with associated `invoice_items`.
- **Invoice_Item**: A row in `invoice_items` containing `product_name`, `boxes_needed`, `sqft_needed`, and `sqft_per_box`.
- **System**: The FloorHub Next.js application.
- **Delivery_Orders_Page**: The dashboard page at `/delivery-orders` listing all delivery orders.
- **Resend**: The third-party email service used by FloorHub, configured via `resend_api_key` and `resend_from_email` in settings.

---

## Requirements

### Requirement 1: Delivery Orders Dashboard Section

**User Story:** As a store manager, I want a "Delivery Orders" section in the sidebar navigation, so that I can quickly access and manage all delivery orders in one place.

#### Acceptance Criteria

1. THE System SHALL display a "Delivery Orders" link in the dashboard sidebar navigation.
2. WHEN a user clicks the "Delivery Orders" sidebar link, THE System SHALL navigate to the `/delivery-orders` page.
3. THE Delivery_Orders_Page SHALL display all invoices where `job_type = 'delivery'` as delivery order cards.
4. WHEN no delivery orders exist, THE Delivery_Orders_Page SHALL display an empty state message indicating that no delivery orders have been found.

---

### Requirement 2: Delivery Order Record Creation

**User Story:** As a store manager, I want each delivery-type invoice to automatically have a corresponding delivery order record with a unique ID, so that I can track and reference deliveries independently from invoices.

#### Acceptance Criteria

1. WHEN a delivery order record is first accessed for an invoice with `job_type = 'delivery'`, THE System SHALL create a `delivery_orders` table record with a unique `Delivery_Order_ID` if one does not already exist.
2. THE System SHALL assign `Delivery_Order_ID` values in the format `DO-XXXX` where `XXXX` is a zero-padded sequential number (e.g., `DO-0001`, `DO-0002`).
3. THE System SHALL store the `Delivery_Order_ID` as a separate field from the invoice number.
4. WHEN an invoice's `job_type` is changed away from `"delivery"`, THE System SHALL retain the existing delivery order record without deletion.

---

### Requirement 3: Delivery Order Details and Notes

**User Story:** As a store manager, I want to view and edit delivery order details including the delivery address and notes, so that I can provide accurate information to the delivery company.

#### Acceptance Criteria

1. THE Delivery_Orders_Page SHALL display for each delivery order: the `Delivery_Order_ID`, customer name, customer delivery address, delivery status, and scheduled delivery date (if set).
2. WHEN a user opens a delivery order, THE System SHALL allow editing of: delivery date, delivery status, and delivery notes.
3. THE System SHALL support the following delivery statuses: `pending`, `scheduled`, `in_transit`, `delivered`, `cancelled`.
4. IF a user saves a delivery order without a delivery date, THEN THE System SHALL save the record with an empty delivery date without returning an error.

---

### Requirement 4: Delivery Order PDF Generation

**User Story:** As a store manager, I want to generate a PDF for a delivery order that shows only item quantities and boxes with no pricing, so that I can share it with the delivery company without exposing customer pricing.

#### Acceptance Criteria

1. WHEN a user requests a PDF for a delivery order, THE System SHALL generate a `Delivery_PDF` using `@react-pdf/renderer`.
2. THE Delivery_PDF SHALL include: the `Delivery_Order_ID`, company name and logo, customer name, customer delivery address, a table of items with `product_name` and `boxes_needed` columns, and any delivery notes.
3. THE Delivery_PDF SHALL NOT include any pricing information — no unit price, no subtotal, no tax, no total, and no discount fields.
4. THE Delivery_PDF SHALL display the `sqft_needed` value alongside `boxes_needed` for each line item.
5. WHEN the PDF is generated successfully, THE System SHALL return it as a downloadable PDF file with the filename `{Delivery_Order_ID}.pdf`.
6. IF a delivery order is not found, THEN THE System SHALL return a 404 error response.

---

### Requirement 5: Email Delivery Order to Delivery Company

**User Story:** As a store manager, I want to send the delivery order PDF directly to a delivery company via email, so that they have all the information needed to complete the delivery without seeing pricing.

#### Acceptance Criteria

1. WHEN a user triggers "Send to Delivery Company" for a delivery order, THE System SHALL send an email with the `Delivery_PDF` attached using the Resend API.
2. THE System SHALL use the `resend_api_key` and `resend_from_email` values from the settings table when sending the email.
3. WHEN the email is sent successfully, THE System SHALL display a success notification to the user.
4. IF the `resend_api_key` is not configured in settings, THEN THE System SHALL display an error message instructing the user to configure it in Settings.
5. IF the recipient email address is empty, THEN THE System SHALL display a validation error before attempting to send.
6. THE System SHALL allow the user to enter or override the recipient email address for the delivery company before sending.
7. IF the Resend API returns an error, THEN THE System SHALL display the error message to the user without crashing.

---

### Requirement 6: Delivery Order List Display

**User Story:** As a store manager, I want to see all delivery orders in a clear list with their status and key details, so that I can monitor the state of all pending and completed deliveries.

#### Acceptance Criteria

1. THE Delivery_Orders_Page SHALL display delivery orders sorted by creation date descending (newest first).
2. THE Delivery_Orders_Page SHALL display a status badge for each delivery order using distinct colors per status.
3. THE Delivery_Orders_Page SHALL display the invoice number alongside the `Delivery_Order_ID` for cross-reference.
4. WHEN a user searches or filters by status on the Delivery_Orders_Page, THE System SHALL filter the displayed list accordingly.
