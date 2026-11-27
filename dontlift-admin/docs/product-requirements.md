# DontLift Admin — Product Requirements Document

Date: 2026-11-24. Status: Draft for owner review.

Confirmed scope: a Next.js dashboard sharing Firebase/Firestore data with DontLift Mobile; user management, orders, revenue reporting, and package price updates; approximately 1–2 accounts provisioned with admin access. Premium activation remains automatic after payment, with no manual grants. The deadline and hosting budget are undecided. Quantitative targets and detailed behaviors below are proposed acceptance criteria, not measured results or implemented features.

## 1. Executive Summary

### Problem Statement

The project owner needs a management interface to monitor DontLift users, Premium purchases, and revenue. Package prices and account status need controlled management workflows instead of direct edits to production data.

### Proposed Solution

Build DontLift Admin using Next.js App Router, TypeScript, Tailwind, and Glass UI. Admin APIs run in Next.js with server-side Firebase access; the existing Express backend retains ownership of payOS payments, the sales catalog, and Premium extension logic.

### Success Criteria

1. All unauthorized-access test cases for admin data pages and APIs are rejected; ordinary mobile users cannot grant themselves admin privileges.
2. Dashboard revenue totals and transaction counts match 100% of the selected reconciliation dataset, including duplicate webhooks, unpaid orders, and transactions at day boundaries.
3. After a successful price update, new checkouts use the new price; 100% of previously created orders and historical receipts in the test dataset retain their agreed amount and duration.
4. Every completed account disable/enable or price update has an audit record identifying the actor, target, time, and outcome.
5. Proposed performance targets: list API p95 below 2 seconds for a 25-row page; reports below 5 seconds for up to 90 days on a 10,000-order dataset. Measure at least 100 warmed requests on a staging environment with its configuration recorded; measure cold starts separately. Optimize queries or introduce aggregates before acceptance if these targets are missed.

## 2. User Experience & Functionality

### User Personas

- Project owner/operator: 1–2 accounts sharing the same `admin` role, viewing metrics and performing permitted operations.
- Mobile user: the managed account holder, without access to the dashboard or admin APIs.

Custom role management is outside the initial scope. Admin accounts are provisioned and authorized through a trusted server-side process; there is no public admin registration page.

### User Flow

Firebase Auth sign-in → server verifies token and admin privileges → Overview → Users / Orders / Revenue / Package Prices → filter or inspect details → confirm data changes → display the outcome and record an audit event → sign out.

### User Stories & Acceptance Criteria

#### AUTH-01 — Admin sign-in

**Story:** As an admin, I want to sign in with an authorized account so that I can access management data.

- Use Firebase Auth from the same project as mobile; verify the supported sign-in method against the existing Auth configuration before implementation.
- Only accounts with the custom claim `admin: true`, assigned by a trusted server, may access admin functionality.
- APIs validate the token, disabled/revoked status, and privileges on every request; return 401 for unauthenticated requests and 403 for insufficient privileges.
- Provide verifying, invalid-credentials, insufficient-permissions, expired-session, and signed-out states.
- Signing out clears local authentication state and prevents admin data from reappearing through cached page navigation.

#### DASH-01 — Overview

**Story:** As an admin, I want to view key operating metrics so that I can assess user activity and package sales.

- Display the total number of user profiles, users with active Premium, payment revenue, and PAID order count for the selected period.
- Base the profile count on `users`; do not label it as the total Auth account count without reconciliation. Obtain disabled status from Firebase Auth.
- Determine active Premium using `premiumExpiresAt > serverNow`, rather than relying solely on `isPremium`.
- User and active-Premium counts are snapshots at refresh time; revenue and order counts follow the selected date range. Label this distinction.
- Include daily revenue charts and revenue/order breakdowns by package.
- Display the refresh timestamp, date range, and time zone; missing data or API failures must not appear as fabricated zero values.

#### USER-01 — Find and inspect users

**Story:** As an admin, I want to find a user and inspect their account so that I can support them.

- Lists include UID, display name, email when available, creation date when available, disabled status, and Premium expiration.
- Support exact UID or email lookup; enable display-name filtering only with a verified query/index strategy. Fuzzy full-text search is not promised for the MVP.
- Use server-side cursor pagination, with 25 rows by default and at most 100 rows per request; preserve filters and stable ordering.
- User details include the profile, Auth status, and orders belonging to that exact UID.
- Explicitly identify missing profiles, Auth records, or historical fields; do not manufacture data to fill gaps.

#### USER-02 — Disable and re-enable accounts

**Story:** As an admin, I want to disable or re-enable a user account so that I can manage access when needed.

- This draft interprets user management as viewing, searching, and disabling/re-enabling accounts; the owner must review this boundary.
- Require a confirmation dialog and a reason before disabling; clearly identify the target account.
- Disable through Firebase Auth and revoke refresh tokens. Preserve the account, history, and purchased Premium entitlement.
- Prevent actions against the current admin or other admin accounts through the MVP dashboard to avoid losing administrative access.
- Repeated requests must not produce additional side effects; record audit events and support reconciliation when the Auth update succeeds but audit recording or response delivery fails.
- Verify mobile behavior: issued tokens may remain valid until expiration if the data-access path does not check disabled status. Disabling/revoking alone does not establish immediate blocking of every access path. Document the actual enforcement window or add status enforcement through an approved design.

#### ORDER-01 — Inspect Premium orders

**Story:** As an admin, I want to inspect package purchase orders so that I can explain payment and entitlement outcomes.

- Display order code, UID, package, VND amount, status, creation/payment timestamps when available, and granted expiration from the receipt when available.
- Use the existing states: CREATING, PENDING, PAID, CANCELLED, and EXPIRED; the UI cannot manually change payment status.
- Filter by status, package, and date range; support exact order-code or UID lookup. Date filter labels must distinguish creation time from payment time.
- Do not expose payment secrets or sensitive upstream data, or treat a successful redirect as proof of payment.

#### REV-01 — Revenue reporting

**Story:** As an admin, I want to filter verified payment revenue so that I can assess sales by period and package.

- Sum integer VND amounts only for PAID orders with valid server confirmation evidence. Count each order once.
- Exclude PENDING, CREATING, CANCELLED, and EXPIRED orders; do not estimate revenue by multiplying Premium users by current prices.
- Use the historical order amount and package snapshot; catalog changes must not alter past reports.
- Use the server-confirmed payment timestamp; verify actual Express/Firestore field mappings before implementation. Separately identify orders lacking timestamps or confirmation evidence for reconciliation; do not substitute creation dates for payment dates.
- Group days in `Asia/Ho_Chi_Minh`. Both dates selected by the operator are inclusive; implement the range using an exclusive start-of-next-day upper boundary converted to UTC.
- Default to the current month; support custom ranges of at most 90 days per request in the MVP. Tables, charts, and KPI cards must share filters and metric definitions.
- Label the metric as payment revenue, rather than profit, net proceeds after fees, or MRR. Without verified refund/fee data, explicitly state that these deductions are not included.
- Refresh data on page entry or explicit reload; realtime updates are outside the MVP commitment.

#### PRICE-01 — Update package prices

**Story:** As an admin, I want to update package prices so that new purchases use the approved selling price.

- Display the catalog owned by the Premium API; do not maintain a dashboard-only price list.
- The MVP edits only `amountVnd` on existing packages. Package IDs, paid months, granted months, package creation/deletion, and manual entitlement grants are outside this feature.
- Accept positive integer VND amounts validated by the backend and within supported payOS/backend limits verified before release.
- Show old and new prices and require confirmation. Use revisions/versions to detect competing updates; a stale revision returns a conflict and requires a reload.
- New prices apply only to orders reserved after the new catalog revision is committed. Existing reservations, payment links, and receipts retain their original snapshots.
- Mobile continues loading the catalog through `/v1/premium/packages`; checkout uses server prices. If the price changes after mobile loads the catalog, the order flow must show the actual amount and obtain user confirmation before opening payment, rather than silently charging a different price.
- Express requires an authenticated, authorized, audited catalog-update contract. Local source inspection at `D:/premium-api` found a hardcoded catalog and no catalog mutation route in the inspected app wiring; live deployment behavior remains unverified. See [Backend Discovery](backend-discovery.md).
- Audit records include actor UID, package ID, previous/new price, revision, and timestamp. After a timeout, the client must be able to read back the revision/outcome before retrying.

#### UX-01 — Interface and feedback states

**Story:** As an admin, I want consistent feedback and readable data so that I can operate without confusing loading, empty and failure states.

- Every screen has appropriate loading, empty, error, retry, and permission-denied states; failures preserve selected filters.
- Primary operations are keyboard accessible with visible focus; dialogs manage focus and support Escape when a commit is not in progress.
- Target WCAG AA contrast: 4.5:1 for ordinary text and 3:1 for large text.
- Verify 375, 768, and 1440 px viewports; wide tables scroll within their own containers without causing page-wide horizontal overflow.
- Proposed MVP interface language: Vietnamese; currency: VND; timestamps follow the defined time zone.

### Non-Goals

- Manual Premium grants/extensions, automatic subscription renewal, or replacing the existing payOS webhook mechanism.
- Creating/deleting packages, changing duration/bonus months, promotions, or coupons in the MVP.
- Permanent user deletion, editing scores/rooms/history, simulating payments, or modifying receipts.
- Public admin registration, an admin-account creation screen, or custom multilevel RBAC.
- Automated refunds, invoices, profit accounting, MRR, or bank reconciliation.
- AI features, CSV export, realtime dashboards, or unlimited date ranges in the MVP.
- Automatically enabling Firebase billing or deploying production before the owner chooses an environment.

## 3. AI System Requirements (If Applicable)

Not applicable. This PRD includes no AI features, models, or AI-output evaluation requirements.

## 4. Technical Specifications

### Architecture Overview

```text
Admin browser (Next.js UI + Firebase Auth)
        |
        | Firebase ID token over HTTPS
        v
Next.js Route Handlers — Node.js runtime
        |-- authentication, admin authorization, validation, audit
        |-- Firebase Admin SDK -> Firebase Auth / Firestore
        |-- authenticated catalog management API -> Express Premium API

Mobile -> Express Premium API -> payOS
                      |
                      +-> verified webhook -> order receipt + premiumExpiresAt
```

- Do not create another Express service solely for the dashboard. Next.js hosts admin APIs; the existing Express service retains payment/catalog ownership.
- Share the mobile Firebase project/database; do not introduce a duplicate user/order database as the primary source.
- Place route adapters in `src/app/api/admin/`; keep server-only services/repositories separate from UI code and out of client bundles.
- Use bearer Firebase ID tokens in the MVP, verified server-side. Do not manually store tokens in Firestore tables or replace Firebase SDK token refresh with custom logic.
- Do not publicly cache admin responses. Queries require pagination, allowed filter fields, row limits, and date-range limits.
- Route price changes through the Express owner or an approved shared service; Next.js must not independently update a catalog that Express does not consume.

### Integration Points

**Known data sources:**

- `users/{uid}`: profile and `premiumExpiresAt`.
- Firebase Auth: identity, disabled status, and custom claims.
- `premiumOrders`, `premiumOrderRequests`, and `premiumCurrentOrders`: backend-only collections. Local Express source confirms order snapshots, server `createdAt`, and server `paidAt`/`grantedExpiresAt` at payment recognition. Verify deployed field completeness and indexes before coding; mobile interfaces are not a complete Firestore schema. See [Backend Discovery](backend-discovery.md).
- Audit storage and catalog revisions are proposed additions; design their location, schema, and retention before implementing mutations.

**Proposed admin APIs; these endpoints do not yet exist:**

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/admin/me` | Identity and admin privileges |
| GET | `/api/admin/overview` | Overview KPIs |
| GET | `/api/admin/users` | Cursor-paginated user list |
| GET | `/api/admin/users/:uid` | User details |
| PATCH | `/api/admin/users/:uid/status` | Disable/re-enable a user |
| GET | `/api/admin/orders` | Order list |
| GET | `/api/admin/orders/:orderCode` | Order details |
| GET | `/api/admin/revenue` | Aggregates using shared revenue definitions |
| GET | `/api/admin/packages` | Current catalog |
| PATCH | `/api/admin/packages/:id/price` | Forward a price update to the Express owner |

Detailed wire contracts, payload limits, idempotency, and error formats belong in subsequent API/design documents. Required status handling includes 401, 403, 400, 409, 429, and 5xx; do not expose internal errors or secrets to the browser.

**Current reference catalog — ADR-029; not verified against the live backend:**

| Package ID | Price (VND) | Paid months | Granted months |
|---|---:|---:|---:|
| MONTH_1 | 30,000 | 1 | 1 |
| MONTH_3 | 79,000 | 3 | 4 |
| MONTH_6 | 149,000 | 6 | 8 |
| MONTH_12 | 249,000 | 12 | 16 |

This is the documented baseline, not authoritative hardcoded checkout pricing. The server catalog's committed revision is the operational price authority.

**Queries and aggregation:**

- Do not download all users/orders into the browser for filtering or revenue calculation.
- Verify Firestore indexes, read costs, Spark quotas, and schema before selecting an aggregation strategy.
- If raw queries exceed the approved read/performance budget, introduce daily aggregates with duplicate protection, backfill, and reconciliation; do not enable Functions/billing by default.
- Firestore does not provide arbitrary full-text search out of the box; the MVP prioritizes exact UID/email lookup.

### Security & Privacy

- Run Firebase Admin SDK only on the server using trusted environment credentials; never place secrets in `NEXT_PUBLIC_*`, the repository, or logs.
- Admin SDK access is privileged: enforce authorization in services/APIs instead of relying on Firestore Rules or hidden UI controls.
- Grant/revoke custom claims through a server-side operator tool; do not derive admin privileges from user-editable profile fields.
- Check revocation and disabled status for admin requests. Direct API access and guessed UIDs remain subject to authorization.
- Audit mutations with command identity, actor, reason, necessary before/after values, and pending/completed/failed status for cross-system reconciliation; do not promise atomic transactions across Auth, Express, and Firestore.
- Deny direct client writes to payment, catalog, and audit collections. Do not broaden Rules solely to allow the admin browser to read everything.
- Do not put ID tokens in URLs or log tokens/payment secrets; expose personal information only as needed for support.
- Audit retention and hosting region are undecided and must be selected before production; do not automatically purge historical receipts.

### UI Components

| Area | Suitable Glass UI components |
|---|---|
| Navigation shell | Sidebar, Breadcrumb, Dropdown Menu, Separator |
| Overview/revenue | Card, Chart, Tabs, Select, Date Picker Input |
| Users | Table, Avatar, Badge, Input, Pagination, Sheet |
| Orders | Table, Badge, Select, Dialog |
| Price updates | Input, Label, Button, Alert Dialog |
| Feedback states | Skeleton, Empty State, Alert, Sonner, Spinner |

Limit glass effects to navigation, toolbars, and dialogs; prefer low-transparency surfaces for tables and monetary values. Components do not replace server filtering, authorization, or revenue calculations. Add WebGL only after performance verification; the CSS fallback is sufficient for the MVP.

### Validation & Testing

- Reconcile a dataset covering every order state, duplicate webhooks, old/new prices, multiple orders per user, and day/month boundary timestamps.
- Test missing, invalid, expired, and revoked tokens; ordinary users; disabled admins; self-disable attempts; and unauthorized price updates.
- Test checkout concurrent with price changes, two admins updating the same revision, timeouts after commit, and mutation retries.
- Verify account disabling with mobile already signed in, offline, and reconnecting; document when access is actually blocked.
- Test Auth/Firestore/Express failures, missing historical fields, missing indexes, and audit-write failures.
- Use Emulator Suite for applicable Firebase checks; test catalog/checkout with Express staging and a supported payOS testing environment. Do not create production payments as the default testing procedure.
- Run type checks, lint, production builds, and rendered UI verification; measure performance KPIs under the conditions in section 1.

### Existing Sources & Dependencies

- [Mobile AGENTS](../../dontlift-mobile/AGENTS.md): decision authority and project constraints.
- [ADR-025](../../dontlift-mobile/docs/decisions/ADR-025-payos-expiring-premium.md): Express/payOS, expiring Premium, and Spark.
- [ADR-029](../../dontlift-mobile/docs/decisions/ADR-029-premium-pricing-update.md): updated prices/durations, superseding ADR-025 pricing.
- [API contracts](../../dontlift-mobile/docs/api-contracts.md): Premium endpoints and backend-only collections.
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup).
- [Glass UI](https://glass-ui.crenspire.com/docs/getting-started/).

This PRD proposes dynamic pricing; it does not automatically amend mobile ADRs. Before implementation, establish a shared ADR/API contract for catalog revisions and mobile price reconfirmation. Local Express source was subsequently inspected at `D:/premium-api`; live deployment, actual database contents, and credentials remain unverified. The owner confirmed UID-based provisioning of the `admin: true` custom claim; this does not imply approval of every other draft proposal.

## 5. Risks & Roadmap

### Phased Rollout

| Phase | Scope and exit criteria |
|---|---|
| MVP-A: foundation and read access | Approve PRD; verify schema/backend; provision trusted admins; implement auth, users/orders, overview/revenue; pass authorization and reconciliation checks |
| MVP-B: complete management MVP | Disable/re-enable users with audit; update Express catalog, versioning, and mobile behavior; pass concurrency/retry and mobile-impact checks |
| v1.1 | Consider CSV, additional filters, and daily aggregates based on actual demand/quotas; requires separate scope approval |
| v2.0 | Consider multiple roles, admin-account management, and advanced reporting as the operations team grows; unapproved features are not commitments |

The complete MVP includes both A and B. No deadline, budget, or hosting provider is committed. Production requires selecting a Node.js environment supporting Route Handlers, secrets, HTTPS, runtime limits, and a Firestore read budget; deployment is not automatic.

### Technical Risks

| Risk | Impact | Mitigation/release condition |
|---|---|---|
| Express catalog may be hardcoded or lack an update API | Dashboard prices change while checkout prices do not | Inspect source, add an owner API/revisions, and test mobile end-to-end before enabling updates |
| Missing historical timestamps or receipt fields | Incorrect daily revenue | Verify schema, flag reconciliation cases, and backfill using evidence; do not guess timestamps |
| Spark quotas and report scans | Quota exhaustion or slow queries affect mobile | Bound queries, measure reads, and establish indexes/aggregates and budgets before release |
| Disabling does not immediately invalidate every mobile ID token | Incorrect expectations about blocking | Verify access paths, establish the enforcement window or add enforcement, and document actual behavior |
| Concurrent admins or retries after timeouts | Lost updates or ambiguous checkout pricing | Revision conflicts, command identities, order snapshots, and outcome readback |
| No shared transaction across Auth/Express/audit | Mutation succeeds but logging or response fails | Command state, reconciliation, and a UI state indicating verification is needed |
| Admin SDK bypasses Rules | Unauthorized data exposure or mutation | Server guards at every endpoint/service, direct API tests, and server-only secrets |
| Mobile displays stale catalog prices | Buyers see conflicting prices | Reconfirm the amount before payment; preserve reserved orders/payment links |

### Points for Owner Review

1. Approve the interpretation of user management as finding/viewing and disabling/re-enabling accounts, without deletion or editing profiles on users' behalf.
2. Approve price-only package updates in the MVP, preserving duration and bonus months.
3. Approve Vietnamese UI, a maximum report range of 90 days, and no CSV in the MVP.
4. Approve Next.js admin APIs with Express owning catalog/payments; arrange backend/source access for implementation.
