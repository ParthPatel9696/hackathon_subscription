# Brightloop

Brightloop is a MERN subscription and recurring billing application built with React, Vite, Tailwind CSS, React Router, Zustand, TanStack Query, Recharts, Motion, Express, and MongoDB. It provides role-based workspaces for administrators, staff, and customer accounts, with customer records, products, plans, quotation drafts, subscription lifecycle actions, recurring invoices, payment recording, discounts, and reporting.

The repository is an evolving application. This README describes the implemented workflows and calls out known gaps; it does not claim that every workflow in the product brief is complete.

## Run locally

### Add linked sample data without clearing the database

Run `npm run seed:sample` from the repository root. It uses `MONGODB_URI` from `.env`, preserves existing records and account passwords, and adds a repeatable fictional dataset across all 13 current collections. Running it again does not duplicate data. It is disabled when `NODE_ENV=production`.

The sample includes 12 customers, 6 products with configurable variants (including an Odoo price extra of INR 560), 8 plans covering all four billing periods, 3 discount rules, 3 quotation templates, 16 subscriptions, 51 invoices, 46 linked payments, 12 notes, 3 requests, and 16 activity events. Workspace settings are created only when missing; business identifier counters are maintained normally. Tax rates in this fictional dataset are illustrative settings.

| Demo role | Email | Development password |
| --- | --- | --- |
| Admin | `demo.admin@brightloop.test` | `Brightloop@Demo2026!` |
| Staff | `demo.staff@brightloop.test` | `Brightloop@Demo2026!` |
| Customer | `demo.customer@brightloop.test` | `Brightloop@Demo2026!` |

Set `BRIGHTLOOP_SAMPLE_PASSWORD` before the first run to use your own password. A rerun preserves passwords already stored for these accounts.

For older local databases that reject subscriptions with a duplicate `scheduledPlanChange.operationKey: null`, run `npm run db:repair-indexes`. This validates the corrected unique index for real string operation keys before removing the legacy index; it does not edit subscription documents.

Requirements: Node.js 18 or newer and a MongoDB instance.

1. Copy `.env.example` to `.env` and configure `MONGODB_URI`, `JWT_SECRET`, `PORT`, and `CLIENT_ORIGIN`. `JWT_SECRET` must be private and at least 32 characters.
2. Install server dependencies from the repository root with `npm install`.
3. Start the API with `npm run dev` (or `npm start`). It listens on port 5000 by default. In a separate server terminal, run `npm run billing:worker` to process recurring invoices, catch up missed billing periods, expire old quotations, refresh overdue invoices, and apply plan auto-close dates. The worker checks every 15 minutes by default; set `BILLING_WORKER_INTERVAL_MINUTES` to change it.
4. In a second terminal, run `cd client`, `npm install`, and `npm run dev`. Vite serves the client on port 5173.
5. Seed only the local demo accounts with `npm run seed:demo` from the repository root, or create an account through registration. This command updates only the three named demo users and never clears business records. `npm run seed` recreates the full demo dataset and deletes existing application records; use it only with a disposable development database.

The full `npm run seed` command **deletes and recreates application records**. The non-destructive `npm run seed:demo` command creates or refreshes only these development accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@brightloop.com` | `Admin@Secure2024!` |
| Staff | `jordan.lee@brightloop.com` | `Staff@Secure2024!` |
| Customer | `finance@acmeretail.com` | `Acme@Customer2024!` |

Do not use seeded credentials or the seed script against production data.

The API base URL defaults to `http://localhost:5000/api`. Set `VITE_API_URL` in the client environment when the API runs elsewhere. The browser authenticates with the server's HTTP-only session cookie; CORS `CLIENT_ORIGIN` must include the client origin.

## Implemented application areas

- Public landing, features, pricing-configuration notice, contact instructions, privacy notice, and terms pages.
- Customer registration, login, forgot-password request, reset-password form, session-expired, unauthorized, and not-found pages.
- Role-filtered application navigation with persisted light/dark theme, collapsible sidebar, mobile navigation, breadcrumbs, profile menu, command palette, and record search.
- Dashboard metrics sourced from MongoDB, subscription status counts, customer count, collected payments, outstanding amounts, overdue invoices, and renewal/overdue notifications.
- Customer directory with server-side search and pagination, admin customer creation/editing/archiving, and linked customer-owned profile updates.
- Customer portal dashboard, account profile, plan catalog, quotation drafts, subscriptions, invoices, and payments. Customer APIs scope billing history to the signed-in account; approved customer plan/quantity requests are applied on the next cycle.
- Admin product and plan create/edit forms. Product and plan deletions are intentionally unavailable to preserve historical references.
- Reusable admin quotation templates with product/variant lines and validity days, server-calculated quotation totals, role-scoped record lists, supported lifecycle transitions, recurring billing, invoice status actions, payment recording, discount creation/validation, CSV export, and reports.
- Server-generated invoice PDFs are available to the invoice owner and internal staff. Admin/staff can email confirmed invoices with the PDF attached when SMTP is configured.

## Roles and access

- **Admin:** dashboard, customer create/read/update/archive, product and plan management, quotations, subscriptions, invoices, payments, discounts, reports, and settings.
- **Staff:** operational records, customer directory, quotations, subscriptions, invoices, payments, and reports. Product and plan write operations, discount administration, and forced billing are admin-only.
- **Customer:** own subscription drafts and billing history, catalog/plan viewing, editable name, company, phone, and billing address, and self-service account closure after billing obligations are resolved. Profile updates synchronize the customer directory and current subscription labels. Customers cannot edit or delete financial records.

Frontend route guards improve navigation, but API authorization is enforced by Express middleware. The search and notification endpoints also restrict customer results to the signed-in customer.

## API overview

All paths below are prefixed with `/api`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register`, `/auth/login` | Public | Register a customer or sign in |
| `POST` | `/auth/forgot-password`, `/auth/reset-password` | Public | Request and apply a password reset |
| `POST` | `/auth/logout`, `GET /auth/me` | Signed in | End session or fetch current account |
| `GET`, `PATCH`, `DELETE` | `/customers/me` | Customer | Read linked portfolio, update profile, or close the account when billing obligations are clear |
| `GET` | `/customers`, `/customers/:id` | Admin, staff | Search/paginate customers and load linked billing history |
| `POST`, `PATCH`, `DELETE` | `/customers`, `/customers/:id` | Admin | Create/edit customer accounts or archive them |
| `GET` | `/search?q=...` | Signed in | Search supported business resources |
| `GET` | `/notifications` | Signed in | Overdue invoices and renewals due within seven days |
| `GET` | `/products`, `/plans` | Signed in | Read the catalog |
| `POST`, `PATCH` | `/products`, `/products/:id` | Admin | Create or update products |
| `POST`, `PATCH` | `/plans`, `/plans/:id` | Admin | Create or update plans |
| `GET` | `/dashboard/metrics` | Admin, staff | Current financial and subscription metrics |
| `GET`, `POST` | `/subscriptions` | Signed in | Read permitted subscriptions or create a draft |
| `POST` | `/subscriptions/transition` | Admin, staff | Apply a valid lifecycle transition |
| `POST` | `/billing/run-batch` | Admin, staff | Generate due recurring invoices; force mode is admin-only |
| `GET` | `/invoices` | Signed in | List permitted invoices |
| `PATCH` | `/invoices/:id/status` | Admin, staff | Update a supported invoice status |
| `GET`, `POST` | `/payments` | Signed in / admin, staff | List permitted payments or record a payment |
| `GET`, `POST` | `/discounts` | Admin/staff / admin | List or create discount rules |
| `POST` | `/discounts/validate` | Signed in | Validate a discount code |
| `PATCH` | `/discounts/:id/status` | Admin | Activate or deactivate a discount |

## Financial handling

Subscription line prices, tax, discounts, and totals are recalculated by the server using integer minor units. Client-supplied discount amounts are ignored; a quotation can apply a valid promo code with product scope, minimums, expiry, active state, and an atomically reserved usage limit. Partial and full payments cannot exceed invoice balances. MongoDB transactions are used for invoice/payment writes when supported; standalone deployments use unique billing periods, recoverable schedule updates, and a pending-payment journal.

Historical invoices store their own line and customer details. Product or plan edits therefore do not rewrite existing invoice snapshots.

## Known gaps

- Password reset and invoice email delivery are optional and use Nodemailer when SMTP is configured (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`). Without SMTP, non-production mode returns a simulated reset URL; production responses do not include a link.
- The public contact page explains that support contact details are not configured; it does not submit a contact form.
- Customer email and password changes require separate verification/recovery workflows. Staff can view customer records, while customer create/edit/archive is admin-only. Archiving is blocked while active subscriptions or unpaid invoices remain; account records are archived instead of hard-deleted so their financial history stays linked.
- Quotations support reusable templates, validity dates, server-generated PDFs, SMTP email, customer acceptance/decline, and automatic expiry. A full line editor and revision/duplicate workflow remain incomplete.
- Product and plan management supports create/edit, not variants through a dedicated editor, deletion, or full detail routes. Product variants can be edited as JSON.
- Subscription detail and plan-change history, customer activity, subscription health, billing calendar, revenue intelligence, command search, and table visibility/order/density/saved-view controls are available. Saved table preferences are per user in local browser storage and do not synchronize across devices.
- Payment allocation detail and dashboard widget preferences are not implemented.
- Revenue Intelligence reports observed subscription events and dated collections; historical MRR/retention are unavailable when older subscription snapshots are missing.
- The notification center reports actual overdue invoices and upcoming renewals; failed billing attempts are not represented in the current data model.
- Authentication endpoints have per-IP in-memory rate limits. Multi-instance deployments need a shared rate-limit store. MongoDB transaction paths require a replica set or mongos; the integration run against standalone MongoDB covers the recoverable fallback path.
- Browser end-to-end tests are not present.

## Checks

The final review and remaining requirements are documented in [FINAL_REVIEW.md](./FINAL_REVIEW.md). Browser coverage is available through `npm run test:e2e --prefix client`. It requires an isolated MongoDB instance and a browser executable:

```powershell
$env:BRIGHTLOOP_BROWSER_DB='mongodb://127.0.0.1:27029/brightloop_browser_test'
$env:BRIGHTLOOP_BROWSER_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:e2e --prefix client
```

The browser runner owns local test servers on ports 5019 and 5179 and replaces only the explicitly named disposable browser database. On other operating systems, set the executable to a compatible Chromium browser or install Playwright's Chromium and omit `BRIGHTLOOP_BROWSER_EXECUTABLE`. The separate API integration suite now requires a local database name ending in `_test`.

From the repository root:

```sh
npm test
```

For the client production build:

```sh
cd client
npm run build
```

The opt-in API integration test exercises role permissions, reset/logout revocation, customer ownership, discount eligibility and usage contention, concurrent identifier and billing runs, billing recovery, payment concurrency and recovery, and balance reconciliation. It drops its configured database, so point it only at a dedicated disposable test database:

```powershell
$env:BRIGHTLOOP_INTEGRATION_DB='mongodb://127.0.0.1:27017/brightloop_test'
npm test
Remove-Item Env:BRIGHTLOOP_INTEGRATION_DB
```

Without `BRIGHTLOOP_INTEGRATION_DB`, the backend suite runs unit tests and skips the database integration test.

The current API and amount/date conventions are described in [API.md](./API.md). Implementation and data-audit boundaries are in [PHASE2_AUDIT.md](./PHASE2_AUDIT.md). No migration should be run against existing business records until their currency and unit have been audited.
