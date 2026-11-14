# PaddleOCR Receipt Scan Integration — Implementation Plan

> **For agentic workers:** Use the `qskill-executing-plans` skill and complete tasks in order. Read the current files before changing them.
>
> **Goal:** Let a Premium Host photograph or select a receipt, receive a total suggestion from the existing PaddleOCR API, review it, then choose whether to fill the bill form.
>
> **Architecture:** The mobile app uploads the image to the existing Express Premium API. Express authenticates the user, checks Premium entitlement and Host authority, then proxies the image to the deployed PaddleOCR API. OCR results remain suggestions until the Host confirms them.
>
> **Tech Stack:** Expo SDK 58, React Native, Firebase Auth and Firestore Admin, Express 5, existing PaddleOCR FastAPI service.
>
> **Spec:** Decisions in the conversation; existing contracts in `D:\PaddleOCR\scan_service\README.md` and `docs/api-contracts.md`.
>
> **Plan slug:** `2026-11-14-ai-bill-scan-paddleocr` — every commit for this work starts with `[2026-11-14-ai-bill-scan-paddleocr]`.

## Global Constraints

- Keep Firebase on Spark; route OCR through Express and the existing PaddleOCR service.
- Keep the PaddleOCR API key on the server; never include it in the mobile app.
- Do not persist receipt images or raw OCR output in Firestore, SQLite, or logs.
- Require explicit Host confirmation before filling the bill amount; keep the existing preview and publish flow.
- Accept JPEG, PNG, or WEBP images up to 10 MB, matching the current scan service contract.

---

## Task 1: Add an authenticated scan proxy to the Premium API

**Files:**

- Modify: `D:\premium-api\src\app.js`, `src\server.js`, `src\config\env.js`
- Create: `D:\premium-api\src\routes\receipt-scan.js`, `src\services\receiptScanService.js`, `src\repositories\receiptScanRepository.js`
- Test: `D:\premium-api\test\receiptScan.test.js`

**Interface:**

- The app sends `POST /v1/bills/scan?roomId=<roomId>` with a Firebase Bearer token, an image MIME type, and raw image bytes.
- Express calls the configured PaddleOCR `/scan` endpoint using multipart field `image` and the server-only `X-API-Key` header.
- The Express response includes version `1` and the scan service's `status`, `amount`, `suggested_amount`, `currency`, `needs_confirmation`, `evidence`, `warnings`, and `timings_ms` fields.

- [x] Write failing tests for authentication, entitlement, Host authority, image validation, and the OCR proxy.
- [x] Run the focused test and confirm it fails before implementation.
- [x] Add backend configuration for the deployed PaddleOCR scan URL, API key, and a 60-second provider timeout. If scan configuration is absent, leave the rest of the Premium API available and return a sanitized scan-unavailable error.
- [x] Use the existing Firebase authentication middleware to identify the caller. Read the user's Firestore profile and allow the request only when `premiumExpiresAt` is later than server time.
- [x] Read the requested room and caller's membership. Continue only when the caller is the room's current Host, has an active Host membership, and the room is completed with reconciliation finalized.
- [x] Reject an empty body, unsupported MIME type, or image larger than 10 MB before contacting PaddleOCR.
- [x] Forward valid image bytes to the existing service. Do not retry automatically. Do not log the image, API key, or raw OCR response.
- [x] Return sanitized errors: `unauthenticated` (401), `premium-required` or `host-required` (403), invalid image errors (4xx), `ocr-unavailable` (503), or `ocr-timeout` (504).
- [x] Run `npm test` from `D:\premium-api`; 37 tests pass, one existing calendar test fails because its expected catalog differs from the unchanged current Premium catalog, and one integration test is skipped. All 18 receipt-scan tests pass.
- [x] Commit: `[2026-11-14-ai-bill-scan-paddleocr] add authenticated receipt scan proxy`

**Test cases:**

- Missing or invalid token → 401; PaddleOCR is not called.
- Expired or missing Premium entitlement → 403; PaddleOCR is not called.
- Caller is not the room Host, membership is not active, or the room is not finalized → request is rejected; PaddleOCR is not called.
- Unsupported MIME type, empty image, or image over 10 MB → specific client error; PaddleOCR is not called.
- Authorized request → image is forwarded with the expected multipart field and internal API key; response fields are passed through with version `1`.
- PaddleOCR returns busy, times out, or is unreachable → sanitized error; no automatic retry.
- API key and image content never appear in response bodies or logs.

## Task 2: Add the mobile scan API client

**Files:**

- Create: `D:\DontLift-Mobile\dontlift-mobile\src\features\settlement\receipt-scan-api.ts`
- Test: `D:\DontLift-Mobile\dontlift-mobile\__tests__\receipt-scan-api.test.ts`

**Interface:**

- Add a receipt-scan client that accepts the current room ID, local image URI, and MIME type, then returns the validated scan result.
- Reuse `EXPO_PUBLIC_PREMIUM_API_URL`, Firebase Bearer authentication, and the existing `expo-file-system/legacy` upload pattern.

- [x] Write failing tests for authentication, supported MIME types, valid response variants, and API errors.
- [x] Run the focused test and confirm it fails before implementation.
- [x] Upload raw image bytes to the Premium API. Reject unsupported MIME types before network access.
- [x] Validate the version, currency, status, nullable amount fields, confirmation flag, evidence, and warnings. Treat `amount` and `suggested_amount` as suggestions, never as confirmed values.
- [x] If the user changes accounts during upload, discard the result. Do not retry automatically.
- [x] Run the new test (9 passing). `pnpm exec tsc --noEmit` was run; it remains non-zero due to existing errors in unrelated screens/hooks and test typings, with no diagnostics in the new API client.
- [x] Commit: `[2026-11-14-ai-bill-scan-paddleocr] add receipt scan mobile client`

**Test cases:**

- No signed-in user or account changes during upload → return an authentication error and discard any result.
- Unsupported MIME type → reject before making a request.
- Valid response with either amount field populated → parse the suggestion and require confirmation.
- Both amount fields are null → return a valid no-suggestion result.
- Invalid response or HTTP error → return a user-readable error and do not fill the bill amount.

## Task 3: Add capture, selection, and confirmation to the bill screen

**Files:**

- Modify: `D:\DontLift-Mobile\dontlift-mobile\src\features\settlement\components\AiBillScanCard.tsx`, `src\screens\BillAllocationScreen.tsx`, `src\app\index.tsx`, `app.json`
- Test: `D:\DontLift-Mobile\dontlift-mobile\__tests__\receipt-scan-screen.test.tsx`

**Interface:**

- Pass the current room ID, scan action, and Premium presentation state into the bill screen.
- Use the existing `expo-image-picker` dependency to offer camera capture and photo-library selection.
- Add or update Expo permission copy for taking receipt photos and selecting photos, while preserving the existing room QR scanning purpose.

- [x] Write failing UI tests for Host/Premium visibility, picker cancellation, loading, result confirmation, and errors.
- [x] Run the focused test and confirm it fails before implementation.
- [x] Connect the mobile scan client to the bill screen. Members do not see the scan action; non-Premium Hosts see a route to the existing Premium screen.
- [x] Show a busy state during scan and prevent duplicate requests. Cancelling the camera or photo picker makes no request.
- [x] Display the suggested VND amount with its evidence label and any warnings. Do not display a rule score as a probability.
- [x] If the Host confirms a valid suggestion of at least 1,000 VND, fill the existing bill input. If the Host rejects it, the scan fails, or no suggestion exists, preserve the current input and keep manual entry available.
- [x] Keep the existing bill preview and Publish action as the only path to publishing.
- [x] If the selected image is HEIC or another unsupported format, show an actionable format message and do not upload it.
- [x] Run the screen and scan API tests (26 passing). `pnpm exec tsc --noEmit` was run; it remains non-zero due to existing unrelated TypeScript errors, with no diagnostics in the receipt-scan screen/client files.
- [x] Commit: `[2026-11-14-ai-bill-scan-paddleocr] connect receipt review flow`

**Test cases:**

- Member → no scan action.
- Non-Premium Host → scan action is unavailable and Premium navigation is offered.
- Premium Host captures or selects a supported image → loading appears; the bill input remains unchanged until confirmation.
- Host confirms a valid suggestion → bill input and preview update; bill is not published.
- Host rejects the suggestion or cancels image selection → existing bill input is unchanged.
- No suggested total, unsupported image, offline state, OCR busy response, or timeout → appropriate message; manual entry remains available.

## Task 4: Document the contract and verify the integrated flow

**Files:**

- Modify: `D:\DontLift-Mobile\dontlift-mobile\docs\api-contracts.md`, `docs\product-requirements.md`, `docs\feature-specification.md`
- Modify: `D:\premium-api\README.md`

- [x] Document the mobile-to-Express request and response, the Express-to-PaddleOCR forwarding contract, entitlement and Host checks, image limits, timeout, and error behavior.
- [x] Update product scope to explicitly allow receipt OCR for Host bill entry, while keeping camera-based detection, AI coaching, and AI-generated penalties excluded.
- [x] Document the required backend configuration names and state that the PaddleOCR API key is server-only. Do not record secret values.
- [x] Run `npm test` from `D:\premium-api`; run the focused mobile tests and `pnpm exec tsc --noEmit` from `D:\DontLift-Mobile\dontlift-mobile`. Results and the unrelated failures are recorded in Tasks 1–3 above.
- [ ] Verify on Android and iOS: capture, library selection, unsupported format, unclear/no total, expired Premium, busy OCR service, and confirm/reject behavior. No Android/iOS device is attached to this environment; device verification remains outstanding.
- [x] Commit documentation in the relevant repository with subject `[2026-11-14-ai-bill-scan-paddleocr] document receipt scan contract`.

## Assumptions

- The deployed PaddleOCR service keeps the existing `/scan` route, multipart field `image`, `X-API-Key` authentication, and response described in `D:\PaddleOCR\scan_service\README.md`; this plan does not modify the PaddleOCR service or model.
- The PaddleOCR endpoint URL and API key will be configured in the Premium API environment, not committed to the app or repository.
- The server checks `premiumExpiresAt` as the entitlement authority; a client-side Premium flag is only for presentation.
- Version 1 supports JPEG, PNG, and WEBP only. HEIC conversion is out of scope.
