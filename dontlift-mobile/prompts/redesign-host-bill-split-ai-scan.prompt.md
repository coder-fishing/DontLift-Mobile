# [P3.8] — Host Bill Split Redesign with AI Receipt Scan

> **Role:** PRIMARY / Senior Mobile UI/UX Designer and React Native Engineer  
> **Skills:** `$ui-ux-pro-max`, `$antislop`, `$react-native-expert`, `$brainstorming`, `$qskill-writing-plans`, `$qskill-review-code`  
> **Interaction mode:** implement-approved-visual-direction; contract-gated for new AI or bill-publication behavior  
> **Output mode:** prompt-driven implementation → focused review and validation  
> **Antislop mode:** DURING — apply throughout; do not ask again.  
> **Approval gate:** The visual direction and the request for a separate AI bill-scan component are approved. Do not change backend/API, Firestore, or initial bill-publication contracts without reporting the gap and receiving approval. Do not commit or deploy.  
> **Canonical output:** `src/screens/BillAllocationScreen.tsx`, `src/features/settlement/components/AiBillScanCard.tsx`, and the smallest justified API/test files  
> **Run context:** DontLift mobile repository root: `D:\DontLift-Mobile\dontlift-mobile`; inspect current source, local changes, and project instructions before editing.

---

## 1. When to Use

Use this prompt to redesign the Host's initial Group bill-splitting screen and add an AI receipt-scan entry point. The approved reference shows a restrained Liquid Acrylic treatment consistent with DontLift: the existing app shell remains, a single form surface contains AI scan, bill total, split method, and member share preview, and one strong primary action publishes shares. The AI scan interaction must be extracted into its own focused component.

The reference illustrates the intended hierarchy and is not a source of real prices, shares, member data, or API behavior.

---

## 2. Inputs

Read these sources before implementation:

- **Repository rules:** `AGENTS.md` and any nested `AGENTS.md` files.
- **Approved visual reference:** `design/references/screenshots/17-host-bill-split-ai-scan-redesign.png`.
- **Current screen and navigation/callback wiring:** `src/screens/BillAllocationScreen.tsx`, its tests, and its caller in `src/app/index.tsx`.
- **Existing bill math and command contracts:** `src/features/settlement/bill-allocation.ts`, `src/features/settlement/bill-repository.ts`, `docs/decisions/ADR-021-spark-default-bill.md`, `docs/decisions/ADR-022-spark-bill-overrides.md`, and the bill sections of `docs/api-contracts.md`.
- **Product and visual system:** `docs/product-requirements.md`, `docs/product-design.md`, `design/concepts/concept-final/decision-packet.md`, `src/constants/theme.ts`, and existing `GlassCard` / `PrimaryButton` usage.
- **AI API contract:** `src/features/premium/premium-api.ts`, any API contract documentation, and the `D:\premium-api` route/controller/service implementation and README. Verify an actual authenticated receipt-scan endpoint, request encoding, image limits, response schema, entitlement policy, and retention behavior. Do not infer these from the API base URL or from the avatar-upload endpoint.
- **Any newer human-approved decisions** in the current conversation.

Read current git status first. Preserve unrelated user changes; do not reset, stage, or overwrite them.

---

## 3. Task

Use the listed skills to implement the approved screen direction with narrow scope:

1. **Inspect before changing.** Trace Host and member modes, initial bill publication, preview calculation, existing post-publication overrides, online/error/loading states, and current tests. Reuse shared components and theme tokens. Keep the member view and published-bill flow intact.
2. **Redesign the initial Host bill form** to follow the reference's hierarchy:
   - Keep the current DontLift header, background, and bottom navigation unchanged.
   - Use one restrained glass form surface with clear section spacing/dividers; avoid glass cards nested inside glass cards, decorative glows, fake AI badges, or sample member data.
   - Order content as `AI bill scan` → `Bill total` → `Split method` → member share preview → one primary `Publish shares` action.
   - Keep manual bill-total entry available and preserve the minimum 1,000 VND validation.
   - Use actual members and actual calculated values. The reference's 450,000 VND and 55/45 shares are illustrative only.
3. **Extract a focused AI scan component** at `src/features/settlement/components/AiBillScanCard.tsx` (adjust to the repository's established component convention if inspection shows a better existing location). It should own the scan-specific presentation and interaction states, while the screen owns bill form state and decides when a reviewed amount is applied. Define a typed, minimal prop contract; do not move bill publication or repository logic into the component.
4. **Implement receipt selection and scan only against a verified API contract.** Reuse installed Expo APIs (`expo-image-picker`, `expo-camera`, and/or `expo-file-system`) and the existing authenticated Premium API client where applicable. Ask for camera permission only after a camera action. Support cancellation, denied permission, invalid image/type/size, offline state, upload/scanning, successful parse, and retryable/permanent error states. Show a scan result as a proposed total for the Host to review and apply; never publish a bill automatically. Do not log receipt contents, image bytes, or personal payment details.
5. **Provide the split-method choice** shown in the reference (`Room score` and `Custom %`) only where the existing contracts support it. For custom percentages, validate a complete allocation totaling exactly 100%, preview integer VND amounts, prevent negative/over-total shares, and keep rounding deterministic. Continue using the existing default calculation for `Room score`.
6. **Preserve publication safety.** Keep publication confirmation, online checks, idempotency, loading/error behavior, and the existing one-time/override lock rules. A preview must match the exact shares that will be written; do not silently fall back from custom allocation to score-based allocation.
7. **Keep mobile layout accessible and robust.** Use existing semantic colors, minimum 44 dp touch targets, labels/hints, keyboard avoidance, scroll padding above bottom navigation, and safe-area behavior. Check narrow widths, long member names, and error text on both platforms.
8. **Validate and report.** Add/update focused tests for the new component, picker/scan states, split preview/validation, and unchanged publication behavior. Run relevant checks from `AGENTS.md`, and report exactly what was run; do not claim device validation without an actual iOS/Android check.

### Required contract checkpoints

- The current mobile client exposes `onPublish(totalBillVnd)`, which publishes the existing score-based initial split. ADR-022 describes versioned overrides after a bill exists. Do not implement custom initial percentages by publishing a score split and immediately issuing a second override; that creates a transient wrong bill and changes observable behavior. If custom percentages cannot be included in one valid initial publication under the current contract, stop before changing persistence/server/rules and report the minimum required contract decision.
- Verify whether a receipt-scan endpoint actually exists. If it does not, do not invent a route, payload, model/provider, confidence field, image retention policy, or entitlement rule. Stop before wiring a fake network call, report the missing contract, and specify the smallest API decision needed to proceed. You may complete independently safe screen/component work only if it cannot falsely claim scanning is available; clearly label the scan action unavailable until the approved API exists.

---

## 4. Constraints & Source Precedence

**Source precedence:**

1. Newest explicit human-approved decisions in the conversation.
2. Approved ADR-021 / ADR-022 and current settlement contracts.
3. `AGENTS.md`, architecture/product/API documentation, and existing code behavior.
4. `design/references/screenshots/17-host-bill-split-ai-scan-redesign.png` as visual hierarchy guidance.
5. AI recommendations.

**Rules:**

- No new dependency unless the required feature cannot be implemented with installed packages; justify it before changing manifests.
- Do not change settlement schema, Firestore Rules, bill repository signatures, share authority, payment flow, or server behavior without a separate explicit approval.
- Do not invent or imply that an AI scan succeeded when no verified service response exists. Manual entry remains fully usable.
- Do not upload a receipt to Cloudinary or reuse the avatar endpoint. Receipt images are distinct sensitive data and require an explicitly documented scan contract and retention policy.
- Do not introduce secrets, API keys, raw sensitive data logging, or client-side AI provider credentials.
- Do not modify global header, background, bottom navigation, or unrelated screens.
- Reuse existing components and semantic tokens. Avoid raw color literals and one-off abstractions beyond the explicitly requested scan component.
- Keep the same user-facing English style as the existing Group screens.
- Do not commit, deploy, or modify unrelated working-tree changes.

---

## 5. Expected Output

Deliver:

- The redesigned Host bill form following the approved reference, using real screen data.
- A separate, typed `AiBillScanCard` component with honest loading, success, unavailable, and error behavior appropriate to the verified service contract.
- A review-before-apply flow for recognized bill totals; manual entry remains available.
- A correct split-method and share preview only to the extent authorized by existing initial-publication contracts.
- Focused tests and a concise report listing changed files, behavior, checks actually run, physical device checks available, and any API/data-contract blocker.

If a required contract is missing, report the blocker and the exact human decision needed. Do not call the feature complete while scan or custom initial publication is only a visual mock.

---

## 6. Save or Update

- Implement in `src/screens/BillAllocationScreen.tsx` and the focused scan component under `src/features/settlement/components/` (or the repository's established equivalent).
- Add or update only the minimal API client, tests, and documentation files justified by a verified approved contract.
- If the API endpoint or initial custom-publication contract is absent, do not alter backend contracts as part of this prompt. Return the proposed contract delta for human approval.
- Do not edit the global shell or unrelated screens. Preserve all pre-existing working-tree changes.
- Do not commit or deploy.

---

## 7. Human Review Required

Review the implementation for:

- Whether the Host can distinguish score-based from custom split and review the exact final member amounts.
- Whether every custom percentage allocation totals 100% and displayed VND shares sum exactly to the entered bill total.
- Whether an AI-read amount is clearly a suggestion and requires Host review before applying.
- Whether permission denial, picker cancellation, offline operation, unsupported image, upload failure, parse failure, and retry are understandable and recoverable.
- Whether the verified API contract limits image type/size, specifies retention/deletion, authenticates the caller, and defines the entitlement policy.
- Whether the bill screen retains the DontLift style without excess glass, nested cards, decorative gradients, or competing primary buttons.
- Any proposed server, schema, billing, privacy, Rules, or data-retention change; these require a separate approval before implementation.

---

## 8. Validation Checklist

- [ ] The Host screen matches the approved content order and leaves header/navigation unchanged.
- [ ] AI scan UI is a separate, typed component with an explicit boundary from bill publication.
- [ ] Camera permission is requested only after the user chooses camera; library cancellation is harmless.
- [ ] No scan request is sent to an unverified or fabricated endpoint.
- [ ] A recognized amount is reviewed before it changes the bill-total field; manual typing remains supported.
- [ ] Scan loading/error/retry/unavailable states have accessible, non-misleading feedback.
- [ ] Room-score and custom-percent previews use actual members and deterministic VND rounding.
- [ ] A custom split cannot publish unless its complete values satisfy the approved contract and exact total.
- [ ] Existing confirmation, online gating, payment/member mode, bill override locking, and error behavior remain intact.
- [ ] No receipt image/bytes or payment data are persisted/logged beyond an approved contract.
- [ ] No unapproved API, Firestore, data-retention, or entitlement change was introduced.
- [ ] Relevant tests/type-check/lint were run and reported truthfully; iOS/Android checks are marked only if actually performed.
- [ ] No commit, deploy, dependency change, or unrelated UI edit occurred.

---

## Execution Command

```text
Read `prompts/redesign-host-bill-split-ai-scan.prompt.md` and implement its approved UI direction in the Host bill-splitting flow. First inspect the app and Premium API for actual receipt-scan and initial custom-publication contracts. Reuse the current theme and components, extract AI scanning into a focused component, preserve existing settlement/payment behavior, and apply antislop DURING implementation. Do not invent missing API contracts or simulate custom publication with multiple writes. If either contract is missing, complete only independent safe UI work and report the exact approval needed. Do not commit or deploy.
```
