# P4.1 — Create the Product Design Brief (DontLift)

> - **Role:** PRIMARY
> - **Skills:** `$brainstorming` (required: clarify experience trade-offs), `$ui-ux-pro-max` (required: generate design system foundations), `$react-native-expert` (supporting: make states and accessibility concrete)
> - **Interaction mode:** plan-then-approve
> - **Output mode:** interactive draft → approved artifact
> - **Approval gate:** approve the interaction contract before saving
> - **Canonical output:** `../docs/product-design-brief.md`
> - **Sample correspondence:** [product-design-brief.md](../docs/product-design-brief.md)
> - **Run context:** fresh session; attach or provide every input below.

---

## Use this when

Accepted product behavior exists (PRD + Feature Spec from Chapter 3) and you need a reviewable design contract before exploring visual directions.

---

## Inputs

- Product requirements: [product-requirements.md](../docs/product-requirements.md)
- Feature specification: [feature-specification.md](../docs/feature-specification.md)
- Project context: [project-context.md](../docs/project-context.md)
- Human visual references, material references, and directly inspected interaction patterns.
- Any newer human-approved design decisions.

**Reference direction:** Frosted Glass / Liquid Pearl is a **reference direction**, NOT a target. Developers must research additional references (modern landing pages, Pinterest, Dribbble).

If a named visual reference cannot be inspected, report the gap and ask for a usable file, URL, or description.

---

## Task

Use `$brainstorm` to challenge the DontLift user journey before choosing visual treatment. Draft a design brief covering:

### 1. User Struggle
- Phone distraction during focus sessions and social hangouts
- No lightweight, gamified accountability mechanism
- Fair bill splitting without invasive OS-level control

### 2. Auth Flow
- Registration (Email/Password, Firebase Auth)
- Login (Email/Password)
- Token storage (Expo SecureStore)
- Social Login deferred to Post-MVP v1.1 (Google, Facebook, Apple)

### 3. Solo Focus Mode
- Countdown Timer (duration selection)
- Open-ended Stopwatch
- Phone-Down Detection (accelerometer)
- 3-Second Grace Period
- Violation Log (local SQLite + Firestore sync)
- Session Summary (duration, lift count, violation duration, Penalty Score)

### 4. Group Room Mode
- Create Room (Host: 4-digit PIN + QR code)
- Join Room (Member: PIN or QR)
- Lobby (real-time participant list)
- Active Session (motion detection for all participants)
- Penalty Leaderboard (real-time, ascending score)
- Early Exit (Member request → Host approve/deny)
- Early Termination Vote (100% consensus, 30s timeout)
- Host End Session (freeze scores, navigate to Bill Settlement)

### 5. Lifecycle States
- `CREATED → WAITING → ACTIVE → COMPLETED`
- `ACTIVE → CANCELLED` (early termination)
- `ACTIVE → ABORTED` (network crash recovery)

### 6. Bill Settlement
- Total Bill Input (Host, positive integer VND ≥ 1,000)
- Hybrid Bill Allocation (automated penalty-weighted + Host override)
- Deterministic 1,000 VND rounding
- VietQR Generation (NAPAS-compliant, P2P only, memo format `DL [RoomCode] [MemberName]`)
- Payment Status Tracking (`UNPAID → MARKED_AS_PAID`)

### 7. Monetization
- Activation Code Entry (`DONTLIFT-XXXX-XXXX-XXXX`)
- Dual-path verification (offline checksum + online Firestore)
- Premium unlock (unlimited rooms, permanent logs, ad-free)
- Non-intrusive ads on non-session screens only

### 8. UX Considerations (Derived from PRD & Spec)

#### 8.1 Sensor Permission & Availability
- **Permission request:** On first session start, request accelerometer permission with clear rationale.
- **Permission denied:** Inline message "Motion detection requires sensor access. Enable in Settings."
- **Sensor unavailable:** Error state "Accelerometer unavailable on this device. Focus sessions require motion sensors."
#### 8.2 App Lifecycle Interruption
- **iOS background:** Notice "Session continues in background for up to 3 minutes."
- **Android background:** Notice "Session may pause if app is killed."
- **Return to foreground:** Notice "Session resumed. X violations recorded while away."

#### 8.3 Network Interruption & Reconnect
- **Offline banner:** Persistent top banner "Offline — scores will sync when reconnected."
- **Syncing indicator:** Pulse dot "Syncing violations..."
- **Sync complete:** Toast "All scores synced."
- **Sync failure:** Inline error "Sync failed. Retry."

#### 8.4 Host vs Member UI
- **Host sees:** "Start Session", "End Session", "Approve/Deny Early Exit", "Enter Bill", "Override Shares", "Mark as Paid", Free Tier quota warnings (room limit / capacity limit)
- **Member sees:** "Request Early Exit", "Initiate Termination Vote", "Vote for Termination", "View Leaderboard", "Generate VietQR"
- **Hidden from Member:** Host controls are not rendered (not just disabled).

#### 8.5 Confirmation / Destructive Actions
- **Early Exit:** Modal "Request early exit? Your score will freeze at current time."
- **Early Termination Vote:** Modal "Vote to end session early? Bill settlement will be skipped."
- **Host End Session:** Modal "End session? Final scores will be frozen."

#### 8.6 Validation & Recovery
- **Bill input:** "Amount must be a positive integer ≥ 1,000 VND."
- **Activation code:** "Invalid code pattern. Format: DONTLIFT-XXXX-XXXX-XXXX."
- **Room PIN:** "Room expired or invalid PIN."
- **Free Tier Quota:** "Monthly room limit reached (7/month). Upgrade to Premium for unlimited creations." / "Room capacity limit reached (5 participants). Upgrade to Premium for larger rooms."
- **Recovery:** "Retry" button on all error states.

#### 8.7 Privacy & Security UX
- **Token storage:** No UI (SecureStore is invisible).
- **Sensor data:** No UI (raw sensor streams never leave device).
- **Data sync:** "Your violation data is synced to your account only."
- **Activation code:** "Code is verified offline. No data sent to server."

### 9. Empty States
- No sessions (Solo history empty)
- No rooms (Group history empty)
- No violations (Leaderboard empty)
- No bill yet (Bill Settlement empty)

### 10. Recovery
- Offline-first SQLite reconciliation
- UUID idempotency
- Sync status indicators (PENDING, SYNCED, FAILED)

### 11. Accessibility
- Reduced motion support
- Large timer numbers (minimum 48pt)
- Color contrast for violations (WCAG AA)
- Screen reader support for timers and status
- Touch targets (minimum 44pt)

### 12. Responsive Behavior
- Mobile-first design
- Narrow view (≤ 375px width)
- Tablet adaptations for Group Room Mode
- Landscape/portrait considerations

### 13. Strict Exclusions
- ❌ No Kiosk Mode
- ❌ No In-App Wallet
- ❌ No In-App Chat
- ❌ No AI assistant
- ❌ No automatic bank verification
- ❌ No password reset (MVP)
- ❌ No email verification (MVP)
- ❌ No SSO / Social Login (deferred to Post-MVP v1.1)
- ❌ No dashboards
- ❌ No MCP or unsupported platform enhancements

### 14. Review Gate
- What must be approved before prototype work:
  - Interaction contract (all states above)
  - Design system foundations (colors, typography, components)
  - Accessibility approach
  - Responsive strategy
  - Strict exclusions preserved

### 15. Visual Direction (Reference Only)

#### 15.1 Reference Direction
**Frosted Glass / Liquid Pearl** — translucent surfaces, soft depth, subtle gradients.

> ⚠️ This is a **reference direction**, NOT a target. Developers must research additional references (modern landing pages, Pinterest, Dribbble) to understand the style fully.

#### 15.2 Design Principles
- **Clarity first:** Timer numbers, violation alerts, error states must remain high-contrast and readable.
- **Subtle depth:** Use blur and shadow for layering, not decoration.
- **Consistency:** Apply the same glass treatment across similar components.
- **Performance:** Backdrop-blur may impact low-end devices; provide fallback.

#### 15.3 Application Map
| Component | Glass Treatment | Rationale |
|-----------|----------------|-----------|
| Solo Focus timer card | ✅ Subtle blur | Calming, non-distracting |
| Group Room participant list | ✅ Subtle blur | Layered depth |
| Penalty Leaderboard rows | ✅ Subtle blur | Visual hierarchy |
| Bill Breakdown card | ✅ Subtle blur | Focus on numbers |
| VietQR display | ✅ Subtle blur | Premium feel |
| Activation Code input | ✅ Subtle blur | Modern, clean |
| Timer numbers | ❌ No blur | High contrast required |
| Violation alerts | ❌ No blur | Urgency, clarity |
| Error states | ❌ No blur | Plain, actionable |

#### 15.4 Inspiration References (to research)
- Apple iOS 17+ design language
- Modern SaaS landing pages (Linear, Vercel, Raycast)
- Dribbble search: "frosted glass mobile app"
- Pinterest search: "glassmorphism UI"

---

## Constraints & Source Precedence

1. Human-approved product decisions.
2. Product requirements and feature specification.
3. Directly inspected references.
4. AI suggestions.

**Rules:**
- References inform interaction and material patterns only; do NOT copy branding, layouts, or assets.
- Keep domain vocabulary: `Solo Focus Mode`, `Group Room Mode`, `3-Second Grace Period`, `Phone-Down Detection`, `Violation Log`, `Offline-First SQLite Reconciliation`, `VietQR P2P`, `Penalty Leaderboard`, `Host`, `Member`.
- Preserve offline-first behavior, UUID idempotency, and non-custodial VietQR settlement.
- Preserve strict exclusions: No Kiosk Mode, No In-App Wallet, No In-App Chat, No AI assistant, No automatic bank verification.
- Exclude password reset, email verification, SSO, social login (deferred to Post-MVP v1.1), dashboards, and unsupported controls.
- No MCP or unsupported platform enhancements.

---

## Expected Output

An approved design brief that a concept explorer (P4.2) and prototype builder (P4.4) can follow without guessing core interaction behavior.

---

## Save or Update

After approval, write `../docs/product-design-brief.md`; otherwise return complete Markdown for manual saving.

---

## Human Review Required

Approve **behavior and recovery expectations** before visual style. Resolve conflicts between a supplied reference and accepted product behavior explicitly.

---

## Validation Checklist

- [ ] The proposal begins with user work (focus, accountability, fair bill split), not visual style.
- [ ] Main, failure, and recovery states are observable.
- [ ] Accessibility and narrow-view behavior are explicit.
- [ ] Exclusions match product artifacts (PRD + Feature Spec).
- [ ] Design system foundations are complete (colors, typography, components, micro-interactions, accessibility).
- [ ] All mandatory domain vocabulary is used correctly.
- [ ] Offline-first behavior and sync states are covered.
- [ ] Visual direction is clearly marked as reference-only.
- [ ] Premium/Ads, ABORTED, and Hybrid Bill Allocation are referenced from PRD/Spec, not invented.