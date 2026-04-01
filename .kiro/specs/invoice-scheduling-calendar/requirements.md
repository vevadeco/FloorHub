# Requirements Document

## Introduction

This feature adds job scheduling to FloorHub invoices and a new Calendar view. When creating or editing an invoice, users can assign a job type (Installation, Delivery, or Pickup) and a corresponding scheduled date. A new Calendar page in the sidebar displays all scheduled jobs in a monthly calendar view, color-coded by job type, with each event linking to its invoice.

## Glossary

- **Invoice**: A FloorHub billing document stored in the `invoices` table
- **Job_Type**: The category of work associated with an invoice — one of `installation`, `delivery`, `pickup`, or `none`
- **Scheduled_Date**: The date on which the job is planned to occur, stored as a DATE on the invoice
- **Calendar**: The new `/calendar` page that displays all invoices with a scheduled date in a monthly grid
- **Calendar_Event**: A visual representation of a scheduled invoice on the Calendar, showing the customer name and job type
- **Scheduler**: The combined invoice form fields (job type selector + date picker) responsible for capturing scheduling data
- **Invoice_API**: The existing REST API at `/api/invoices` and `/api/invoices/[id]`
- **Calendar_API**: The new REST endpoint at `/api/calendar` that returns scheduled invoices for a given month

## Requirements

### Requirement 1: Job Type Selection on Invoice Creation

**User Story:** As a user, I want to select a job type when creating an invoice, so that I can categorize the work being performed.

#### Acceptance Criteria

1. WHEN the invoice creation dialog is open, THE Scheduler SHALL display a job type selector with options: None, Installation, Delivery, and Pickup.
2. THE Scheduler SHALL default the job type selector to "None" when the dialog is first opened.
3. WHEN the user selects a job type other than "None", THE Scheduler SHALL display a date input field labeled with the corresponding job type (e.g., "Installation Date", "Delivery Date", "Pickup Date").
4. WHEN the user selects "None" as the job type, THE Scheduler SHALL hide the date input field and clear any previously entered scheduled date.
5. WHEN the user submits the invoice creation form with a job type other than "None" but no scheduled date, THE Scheduler SHALL display a validation error and prevent form submission.
6. WHEN the user submits the invoice creation form with a job type of "None", THE Invoice_API SHALL store `job_type` as `null` and `scheduled_date` as `null`.

### Requirement 2: Job Type and Scheduled Date Persistence

**User Story:** As a user, I want the job type and scheduled date to be saved with the invoice, so that scheduling information is retained.

#### Acceptance Criteria

1. WHEN an invoice is created with a job type and scheduled date, THE Invoice_API SHALL persist `job_type` and `scheduled_date` to the `invoices` table.
2. THE Invoice_API SHALL accept `job_type` values of `"installation"`, `"delivery"`, `"pickup"`, or `null`.
3. THE Invoice_API SHALL accept `scheduled_date` as an ISO 8601 date string (YYYY-MM-DD) or `null`.
4. WHEN the `invoices` table does not have `job_type` or `scheduled_date` columns, THE Invoice_API SHALL apply lazy `ALTER TABLE` migrations to add them before processing the request.
5. THE Invoice_API GET response SHALL include `job_type` and `scheduled_date` fields for every invoice.

### Requirement 3: Job Type and Scheduled Date on Invoice Detail Page

**User Story:** As a user, I want to view and edit the job type and scheduled date on the invoice detail page, so that I can update scheduling information after creation.

#### Acceptance Criteria

1. WHEN an invoice has a non-null `job_type`, THE Invoice detail page SHALL display the job type and scheduled date in the invoice summary card.
2. WHEN the edit dialog is open on the invoice detail page, THE Scheduler SHALL display the current job type and scheduled date pre-populated.
3. WHEN the user changes the job type or scheduled date in the edit dialog and saves, THE Invoice_API SHALL update `job_type` and `scheduled_date` on the invoice record.
4. WHEN the user changes the job type to "None" in the edit dialog and saves, THE Invoice_API SHALL set `job_type` to `null` and `scheduled_date` to `null`.

### Requirement 4: Calendar Navigation Entry

**User Story:** As a user, I want a Calendar link in the sidebar, so that I can navigate to the scheduling calendar.

#### Acceptance Criteria

1. THE Sidebar SHALL include a "Calendar" navigation link with a calendar icon pointing to `/calendar`.
2. WHEN the current route is `/calendar`, THE Sidebar SHALL render the Calendar link in the active state.
3. THE Calendar link SHALL be visible to users with the `owner` role.
4. THE Calendar link SHALL be visible to users with the `employee` role.

### Requirement 5: Calendar Page — Month View

**User Story:** As a user, I want to see all scheduled jobs in a monthly calendar view, so that I can understand the workload for any given month.

#### Acceptance Criteria

1. THE Calendar page SHALL display a monthly grid with one cell per calendar day.
2. THE Calendar page SHALL display the current month by default when first loaded.
3. WHEN the user clicks the "Previous" navigation control, THE Calendar page SHALL display the preceding month.
4. WHEN the user clicks the "Next" navigation control, THE Calendar page SHALL display the following month.
5. THE Calendar page SHALL display the month name and year in a heading above the grid.
6. THE Calendar page SHALL label each column with the day-of-week abbreviation (Sun through Sat).

### Requirement 6: Calendar Events Display

**User Story:** As a user, I want to see scheduled invoices as color-coded events on the calendar, so that I can quickly identify job types at a glance.

#### Acceptance Criteria

1. WHEN an invoice has a `scheduled_date` within the displayed month, THE Calendar page SHALL render a Calendar_Event on the corresponding day cell.
2. THE Calendar_Event SHALL display the customer name and invoice number.
3. WHEN a Calendar_Event has `job_type` of `"installation"`, THE Calendar page SHALL render the event with a blue background color.
4. WHEN a Calendar_Event has `job_type` of `"delivery"`, THE Calendar page SHALL render the event with a green background color.
5. WHEN a Calendar_Event has `job_type` of `"pickup"`, THE Calendar page SHALL render the event with an amber/orange background color.
6. WHEN a day cell contains more than 3 Calendar_Events, THE Calendar page SHALL display the first 3 events and a "+N more" indicator for the remaining count.

### Requirement 7: Calendar Event Navigation

**User Story:** As a user, I want to click a calendar event to open the corresponding invoice, so that I can view or edit the invoice details.

#### Acceptance Criteria

1. WHEN the user clicks a Calendar_Event, THE Calendar page SHALL navigate to `/invoices/[id]` for the corresponding invoice.

### Requirement 8: Calendar Data API

**User Story:** As a developer, I want a dedicated API endpoint for calendar data, so that the Calendar page can efficiently fetch scheduled invoices for a given month.

#### Acceptance Criteria

1. THE Calendar_API SHALL expose a GET endpoint at `/api/calendar`.
2. WHEN the Calendar_API receives a request with `year` and `month` query parameters, THE Calendar_API SHALL return all invoices where `scheduled_date` falls within that calendar month.
3. THE Calendar_API response SHALL include `id`, `invoice_number`, `customer_name`, `job_type`, and `scheduled_date` for each invoice.
4. WHEN no `year` or `month` query parameters are provided, THE Calendar_API SHALL default to the current month.
5. IF the `year` or `month` query parameters are not valid integers, THEN THE Calendar_API SHALL return a 400 error with a descriptive message.
6. THE Calendar_API SHALL require authentication and return a 401 error for unauthenticated requests.

### Requirement 9: Calendar Legend

**User Story:** As a user, I want a color legend on the Calendar page, so that I know what each event color represents.

#### Acceptance Criteria

1. THE Calendar page SHALL display a legend showing the color associated with each job type: Installation (blue), Delivery (green), and Pickup (amber/orange).
2. THE Calendar page SHALL render the legend in a consistent location on the page, visible without scrolling on standard desktop viewports.
