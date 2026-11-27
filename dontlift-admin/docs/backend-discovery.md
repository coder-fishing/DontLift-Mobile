# Backend Discovery

Date: 2026-11-24. Scope: local source inspection for DontLift Admin technical design.

This is evidence from source, not a live Firebase, deployment, or payment verification. No credentials were read, no backend code was changed, and no admin privileges were assigned.

## Source locations

- Admin: `D:/DontLift-Mobile/dontlift-admin`.
- Mobile: `D:/DontLift-Mobile/dontlift-mobile`.
- Existing Express backend discovered at `D:/premium-api`.

## Verified findings

| Area | Local evidence | Design consequence |
|---|---|---|
| Package catalog | `D:/premium-api/src/domain/premiumPackages.js` exports a frozen array; prices are 30,000 / 79,000 / 149,000 / 249,000 VND | Prices are code-owned today. Dynamic price updates require an Express catalog redesign, not a dashboard-only Firestore write |
| Catalog API | `src/routes/packages.js` and `src/controllers/systemController.js` expose GET catalog from that array | No catalog mutation endpoint is present in the inspected app/router wiring |
| Checkout | `src/services/orderService.js` resolves `packageById` and passes the package to `store.reserve` | Both catalog listing and order reservation must consume the same authoritative versioned catalog |
| Order storage | `src/repositories/orderRepository.js` writes `premiumOrders/{orderCode}` | Admin can read canonical orders through its server-side repository without changing the mobile client-read Rules |
| Snapshot | Reservation stores `uid`, `requestId`, `orderCode`, `packageId`, `amountVnd`, `paidMonths`, `grantedMonths`, `status`, and server `createdAt` | Reports use historical amounts and durations, never current catalog values |
| Paid receipt | `grant` writes `status: PAID`, `paymentLinkId`, `grantedExpiresAt`, server `paidAt`, and `updatedAt` | Use `paidAt` as backend recognition time for daily payment-revenue reports; it is not necessarily the bank's original transfer time |
| Entitlement | The same transaction updates `users/{uid}.premiumExpiresAt`, `isPremium`, and `updatedAt` | Preserve existing activation flow. No manual grant endpoint is required |
| Duplicate payment handling | `grant` returns without extending again if the order is already PAID | Count each order once. Do not count webhook calls as sales |
| Payment verification | `webhookService.js` verifies signature, amount/currency/link identity, then authenticated payOS PAID status; repository refresh also verifies payment before granting | Admin reports consume receipts, not redirects or client assertions |
| User profiles | Mobile `firestore.rules` allows owner get/create and restricted display-name updates, but denies list/delete | Browser admin should not list users through mobile SDK permissions; Next.js must authorize and read server-side |
| Existing middleware | `authenticate-firebase.js` verifies Bearer identity and stores UID, with no admin-claim authorization in this middleware | New admin operations require explicit authorization; identity verification alone is insufficient |
| Existing routing | Inspected `app.js` has no admin routes | Admin APIs are new work, not endpoints ready for dashboard consumption |
| Account blocking | Inspected mobile `signedIn`/`isOwner` helpers only check authenticated UID | Disabling/revoking Auth does not prove immediate blocking of existing direct Firestore sessions; verify the enforcement window before promising it |

## Confirmed owner direction

- Select approximately 1–2 Firebase Auth accounts by UID and provision the custom claim `admin: true` using trusted server tooling.
- A user-editable Firestore profile role is not an admin authority.
- Keep Premium automatic after verified payment.
- Use existing Firestore data; Next.js can host the admin backend.
- Deadline and hosting budget are not yet constrained.

## Recommended technical boundaries

1. Next.js Node.js Route Handlers own admin authentication/authorization, user inspection, account disable/enable, and read-only order/revenue queries.
2. Next.js verifies Firebase ID tokens, revocation/disabled status, and the admin claim for every admin request.
3. Existing Express retains checkout, payment verification, entitlement updates, and catalog ownership. Add an independently authorized catalog management API for price changes.
4. Introduce a versioned persistent catalog consumed by Express listing and reservation. Select the schema and migration in a shared ADR before implementation. Reservations and catalog changes need a concurrency strategy; fetching a package before the reservation transaction alone cannot guarantee a precise price-cutover boundary.
5. Preserve immutable order snapshots, payment links, and receipts. Clarify mobile price reconfirmation before releasing dynamic prices.
6. Add audit commands and reconciliation for mutations crossing Auth, Express, and Firestore; these systems do not share one atomic transaction.

## Remaining verification

- Confirm this local Express checkout corresponds to the intended deployed backend and authorized Firebase project. Do not read secrets merely to document them.
- Inspect live/staging schema samples through an authorized connection: field completeness, timestamp types, legacy PAID receipts, and profile/Auth inconsistencies.
- Inspect actual indexes, read quotas, dataset size, and hosting limits before choosing raw aggregation or daily aggregates.
- Validate sign-in providers and establish the trusted first-admin provisioning/revocation procedure.
- Specify price limits, revision conflicts, idempotency, audit retention, and mobile behavior in API/ADR documents.
- Do not infer that all PRD proposals are approved from approval of the admin-claim mechanism. Account disable scope, price-only editing, reporting limits, and other draft choices remain subject to PRD review.

## Next documentation deliverables

- `software-architecture.md`: component boundaries and deployment/runtime assumptions.
- `permissions.md`: admin authority, endpoint access, provisioning/revocation, and account blocking semantics.
- `data-model.md`: source fields, proposed catalog/audit schemas, query/index needs, and migration.
- `revenue-definitions.md`: paidAt recognition, date boundaries, validation exclusions, and reconciliation.
- `api-contracts.md`: precise Next.js and Express contracts after schema and catalog design decisions.

Start with architecture and permissions, then resolve catalog/schema details before finalizing API contracts or implementing mutations.
