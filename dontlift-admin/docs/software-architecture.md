# DontLift Admin Software Architecture

Date: 2026-11-24. Status: Proposed technical design, not an implementation report.

## 1. Scope and authority

This document defines the architecture for the [PRD](product-requirements.md), using the evidence in [Backend Discovery](backend-discovery.md). [Permissions](permissions.md) defines authorization and account lifecycle behavior.

Owner-confirmed requirements include Next.js, shared mobile Firestore data, approximately 1–2 pre-authorized admins, user management, order/revenue visibility, and package price management without manual Premium grants. Detailed mutation behavior remains subject to PRD acceptance. Existing accepted mobile ADRs govern payment and entitlement behavior until explicitly amended.

Local code inspection is not proof of deployed schema, Firebase project identity, or live service configuration. No infrastructure, credential, or production change is authorized by this document alone.

## 2. System boundaries

```text
Admin browser
  Next.js UI + Firebase Web Auth SDK
           |
           | HTTPS /api/admin/* + Bearer ID token
           v
Next.js Node.js Route Handlers
  authenticate -> authorize -> validate -> service -> response DTO
           |                            |
           v                            v
Firebase Admin SDK             Express catalog admin API (new)
  Auth / Firestore               independently verifies admin token
                                        |
                                        v
                               Versioned catalog (proposed)
                                        |
Mobile -> Express Premium API ----------+
                 |
                 +-> payOS -> verified webhook/status refresh
                                  |
                                  v
                         Order receipt + user Premium expiry
```

| Component | Owns | Must not own |
|---|---|---|
| Browser | Sign-in, filters, presentation, confirmation, Firebase SDK token lifecycle | Admin secrets, trusted price selection, receipt mutation |
| Next.js admin server | Admin authorization, user inspection/status commands, order reads, revenue queries, sanitized DTOs | A competing checkout/catalog authority or manual Premium grants |
| Existing Express | Catalog consumed by checkout, order reservation, payOS verification, Premium extension, catalog mutation authorization | Trust in caller-supplied UID/price without validation |
| Firebase Auth | Identity, disabled status, custom claims, token revocation | Historical revenue |
| Firestore | User profiles, canonical orders/receipts, future catalog/audit data | User-editable admin authority |

There is no new Express deployment solely for the dashboard and no duplicate primary database. Next.js must run with a server runtime; a static-only export cannot host these APIs.

## 3. Next.js application structure

Proposed locations; they need not all be created before their features are implemented:

```text
src/
  app/
    (auth)/login/page.tsx
    (admin)/layout.tsx
    (admin)/dashboard/page.tsx
    (admin)/users/page.tsx
    (admin)/orders/page.tsx
    (admin)/revenue/page.tsx
    (admin)/packages/page.tsx
    api/admin/**/route.ts
  components/
    ui/
    layout/
  features/
    auth/ users/ orders/ revenue/ packages/
  lib/
    firebase/client.ts
    api/client.ts
  server/
    firebase/admin.ts
    auth/require-admin.ts
    services/
    repositories/
    integrations/premium-api.ts
    audit/
scripts/
  admin-access.*
```

- Route handlers are thin adapters: authenticate, parse/validate input, invoke a service, map output/errors.
- Server modules use a server-only boundary. Firebase Admin SDK and repositories cannot be imported by Client Components.
- Use the Node.js runtime for Firebase Admin routes. Reuse Firebase Admin initialization across requests, including development reloads.
- Services receive server-established actor context; browser-supplied actor UID or role is never trusted.
- Keep public DTOs distinct from Firestore documents. Explicitly select fields instead of serializing raw documents.
- A request client obtains current ID tokens from Firebase SDK, uses the Authorization header, and supports cancellation. No custom refresh-token table or token storage scheme.

## 4. Authentication and rendering

The MVP uses browser Firebase Auth and Bearer tokens. Route pages may server-render a non-sensitive shell; authenticated data loads through authorized API calls after Auth readiness. Do not assume a Server Component or layout can read browser Auth state.

No authentication cookie or Server Action mutation is introduced by this design. If authenticated SSR or cookie sessions become necessary, document the session exchange, cookie properties, CSRF controls, and logout/revocation behavior as a separate change.

Frontend checks improve navigation only. Every admin API and every independently reachable Express management endpoint enforces authorization. Protecting a layout or redirecting in middleware/proxy is insufficient.

The current Next.js configuration enables Cache Components and partial prefetching. Keep authenticated data out of static prerendering, public/shared cache entries, and prefetched sensitive payloads. Admin API responses use `Cache-Control: private, no-store`; do not use `use cache` around authorization-dependent data in the MVP. Sign-out clears in-memory data and cancels outstanding requests so late responses cannot repopulate it.

## 5. Read paths

### Users

- List `users` profiles with a deterministic cursor, then fetch Auth details in bounded batches for the displayed page. Label profile counts accurately rather than implying all Auth identities have profiles.
- Exact UID lookup uses document/Auth identity lookup. Exact email lookup resolves Firebase Auth identity, then profile. Missing profile/Auth combinations remain explicit.
- Default page size 25; maximum 100. Proposed default ordering is `createdAt` descending with document ID as a stable tie-breaker; inspect legacy missing timestamps before finalizing query behavior.
- Do not offer arbitrary server filters on joined Auth fields as if Firestore could execute them. Cross-source sorting/filtering requires an explicitly designed index/projection; it cannot silently filter only the current page.

### Orders and revenue

- Read `premiumOrders` server-side. Use immutable order fields `amountVnd`, `packageId`, `paidMonths`, and `grantedMonths`.
- Source inspection confirms `createdAt`, `paidAt`, `paymentLinkId`, and `grantedExpiresAt`. `paidAt` is backend recognition time, including delayed webhook/refresh recovery, rather than guaranteed bank settlement time.
- Revenue requires PAID and valid receipt fields; missing or malformed receipts are reconciliation cases, not zero-value sales. Exact required-field validation belongs in `revenue-definitions.md`.
- Query date windows and page lists on the server. Financial day boundaries use `Asia/Ho_Chi_Minh`; inclusive user end dates become exclusive next-day UTC boundaries.
- Do not compute the total from only the current page. Charts, totals, and breakdowns share one metric definition and date interval.
- Separate current user/Premium snapshots from period-based revenue metrics. Return refresh metadata; do not imply a transactionally consistent snapshot across Firebase Auth and multiple Firestore queries.
- Never call payOS for every row when opening the dashboard. Consume canonical receipts; active payment recovery stays within existing Express payment operations.

## 6. Mutation paths

### User status

Next.js validates admin access and target restrictions, reserves an audit command, applies Firebase Auth disable/enable and required revocation, and records the outcome. Audit intent must be durable before side effects. An audit completion failure after an Auth success results in an uncertain/reconciliation outcome, not a claim that the Auth action rolled back.

The command contract needs actor-bound idempotency, payload conflict detection, a per-target concurrency policy, and recovery. Auth state alone cannot prove which of two competing commands last changed it. These details must be settled in data/API contracts before enabling writes.

### Package prices

Next.js forwards the incoming Firebase admin token over HTTPS to a configured Express management endpoint. Express independently verifies the token, revocation, disabled status, and admin claim. Caller-supplied actor headers are not authority. Tokens are never persisted or logged. This is a delegated admin request, not an unauthenticated service shortcut.

Express owns a future versioned persistent catalog and the canonical price-change audit/command. Next.js may carry a correlation ID but must not create competing records claiming a second catalog commit.

Current catalog reads and checkout use a frozen code array. To support dynamic prices:

1. Define a persistent catalog schema and seed it from the approved ADR-029 values through an explicit migration.
2. Make listing and checkout consume that catalog. Existing receipts remain unchanged.
3. Read the relevant catalog revision within the order-reservation transaction, or establish an equivalent serialized boundary; a catalog read before reservation does not guarantee the promised cutover.
4. Price updates require an expected revision and command identity. Stale updates return conflict; repeated commands resolve to their original outcome.
5. Reject unavailable/missing authoritative catalog data rather than silently falling back to stale hardcoded checkout prices.
6. Update mobile price confirmation behavior and test concurrent price changes before enabling the feature.

The persistent catalog, management endpoint, and migration are not implemented by these documents. They require a shared mobile/backend ADR and API contract.

## 7. Errors, validation, and limits

- Validate allowed fields, UID/order identifiers, cursor/filter compatibility, page size, and date bounds before repository operations.
- Admin APIs use consistent versioned success/error envelopes; detailed wire formats belong in `api-contracts.md`.
- Distinguish 401 authentication failures, 403 permission failures, 400 invalid input, 404 unknown resources after authorization, 409 revision/idempotency conflicts, 429 throttling, and sanitized 5xx dependency failures.
- Unavailable Auth verification is a dependency failure with access denied, not a fabricated valid session or always an incorrect-credentials error.
- No automatic blind mutation retries after timeout. Read command status first and reuse command identity.
- Read quotas, rate limits, payload limits, and deployment execution limits must be quantified in implementation contracts. Rate limiting must account for the selected hosting topology rather than rely solely on process-local counters.

## 8. Deployment, configuration, and observability

- Deploy Next.js independently from mobile and Express. Hosting provider, region, deadline, and budget remain undecided.
- Select an explicit Firebase project ID and fail on credential/project mismatch. Do not copy secrets from mobile public environment variables.
- Browser configuration contains only Firebase Web app identifiers. Server configuration contains credential references, expected project ID, and an allowlisted Premium API origin. No Firebase Admin/payOS/Cloudinary secrets in `NEXT_PUBLIC_*`.
- Prefer managed credentials where available; otherwise inject credentials through the hosting secret mechanism. Operator provisioning credentials must not be shipped to browser code.
- Staging uses emulators or an explicitly authorized non-production environment. Never silently target production or enable billing.
- Log correlation IDs, route outcomes, duration, and sanitized dependency failures. Do not log bearer tokens, credentials, checkout payloads containing bank information, or full profiles.
- Observe query reads/latency, revenue validation exclusions, failed/stuck mutation commands, and upstream errors. Retention and alert thresholds remain deployment decisions.

## 9. Verification and implementation order

1. Implement and verify Firebase configuration, authorized sign-in, per-request guard, and trusted operator provisioning.
2. Add bounded user and order reads; verify profile/Auth inconsistencies and cursor behavior.
3. Define/reconcile revenue queries against a known dataset and check read budgets.
4. Implement audited user-status commands after concurrency/recovery contracts are complete.
5. Implement dynamic catalog in Express and mobile confirmation, then enable dashboard price updates.

Before release, verify direct unauthorized API calls, disabled/revoked admins, fake profile roles, cache isolation, pagination, receipt totals, time-zone boundaries, concurrency, timeout recovery, and mobile disable behavior. No code/runtime checks are claimed by this architecture document.

## 10. Sources and unresolved contracts

- [PRD](product-requirements.md), [discovery evidence](backend-discovery.md), and [permissions](permissions.md).
- [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication): authorization belongs at data/API boundaries, not only layouts.
- [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims): trusted-server role assignment and claim propagation.
- [Firestore Rules conditions](https://firebase.google.com/docs/firestore/security/rules-conditions): server client libraries bypass client Security Rules and use IAM.

Still required: data model, revenue definitions, detailed API contracts, catalog ADR/migration, verified deployed project/schema/indexes, operator credentials policy, audit retention, and hosting limits. Do not treat proposed contracts as existing functionality.
