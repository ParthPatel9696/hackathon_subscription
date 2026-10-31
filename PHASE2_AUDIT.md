# Brightloop product expansion audit

This report records what the source tree and local verification support. It does not certify a production deployment or a live business database.

## Repository and data findings

- The application remains a JavaScript MERN modular monolith: Vite/React/React Router/TanStack Query/Recharts/Motion and Express/Mongoose/JWT. No new database or infrastructure service was introduced.
- The baseline report is in [PHASE1_AUDIT.md](./PHASE1_AUDIT.md). Existing source models store legacy INR major-unit fields (for example `salesPrice`, `grandTotal`, and `amount`) and now pair new financial flows with integer `*Minor` snapshots in paise. Legacy values are not safe to convert globally without knowing each record's original currency and unit.
- The workspace has no database connection available for this task. Production/demo record currency codes, actual stored values, index state, and tax history could not be inspected. No migration or bulk financial update was run. Missing product tax configuration stays distinguishable from an explicit zero tax rate; affected legacy invoice creation/plan changes should be reviewed before any production rollout.
- Current source tracks subscription status and plan-change events going forward. Existing subscriptions without snapshots cannot support reconstructed historical MRR/retention. Those metrics are withheld or marked unavailable; stored payment dates remain the source for collection history.

## Delivered capabilities in source

- Shared INR/en-IN and Asia/Kolkata formatting, rupee input conversion, server-side paise calculations, and India business-date filtering.
- Customer 360 portfolio summary, internal notes with role checks, admin tags, account archive guards, activity timeline, and direct subscription links.
- Server validated immediate/next-cycle plan change preview and apply flows, documented UTC half-open-period proration policy, quantity support, schedule processing and change history.
- Billing calendar month/week/list views with server date-range events and expected-versus-outstanding labels.
- Rule-based subscription health with server pagination, invoice causes, payment dates, reasons and indicators.
- Revenue summary, collections, current recurring breakdown by product/plan/interval, observed movement metrics, cohort-history caveats, customer rankings and deterministic renewal estimate.
- Keyboard command palette with permission-aware commands, role-scoped search, result grouping/highlighting, and recently visited records.
- Advanced resource filters/sorting/preferences/selection/export; CSV export follows all server-filtered pages. Preferences are user-keyed in this browser's local storage.
- Optional SMTP reset delivery. API endpoints and amount/date conventions are documented in [API.md](./API.md).

## Acceptance and rollout limits

- MongoDB-dependent end-to-end workflows require `BRIGHTLOOP_INTEGRATION_DB` pointing to an isolated test database. The current run did not have that environment variable and skipped the integration test. Do not point the test at production: the test drops its target database.
- No live production database migration was prepared because the requested audit requires determining each existing record's unit/currency first. To complete the data audit safely, provide a sanitized database snapshot or an isolated read-only connection and confirm whether legacy numeric amounts mean INR major units.
- Transaction paths depend on replica-set or mongos support; standalone MongoDB follows the documented fallback path.
- Saved table preferences are per user on the current browser, not synchronized across devices. Health and calendar use fit-for-purpose tables; common preferences and the resource table system cover the directory/catalog/finance lists.
- The current product tax fields are configurable, but this does not constitute tax filing, invoice-format, or GST legal compliance certification.
- Payment collection/refunds remain manual workflows; plan-change proration is previewed and recorded without silently charging/refunding customers.
