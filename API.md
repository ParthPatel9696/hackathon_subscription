# Brightloop API reference

All routes are mounted under `/api`. Requests use the existing HttpOnly session cookie. JSON write requests use `Content-Type: application/json`. Unless called out below, list responses are `{ success, data, total, page, pageSize }` and monetary API fields ending in `Minor` are integer paise; legacy/display amount fields are INR major units.

## Authentication and roles

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`
- `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/add-staff`
- Admin: customer administration, catalog writes, discounts, seed endpoint.
- Admin and staff: internal customer workspace, notes, tags (admin only), billing operations, health and revenue analytics.
- Customer: only own subscription, invoice, payment, search results and self-service profile.

The server enforces these permissions. Internal notes, revenue analytics and health data have no customer route.

## Customers and Customer 360

- `GET /customers` — admin/staff directory; `search`, `status`, `page`, `limit`, `sort`, `startDate`, `endDate`.
- `POST /customers` — admin create.
- `GET /customers/:id` and alias `GET /customers/:id/360` — admin/staff portfolio with financial summary, subscriptions, invoices, and posted payments.
- `PATCH /customers/:id`, `DELETE /customers/:id` — admin update/archive; archive rejects open billing obligations.
- `GET /customers/:id/activity` — admin/staff event timeline.
- `GET /customers/:id/notes`, `POST /customers/:id/notes`, `PATCH /customers/:id/notes/:noteId`, `DELETE /customers/:id/notes/:noteId` — internal notes; note writes are Zod validated.
- `PATCH /customers/:id/tags` — admin only; up to 20 labels, 40 characters each.

## Catalog, subscriptions and billing

- `GET /products` — active, billing-eligible catalog for non-admin users; admin sees the full catalog. `GET /products/:id` is internal-only. Admin writes with `POST /products`, `PATCH /products/:id`, and `PATCH /products/:id/status`.
- `GET /plans`, `GET /plans/:id` — customer reads include only visible, active, currently available plans tied to active, billing-eligible products; associated subscriptions are customer-scoped. Admin writes with `POST /plans`, `PATCH /plans/:id`, and `PATCH /plans/:id/status`.
- `GET /quotation-templates` — admin/staff list active templates (admins also see archived templates); `POST`, `PATCH /:id`, and `PATCH /:id/status` are admin-only. Templates save a plan, product/variant lines, quantities, and quote-validity days and can be applied with `templateId` when creating a subscription quotation.
- `GET /subscriptions`, `POST /subscriptions`, `GET /subscriptions/:id`, `GET /subscriptions/:id/pdf`, `POST /subscriptions/:id/send`, `POST /subscriptions/:id/respond`, `POST /subscriptions/:id/renew` — internal subscription/quotation operations, quotation PDF/email delivery, customer acceptance/decline, and plan-flagged renewals; customer reads and responses are ownership scoped. Customer changes are submitted through the request endpoints below.
- `POST /subscriptions/transition` — admin/staff status state machine.
- `POST /subscriptions/:id/plan-change/preview` and `POST /subscriptions/:id/plan-change` — validated plan/quantity preview and application; body includes `planId`, positive integer `quantity`, `timing` (`immediate` or `next_cycle`), optional `reason`.
- `POST /billing/run-batch`, `GET /invoices`, `GET /invoices/:id`, `GET /invoices/:id/pdf`, `POST /invoices/:id/send`, `PATCH /invoices/:id/status` — recurring billing, ownership-scoped invoice details/PDF download, staff invoice email delivery, and status workflow. Billing batches catch up missed periods (up to 120 per subscription per run) and report created, recovered, skipped, failed, and still-due subscriptions. Run `npm run billing:worker` as a separate process for scheduled billing and overdue/auto-close refreshes.
- `GET /payments`, `GET /payments/:id`, `POST /payments` — payment list/details and internal payment recording; optional `subscriptionId` filters to payments for invoices on that subscription. Cash reconciliation is server side.
- `GET /discounts`, `POST /discounts`, `PATCH /discounts/:id/status`, `POST /discounts/validate` — discount operations.

## Operations and analytics

- `GET /billing/calendar` — admin/staff calendar. Supports ISO `start` (inclusive), `end` (exclusive), `type`, `status`, `customer`, `plan`, `search`, `page`, `limit`. Renewal amounts are expectations; invoice events show outstanding balances.
- `GET /subscriptions/health` — admin/staff rule-based health. Supports `health`, `status`, `search`, `page`, `limit`.
- `GET /analytics/revenue/summary` — admin/staff recurring portfolio, recorded collections, observed lifecycle movements, breakdowns, top customers and a 90-day renewal estimate. Supports `days` (7–365) or paired `startDate`/`endDate` in `YYYY-MM-DD` business dates (maximum 366 days). Missing historical subscription snapshots result in null cohort metrics and an explanatory limitation; no history is synthesized.
- `GET /search?q=...` — role-scoped search across customers (internal roles), products, plans, subscriptions, invoices and payments.
- `GET /notifications` — role-scoped operational notifications.
- `GET /activity-log` — admin/staff append-only audit event listing.
- `GET /settings/workspace`, `PATCH /settings/workspace` — workspace settings; only admins can update.
- `GET /staff`, `PATCH /staff/:id/status` — admin-only staff listing and account status changes; staff creation remains `POST /auth/add-staff`.
- `GET /subscription-requests` — internal queue or customer-owned requests; `POST /subscriptions/:id/requests` submits a customer request; `PATCH /subscription-requests/:id/review` records an admin/staff approval or rejection. Review currently records the decision and does not automatically apply the requested financial/lifecycle change.
- `GET /dashboard/metrics` — admin/staff dashboard metrics.

## Financial and date conventions

- Default currency `INR`, locale `en-IN`, timezone `Asia/Kolkata`.
- Persisted `*Minor` values are integer paise. Existing major-unit fields remain for compatibility and are paired with minor-unit snapshots for new billing operations.
- API legacy amount fields and their JSON form fields are rupees, not paise. Frontend formatting accepts rupees; frontend previews are informational and the backend recalculates every financial write.
- Dates are stored as UTC timestamps and displayed in Asia/Kolkata. Date-only filters are interpreted as India business dates.
- SMTP password reset and invoice delivery are optional. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`; without SMTP, non-production development returns a simulated password-reset link, while production avoids revealing account existence. Invoice PDFs can still be downloaded without SMTP.

## Error shape

Errors use `{ success: false, error: "..." }`; validation failures use HTTP 400, authorization failures 401/403, missing records 404, conflicts 409, and unexpected failures 500.
