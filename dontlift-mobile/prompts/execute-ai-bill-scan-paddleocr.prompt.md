# P3.9 — Implement PaddleOCR Receipt Scan

> **Role:** PRIMARY / Senior React Native and Node.js Backend Engineer\
> **Skills:** `$qskill-executing-plans`, `$react-native-expert`, `$firebase-auth-basics`, `$qskill-systematic-debugging` (when an unexpected failure occurs), `$qskill-review-code` (final review against the plan)\
> **Interaction mode:** approved-plan execution with explicit scope and access gates\
> **Output mode:** implemented and verified changes, followed by an evidence-based completion report\
> **Approval gate:** Do not edit application or backend source until the user explicitly approves the implementation plan. Do not commit, push, deploy, change live secrets, or publish releases without separate explicit authorization.\
> **Canonical output:** `docs/superpowers/plans/2026-11-14-ai-bill-scan-paddleocr.md` and its scoped mobile/API changes\
> **Run context:** Mobile repository at `D:\DontLift-Mobile\dontlift-mobile`; Premium API at `D:\premium-api`; PaddleOCR service at `D:\PaddleOCR` is read-only integration context.

---

## 1. When to Use

Use this prompt to implement the approved AI receipt-scan plan for the Host bill-allocation flow. The mobile app must send receipt images through the authenticated Premium API to the existing PaddleOCR `/scan` service, then let the Host review the suggested VND total before applying it to the existing bill form.

This prompt does not authorize new OCR models, a new OCR service, automatic bill publication, or changes to unrelated bill allocation and payment behavior. The existing PaddleOCR service is an external dependency; integrate its documented contract instead of changing its model or implementation.

---

## 2. Inputs

Read these sources before implementation:

- **Repository instructions:** `D:\DontLift-Mobile\dontlift-mobile\AGENTS.md`, any nested `AGENTS.md`, and any instructions present in `D:\premium-api`.
- **Implementation plan:** `D:\DontLift-Mobile\dontlift-mobile\docs\superpowers\plans\2026-11-14-ai-bill-scan-paddleocr.md`.
- **Mobile implementation:** `src\features\settlement\components\AiBillScanCard.tsx`, `src\screens\BillAllocationScreen.tsx`, `src\app\index.tsx`, `app.json`, Premium and avatar API clients, and their focused tests.
- **Backend implementation:** `D:\premium-api\src\app.js`, `src\server.js`, Firebase authentication middleware/provider, environment configuration, profile/Firestore repositories, and `test\` conventions.
- **PaddleOCR contract:** `D:\PaddleOCR\scan_service\README.md` and `D:\PaddleOCR\scan_service\main.py`. Confirm the deployed service URL is configured without printing or exposing secret values. Do not edit this repository as part of this feature.
- **Product and settlement contracts:** `docs\product-requirements.md`, `docs\feature-specification.md`, `docs\api-contracts.md`, `docs\software-architecture.md`, ADR-021, ADR-022, and ADR-025.
- **Newer user decisions** and current Git status in both writable repositories.

If the implementation plan has not been explicitly approved, stop before source edits and request that approval. If the current environment cannot write to `D:\premium-api`, stop before making dependent mobile changes and report the blocked path; do not request elevated filesystem access or create partial integration code.

---

## 3. Task

Use `$qskill-executing-plans` to execute the approved plan task-by-task and in order:

1. Add the authenticated Premium API scan proxy. Validate Firebase identity, server-side `premiumExpiresAt`, current Host membership, and finalized room state before forwarding the image. Keep the PaddleOCR API key server-side. Enforce the documented JPEG/PNG/WEBP and 10 MB limits. Use the plan's sanitized errors and timeout behavior.
2. Add the mobile scan API client using the existing Premium API origin and authenticated upload conventions. Validate the versioned response and discard results if the signed-in account changes during the request.
3. Connect camera capture and photo-library selection to the Host bill form using the installed Expo image-picker. Update camera/photo permission copy in `app.json`. Keep Members out of the scan flow; show a Premium route for non-Premium Hosts.
4. Display the suggested VND total with its evidence and warnings. Require explicit Host confirmation before filling the existing bill input. Preserve manual entry, the minimum 1,000 VND rule, preview, and existing publish flow. Never publish from the scan action.
5. Update the mobile API/product documentation and Premium API README. Add the focused tests and run the plan's verification commands.

### Required behavior

- A missing or expired Premium entitlement, a non-Host caller, an inactive Host membership, or a room that is not completed and finalized must prevent PaddleOCR from being called.
- An unsupported, empty, or oversized image must fail before OCR processing. HEIC conversion is out of scope; explain the supported formats to the user.
- OCR `amount` and `suggested_amount` are proposals. A null result keeps manual entry available and leaves the existing amount unchanged.
- Cancellation, upload failure, timeout, offline state, and OCR-busy responses must not change the bill amount or trigger an automatic retry.
- The PaddleOCR endpoint URL and API key belong only in Premium API server configuration. Never place them in Expo public configuration, logs, or responses.
- Do not store receipt bytes or raw OCR text in app persistence, Firestore, SQLite, analytics, or logs.

---

## 4. Constraints & Source Precedence

**Source precedence:**

1. Newer explicit user decisions.
2. Explicitly approved implementation plan.
3. Current Firebase, settlement, Premium, product, and API contracts, including accepted ADRs.
4. Current source and tests in each repository.
5. This prompt's implementation guidance.
6. AI inference; if an unresolved choice affects security, entitlement, privacy, or bill authority, stop and ask instead of guessing.

**Rules:**

- Keep Firebase on Spark. Use Express and the existing PaddleOCR API; do not add Cloud Functions or a new OCR provider.
- Treat `premiumExpiresAt` checked by the backend as entitlement authority. Never trust a client Premium flag for access control.
- Keep Host and finalized-room validation on the backend, not only in the UI.
- Do not send the image directly from the app to PaddleOCR or expose `X-API-Key` to the client.
- Do not alter OCR models, extraction rules, database schema, Firestore Rules, bill publication, or payment behavior beyond the approved plan.
- Do not add dependencies unless required by the plan and not already available in the relevant package.
- Preserve pre-existing working-tree changes. Do not reset, stage, or overwrite unrelated user changes.
- Do not commit, push, deploy, change live secrets, or publish releases without separate explicit authorization, even if a plan task lists a commit step.
- Do not spawn sub-agents unless the user explicitly requests delegation.

---

## 5. Expected Output

After implementation and verification, report:

- The behavior implemented and the affected mobile and backend files.
- Exact mobile and backend tests, TypeScript checks, and other commands run, with results.
- Whether the deployed PaddleOCR API contract and configuration were verified without exposing secrets.
- Any iOS/Android device checks that were actually performed; mark unavailable device checks as unverified.
- Any blocked paths, deployment configuration needed, or remaining risks.
- Confirmation that no commit, push, deployment, live-secret change, or release occurred unless separately authorized.

Do not claim the feature is complete if the Premium API cannot reach the configured PaddleOCR service or if a required authorization check is unverified.

---

## 6. Save or Update

- Follow `docs\superpowers\plans\2026-11-14-ai-bill-scan-paddleocr.md`; keep its scope and task order as the implementation source of truth.
- Mobile changes belong in `D:\DontLift-Mobile\dontlift-mobile` and backend changes belong in `D:\premium-api`.
- Treat `D:\PaddleOCR` as read-only. Do not edit or deploy that service under this prompt.
- Update `docs\api-contracts.md`, `docs\product-requirements.md`, `docs\feature-specification.md`, and `D:\premium-api\README.md` as listed in the plan.
- Do not edit unrelated screens, services, documentation, or Firebase Rules.
- Leave all changes uncommitted unless the user separately authorizes commits.

---

## 7. Human Review Required

Before implementation, the user must explicitly approve the canonical implementation plan. If that approval is not present in the active conversation, stop and ask for it.

At completion, the user reviews the changed-file summary, test/check results, and any deployment or physical-device limitations. Live deployment and secret configuration require separate authorization.

---

## 8. Validation Checklist

- [ ] The plan was explicitly approved before source edits.
- [ ] Only an authenticated Premium Host for a completed, finalized room can invoke OCR.
- [ ] Invalid, unsupported, empty, and over-limit images do not reach PaddleOCR.
- [ ] The server proxies the image using the existing PaddleOCR API contract; no API key is exposed to the mobile app.
- [ ] Scan results are suggestions and require Host confirmation before changing the bill input.
- [ ] Cancellation, offline/error states, null suggestions, and OCR-busy responses preserve manual entry and existing bill state.
- [ ] Receipt images and raw OCR output are not persisted or logged.
- [ ] Existing bill preview, publication, override, and payment behavior remains intact.
- [ ] Focused backend/mobile tests and TypeScript checks have actual recorded results.
- [ ] Android/iOS verification is reported only for platforms actually tested.
- [ ] No unrelated changes, commit, push, deployment, live-secret update, or release occurred without authorization.

---

## Execution Command

```text
Use `prompts/execute-ai-bill-scan-paddleocr.prompt.md`. First confirm explicit approval of the canonical plan and write access to both implementation repositories. Then execute the plan in order, using its contracts and acceptance cases. Stop on an approval, permissions, security, or API-contract blocker; do not invent behavior or deploy.
```
