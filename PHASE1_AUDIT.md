# Brightloop Phase 1 Backend Audit

## Baseline before changes

- `npm test`: 5 passed, 0 failed, and the opt-in MongoDB integration test was skipped because `BRIGHTLOOP_INTEGRATION_DB` was unset.
- `client/npm run build`: passed.

## Existing functionality

- Express/Mongoose API with role checks for admin, staff, and customer routes.
- HttpOnly session cookie, password hashing, hashed reset tokens, and customer ownership filters for subscription, invoice, payment, search, and notification reads.
- Integer minor-unit money helpers, invoice status transitions, and a unique subscription/billing-period invoice index.
- React application uses a central Axios client and TanStack Query; the frontend production build was healthy at baseline.

## Confirmed defects and fixes

- Activation used a monthly date regardless of cadence. It now reuses `advanceBillingDate` for daily, weekly, monthly, and yearly subscriptions. Monthly and yearly date clamping handles month ends and leap days.
- Quotation creation ignored promo codes and trusted no discount metadata. Discounts are now recalculated on the server in minor units, scoped to all products, a target product, or seats, and checked for minimums, dates, active state, and usage limits. Per-line allocations are saved with the quote.
- Billing wrote invoices before saving the subscription schedule and could leave a duplicate-period invoice with a stale next billing date. Transactions are used when MongoDB supports them; the standalone fallback relies on the unique period index and repairs the schedule on retry.
- Payment recording updated an invoice and then created a payment with a compensating rollback that could race. Transactions are used when available. Standalone MongoDB uses a per-invoice lease and pending-payment journal so a later retry can finish an interrupted reconciliation.
- Subscription and invoice identifiers depended on document counts. They now use atomic per-year counters, initialized against existing readable identifiers.
- Authentication routes had no throttling, logout did not revoke a copied JWT, and login/register returned the JWT in JSON. IP-based rate limits, session-version revocation on logout/reset, stricter registration terms, and cookie-only credentials are now in place.
- Subscription searches accepted raw regular expressions, and invoice/subscription status writes could race with financial changes. Search input is escaped and key status updates use compare-and-set writes.

## Security and access review

- Admin, staff, and customer access is covered in the opt-in API integration test. Staff can perform operational payment actions but cannot administer discounts or customers. Customer-owned reads remain scoped, and customer writes to financial records are not exposed.
- Production reset responses use the same message for known and unknown accounts and omit reset links. Reset email delivery still needs an email provider.
- Session cookies are HttpOnly, SameSite=Lax, and Secure in production. The server now requires a 32-character `JWT_SECRET` at startup.
- Authentication limits use in-memory per-process counters. They reset on restart and are not shared across multiple server instances; deployments with multiple workers need a shared rate-limit store.

## Verification after changes

The opt-in run against `brightloop_codex_test` completed with 11 passed, 0 failed, and 0 skipped. The frontend production build passed. JavaScript syntax checks and `git diff --check` passed (Git printed only line-ending normalization notices). The opt-in integration test uses a disposable MongoDB database and drops it during cleanup. It covers role permissions, customer ownership, server-side discount calculations and usage contention, billing races and recovery, payment concurrency and recovery, identifier concurrency, reset/logout revocation, and auth rate limiting.

## Remaining limitations

- MongoDB transactions require a replica set or mongos. The configured local standalone MongoDB exercises the fallback path; a replica-set integration run is still needed to execute transaction paths directly.
- Discount usage is reserved atomically and compensated on normal save failures. A process crash between reservation and quote save can leave a usage count that needs administrative reconciliation.
- Password reset email delivery is not configured. Database-level payment conflicts that cannot be matched to a pending journal record return a manual-reconciliation error rather than altering historical payment data.
