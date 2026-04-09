# Changelog

## [1.5.0] - 2026-04-09

### Added
- Delivery Orders module with DO-XXXX numbering, pricing-free PDF generation, and email to delivery company
- Two-Factor Authentication (2FA) via TOTP authenticator app with enrollment, login flow, and disable flow
- Owner can enforce 2FA for all employees
- Dark mode toggle with ThemeProvider integration
- Auto logout after 30 minutes of inactivity
- Invoice edit dialog now includes Job Type and Scheduled Date fields
- Send email button on delivery order cards (enabled only after order is saved)
- Debug info panel on delivery orders page for troubleshooting

### Fixed
- Delivery orders now persist after navigating away and returning (cache-busting + server refresh)
- Delivery order DO number generation no longer causes duplicate key constraint errors
- PDF generation uses correct Buffer-to-ArrayBuffer conversion for both download and email attachment
- Invoice delete now cleans up related manual payments, payment transactions, and commissions
- Dashboard revenue only counts payments for invoices that still exist (no orphaned payment inflation)
- Job type saves correctly when editing an invoice (fixed SQL CASE WHEN with JS boolean issue)
- Delivery order edit dialog properly sized to contain all fields without overflow
- Dark mode CSS variable overrides applied correctly
- Login page wrapped in Suspense boundary for useSearchParams
- Defensive fallback for totp_enabled column in auth routes

### Changed
- Send email button moved from delivery order dialog to card action row
- Delivery order dialog widened with scrollable content area

## [1.4.0] - Previous Release

- Invoice print enhancements
- Invoice scheduling and calendar
- Employee commissions tracking
- User security and theme settings foundation
