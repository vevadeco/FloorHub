# Tasks

## Task List

- [x] 1. Database schema — add `delivery_orders` table migration to `lib/schema.ts`
- [x] 2. TypeScript types — add `DeliveryOrder`, `DeliveryOrderWithItems`, `DeliveryOrderListItem` to `types/index.ts`
- [x] 3. PDF generator — create `lib/delivery-pdf.ts` with `generateDeliveryPDF` (no pricing columns)
- [x] 4. API: GET `/api/delivery-orders/route.ts` — list invoices with `job_type='delivery'` joined with delivery_orders
- [x] 5. API: PUT `/api/delivery-orders/[id]/route.ts` — upsert delivery_orders row, auto-generate DO-XXXX on first insert
- [x] 6. API: GET `/api/delivery-orders/[id]/pdf/route.ts` — generate and stream Delivery_PDF
- [x] 7. API: POST `/api/delivery-orders/[id]/send-email/route.ts` — generate PDF and send via Resend
- [x] 8. Dashboard page — create `app/(dashboard)/delivery-orders/page.tsx` with list, status filter, search, and edit dialog
- [x] 9. Sidebar — add "Delivery Orders" nav entry with Truck icon to `components/layout/Sidebar.tsx`
- [ ] 10. Property tests — write fast-check tests for Properties 1–7 from design.md
