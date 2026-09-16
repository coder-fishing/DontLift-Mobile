# Decision Packet — Concept Final

> **Status:** APPROVED & LOCKED FOR P4.4 EXECUTION  
> **Source Artifact:** `prompts/critique-and-select.prompt.md` (P4.3)  
> **Target Concept:** `design/concepts/concept-final/` (Liquid Acrylic / Real Frosted Glass)  
> **Human Approval:** Received — All 6 findings accepted.  

---

## 1. Summary

The **Liquid Acrylic (Real Frosted Glass)** design concept (`concept-final`) demonstrates exceptional fidelity to the DontLift core purpose, domain vocabulary, visual principles, and offline-first technical constraints. Translucent glass panels (`rgba(255, 255, 255, 0.35)` base fill, `blur(40px)` backdrop filter, specular top highlights) paired with strict slate typography (`#0F172A`) achieve strong visual hierarchy and high legibility without high-dopamine clutter.

All 5 strict exclusions (No Kiosk Mode, No In-App Wallet, No In-App Chat, No AI Assistant, No Auto Bank Verification) are strictly preserved. The audit identified 6 findings, primarily around pruning deferred Post-MVP feature stubs (Social Auth buttons, Password Reset link) from the login template and enforcing proper accessibility and performance fallbacks during React Native component construction in P4.4.

---

## 2. Prioritized Findings

| # | Evidence | Impact | Target | Smallest Correction | Status |
|---|----------|--------|--------|---------------------|--------|
| **F-01** | `01-login.html` (lines 268–287) renders Apple & Google Social Sign-In buttons. `primary-cta.md` & `secondary-cta.md` mention Google sign-in. | Violates PRD Sec 13, Feature Spec Sec 1.2, and Design Brief Sec 2.4 (Social login explicitly deferred to Post-MVP v1.1). | `01-login.html`, component docs (`primary-cta.md`, `secondary-cta.md`) | Omit Apple and Google social login buttons and divider from `01-login.html` during P4.4 component implementation. | **ACCEPTED** |
| **F-02** | `01-login.html` (line 232) renders `<a href="#">Forgot?</a>` password recovery link. | Violates PRD Sec 13, Feature Spec Sec 1.2, and Design Brief Sec 2.4 (Password reset email flow excluded for MVP). | `01-login.html` (line 232) | Remove the "Forgot?" password recovery link from the login form during P4.4 implementation. | **ACCEPTED** |
| **F-03** | `design-system.md` (Sec 7, line 124) notes `Empty State component: not detected — needs verification`. Design Brief Sec 9 defines 4 explicit empty state strings. | Potential UI inconsistency when lists or history views contain 0 items before user activity. | `design-system.md`, P4.4 component library | Implement a reusable `empty-state.tsx` glass card component in P4.4 adhering to Design Brief Section 9 strings. | **ACCEPTED** |
| **F-04** | `design-system.md` (Sec 3) & `rationale.md` (Sec 5) specify `blur(40px)` multi-layer backdrop blurs, noting GPU framerate risk on low-end mobile webviews/devices. | Potential framerate degradation during active 50Hz motion detection on lower-tier hardware. | React Native styling layer (P4.4 Expo Blur / NativeWind) | Enforce solid fallback opacity (`rgba(255,255,255,0.95)` without blur shader) on lower-end devices or low-power mode. | **ACCEPTED** |
| **F-05** | `04-solo-summary.html` (lines 49-50) & `01-login.html` rely on CSS `animate-pulse` for ambient background blooms without media query wrapping. | Users with OS reduced motion preferences enabled may experience discomfort from continuous background pulses. | P4.4 animation layer / global styles | Enforce `@media (prefers-reduced-motion: no-preference)` / `AccessibilityInfo.isReduceMotionEnabled` check. | **ACCEPTED** |
| **F-06** | Design Brief Sec 8.4 mandates Host controls ("Start Session", "End Session", "Approve/Deny Exit", "Enter Bill", "Override Shares") must be unrendered (not just disabled) for Members. | Security & clarity guarantee — prevents Member confusion or unauthorized state manipulation attempts. | `05-group-lobby.html`, `06-group-active.html`, `07-host-bill-allocation.html` | Enforce strict conditional rendering (`role === 'host' && ...`) in P4.4 React Native components. | **ACCEPTED** |

---

## 3. Validation Checklist

- [x] **Interaction contract preserved:** All session lifecycle transitions (`CREATED → WAITING → ACTIVE → COMPLETED / CANCELLED / ABORTED`) correctly represented across screens.
- [x] **UX states covered:** Active focus, 3-second grace period, violation logging, lobby waiting, member early exit, early termination vote, host bill allocation, VietQR settlement, activation code entry, and hardware diagnostics error covered.
- [x] **Accessibility checked:** Slate text `#0F172A` on 35%+ translucent white glass meets WCAG AA contrast ratio (≥ 4.5:1). Status dots paired with explicit text strings. Minimum 44pt touch targets enforced.
- [x] **Responsive checked:** Layouts designed for mobile-first viewports (≤ 375px width).
- [x] **Design system consistent:** Uniform color palette, typography scale (`JetBrains Mono` for timers/monetary data, `Plus Jakarta Sans` for body/headings), 24px panel radii, and 16px input radii applied consistently.
- [x] **Strict exclusions preserved:** No Kiosk Mode, No In-App Wallet, No In-App Chat, No AI Assistant, No automatic bank verification.
- [x] **Domain vocabulary used correctly:** `Solo Focus Mode`, `Group Room Mode`, `3-Second Grace Period`, `Phone-Down Detection`, `Violation Log`, `Offline-First SQLite Reconciliation`, `VietQR P2P`, `Penalty Leaderboard`, `Host`, `Member` used accurately.
- [x] **Anti-slop review complete:** Glass visual language reflects tactile physical phone-down gesture; cards serve explicit structural roles; no decorative clutter or fake AI features.
- [x] **No unsupported features:** Deferred social auth (Google/Apple) and password reset stubs identified for removal before P4.4 code construction.

---

## 4. Recommended Direction

- **Recommended:** Concept Final (`design/concepts/concept-final/`)
- **Rationale:** The Liquid Acrylic concept offers a serene, tactile visual experience that perfectly fits digital mindfulness and phone-down focus. Its glassmorphism tokens, JetBrains Mono timer readability, non-custodial VietQR display, and offline-first status telemetry provide an ideal foundation for React Native implementation.
- **Risks:**
  1. Multi-layered backdrop blurs may cause GPU frame drops on low-end Android devices (mitigated by opaque solid fallbacks).
  2. Deferred MVP stubs (Social Login, Password Reset) present in prototype HTML files must be pruned during P4.4 component extraction.
- **Open Questions:** None. All domain rules, math formulas, and state machines are fully resolved in PRD v1.6.0 and Feature Spec v1.1.0.

---

## 5. Human Review Required

Human review is **COMPLETE**. The human partner approved the decision packet and accepted all 6 findings on 2026-09-16.

- [x] Decision packet accepted and saved to `design/concepts/concept-final/decision-packet.md`
- [x] Design record locked for P4.4 execution
