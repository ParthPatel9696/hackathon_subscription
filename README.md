# Brightloop

Brightloop is a MERN subscription and recurring billing application built with React, Vite, Tailwind CSS, React Router, Zustand, TanStack Query, Recharts, Motion, Express, and MongoDB. It provides role-based workspaces for administrators, staff, and customer accounts, with customer records, products, plans, quotation drafts, subscription lifecycle actions, recurring invoices, payment recording, discounts, and reporting.

The repository is an evolving application. This README describes the implemented workflows and calls out known gaps; it does not claim that every workflow in the product brief is complete.

## Run locally

Requirements: Node.js 18 or newer and a MongoDB instance.

1. Copy `.env.example` to `.env` and configure `MONGODB_URI`, `JWT_SECRET`, `PORT`, and `CLIENT_ORIGIN`. `JWT_SECRET` must be private and at least 32 characters.
2. Install server dependencies from the repository root with `npm install`.
3. Start the API with `npm run dev` (or `npm start`). It listens on port 5000 by default.
4. In a second terminal, run `cd client`, `npm install`, and `npm run dev`. Vite serves the client on port 5173.
5. Sign up for a customer account, or seed a local development database with `npm run seed` from the repository root.

The seed script **deletes and recreates application records**. It creates these development accounts:

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
- Customer portal dashboard, account profile, plan catalog, quotation drafts, subscriptions, invoices, and payments. Customer APIs scope billing history to the signed-in account.
- Admin product and plan create/edit forms. Product and plan deletions are intentionally unavailable to preserve historical references.
- Subscription quotation drafts, server-calculated line totals, role-scoped record lists, supported lifecycle transitions, recurring billing, invoice status actions, payment recording, discount creation/validation, CSV export, and reports.

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

- Password reset email delivery is optional and uses Nodemailer when SMTP is configured (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`). Without SMTP, non-production mode returns a simulated reset URL; production responses do not include a link.
- The public contact page explains that support contact details are not configured; it does not submit a contact form.
- Customer email and password changes require separate verification/recovery workflows. Staff can view customer records, while customer create/edit/archive is admin-only. Archiving is blocked while active subscriptions or unpaid invoices remain; account records are archived instead of hard-deleted so their financial history stays linked.
- Quotations can be created as drafts and transitioned, but there is no multi-step editor, quotation detail route, PDF export, expiry workflow, or direct conversion action.
- Product and plan management supports create/edit, not variants through a dedicated editor, deletion, or full detail routes. Product variants can be edited as JSON.
- Subscription detail and plan-change history, customer activity, subscription health, billing calendar, revenue intelligence, command search, and table visibility/order/density/saved-view controls are available. Saved table preferences are per user in local browser storage and do not synchronize across devices.
- Invoice PDF generation, payment allocation detail, dashboard widget preferences, and a full quotation detail/expiry workflow are not implemented.
- Revenue Intelligence reports observed subscription events and dated collections; historical MRR/retention are unavailable when older subscription snapshots are missing.
- The notification center reports actual overdue invoices and upcoming renewals; failed billing attempts are not represented in the current data model.
- Authentication endpoints have per-IP in-memory rate limits. Multi-instance deployments need a shared rate-limit store. MongoDB transaction paths require a replica set or mongos; the integration run against standalone MongoDB covers the recoverable fallback path.
- Browser end-to-end tests are not present.

## Checks

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
