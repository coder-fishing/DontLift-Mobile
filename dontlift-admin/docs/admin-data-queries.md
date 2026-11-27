# Admin Data Queries

Status: implementation proposal based on local mobile and Express source inspection. The deployed Firestore schema, index state, record counts, and read budget have not been verified.

## Read sources

- `users/{uid}` profile snapshots supply display name, email, creation time, and Premium expiry.
- Firebase Auth supplies enabled/disabled status and exact email lookup.
- `premiumOrders/{orderCode}` supplies order history and immutable amount/package snapshots.
- Revenue includes only `PAID` orders with a valid receipt, a server `paidAt` timestamp, positive integer `amountVnd`, `paymentLinkId`, `grantedExpiresAt`, UID, and package ID.

Every browser data request goes through a Next.js Route Handler that re-verifies the Firebase ID token, revocation state, enabled status, project, and `admin: true` claim before reading Firestore or Firebase Auth. Responses are private and non-cacheable. The browser does not access admin collections directly.

## Query limits and behavior

- User listing defaults to 25 profiles and caps at 100. It uses `createdAt` descending with document ID as a stable tie-breaker. Profile counts are not represented as Firebase Auth account counts.
- User search is exact UID or exact Auth email. Fuzzy search is not implemented.
- Order listing caps at 100 records per page. Search by UID/code is exact. The list is read-only.
- Revenue dates include both selected calendar dates in `Asia/Ho_Chi_Minh`; the Firestore upper bound is the start of the following local day. Requests longer than 90 days are rejected.
- Revenue uses the stored order amount and package ID, never the current catalog. Rows with an in-range `paidAt` and incomplete receipt fields are excluded and counted for review.
- PAID orders with no `paidAt` cannot be assigned to a date range and are not included in that range. The dashboard does not scan the entire historical collection to discover all such records.
- Overview profile and Premium counts are current snapshots. Revenue and paid-order count follow the selected date range. Refresh metadata explains when these values were read; separate Firebase queries are not a transactionally consistent snapshot.
- The report currently scans matching paid-date orders in bounded 500-row pages and stops with a dependency error above 20,000 matching documents. This is a temporary safety ceiling, not a tested capacity or a committed performance target; verify dataset volume/read cost and add a designed aggregate if necessary.

## Composite indexes

`firestore.indexes.json` lists composite indexes used by order filters. This file is not deployed by the admin application. Before relying on combined order filters in a shared environment, compare the definitions with existing project indexes and deploy only the required missing indexes through the approved Firebase project workflow. Do not deploy indexes from local admin startup.

## Open verification

1. Confirm that the deployed admin credentials and mobile app target the same intended Firebase project/database.
2. Inspect representative legacy records for timestamp type/completeness and order receipt fields.
3. Check current Firestore indexes, historical record counts, aggregation read cost, quotas, and hosting request limits.
4. Reconcile the revenue calculations against an explicitly approved dataset before production use.
