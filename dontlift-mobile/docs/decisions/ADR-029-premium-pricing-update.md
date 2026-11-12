# ADR-029 — Premium Package Pricing Update

## Status

Accepted — human-approved package schedule on 2026-11-08. The user stated that the external Express server catalog has been updated; its source and live response were not available in this workspace for independent verification.

## Decision

Replace the Premium package price and month schedule from ADR-025 with:

| Package ID | Price (VND) | Paid months | Granted months |
|---|---:|---:|---:|
| `MONTH_1` | 30,000 | 1 | 1 |
| `MONTH_3` | 79,000 | 3 | 4 |
| `MONTH_6` | 149,000 | 6 | 8 |
| `MONTH_12` | 249,000 | 12 | 16 |

The difference between paid and granted months is the included bonus duration. The Premium API remains authoritative for package data, order amounts, and entitlement grants. The client sends package identity and request identity only; it must not provide a trusted amount.

All other ADR-025 decisions remain in force: purchases use the existing payOS and Express flow, payment is one-time with no automatic renewal, entitlement is server-owned and time-limited, and Firebase remains on Spark. Package IDs and the version-1 API request shape remain unchanged.

## Consequences

- The backend catalog must contain the exact schedule above before the updated app is used for purchases. The user reports that this server update is complete; this workspace cannot independently verify it.
- The mobile display fallback must match the schedule but must not authorize checkout when the live server catalog is unavailable.
- Active product and API documentation must point to this ADR for package values. ADR-025 and the October 2026 design/spec/plan remain historical records; this decision supersedes their package values only.
- Historical orders retain their server-recorded amount and granted duration; the update must not reinterpret existing receipts.

## Sources

- Human-approved pricing reference: `design/references/screenshots/14-premium-pricing-redesign.png`
- Premium plan redesign: `docs/superpowers/plans/2026-11-08-premium-pricing-redesign.md`
- Existing payment architecture: `ADR-025-payos-expiring-premium.md`
