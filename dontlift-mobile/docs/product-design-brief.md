# DontLift — Product Design Brief

> **Status:** APPROVED  
> **Source Artifacts:** PRD v1.6.0 · Feature Spec v1.1.0 · Project Context v1.0.0  
> **Version:** 1.0.0  
> **Canonical Path:** `docs/product-design-brief.md`  

---

## 1. User Struggle & Core Purpose

DontLift is designed to solve phone distraction in focus and social contexts through gamified, offline-first accountability without invasive OS-level controls:

1. **Phone Distraction during Focus & Hangouts:** Users pick up phones out of habit during study sessions, library work, and meals, breaking deep focus and human connection.
2. **Lack of Lightweight Accountability:** No lightweight, non-invasive mechanism exists to enforce group phone discipline without requiring OS lockdown, device admin privileges, or kiosk modes.
3. **Fair & Gamified Bill Splitting:** Social gatherings lack a fun, objective way to split café/restaurant bills based on actual phone discipline during the meeting.

---

## 2. Auth Flow & Identity UX

### 2.1 Registration Flow
- **Inputs:** `email`, `password`, `displayName`.
- **Backend Engine:** Firebase Authentication (Email/Password provider).
- **Behavior:** On submission, Firebase creates the account, initializes `users/{uid}` in Firestore, and sets up local SQLite profile.
- **Error Handling:** Existing emails return a generic `"Registration failed. Please try again."` message to prevent user enumeration. Malformed email/weak password inputs trigger client-side validation messages before network request.

### 2.2 Login Flow
- **Inputs:** `email`, `password`.
- **Behavior:** Authenticates credentials via Firebase Auth. Silent background token refresh is handled by Firebase JS SDK before token expiry to prevent mid-session logout.
- **Error Handling:** Invalid credentials display a generic `"Invalid email or password"` error.

### 2.3 Token Security
- Access Tokens and Refresh Tokens are stored in Expo `SecureStore` (Keychain on iOS / EncryptedSharedPreferences on Android). Plaintext `AsyncStorage` for token storage is strictly prohibited.

### 2.4 Scope & Deferred Features
- **Deferred to Post-MVP v1.1:** Social Login (Google, Facebook, Apple). No UI components or stubs for social login are rendered in MVP.
- **MVP Exclusions:** Self-service password reset email flow and email verification enforcement are excluded for MVP.

---

## 3. Solo Focus Mode UX

### 3.1 Mode Selection
- User selects **Countdown Timer** (sets duration e.g. 25m, 45m, 60m) or **Open-ended Stopwatch**.
- Tapping "Start Focus" creates a session row in local SQLite (`status = 'ACTIVE'`, `started_at = NOW()`) and starts sensor monitoring.

### 3.2 Phone-Down Detection & 3-Second Grace Period
- **Sensor Engine:** Sensor manager polls device Accelerometer at 50Hz.
- **Orientation States:** `UNKNOWN`, `FACE_DOWN`, `INVALID`, `LIFTED` (mutually exclusive).
- **Grace Period Logic:**
  1. Transitioning to `INVALID` or `LIFTED` initiates a 3.0-second high-precision grace timer ($T_{\text{grace}}$).
  2. Returning to `FACE_DOWN` before $T_{\text{grace}} \ge 3.0\text{s}$ clears the timer with zero violation logged.
  3. Sustaining `INVALID`/`LIFTED` $\ge 3.0\text{s}$ instantiates a `ViolationLog` (`event_id = UUIDv4()`, `session_id`, `started_at = T_start`, `sync_status = 'PENDING'`).
  4. Haptic feedback pattern (`[0, 200, 100, 200]`) triggers on confirmed violation detection.
  5. Returning to `FACE_DOWN` updates `ended_at` and calculates cumulative `duration_seconds`.
- **Hardware Requirement:** Focus sessions strictly require motion sensors. Devices without accelerometers display an unbypassable error state ("Accelerometer unavailable on this device. Focus sessions require motion sensors.").

### 3.3 Session Summary
- Displays upon completion: Total Duration, Lift Count, Total Violation Duration, and Penalty Score.
- **Penalty Score Formula:** $\text{Penalty Score} = (\text{Lift Count} \times 10) + (\text{Violation Duration in Seconds} \times 1)$.
- Summary persists immediately to local SQLite and syncs to Firestore when online. Accessible offline.

---

## 4. Group Room Mode UX

### 4.1 Room Creation (Host)
- Host taps "Create Room". Server/Cloud Function generates 4-digit PIN (e.g. `4829`) and scannable QR string (`dontlift://room/4829`). Room enters `WAITING` state. Local SQLite `rooms` row inserted.
- **Free Tier Limit:** If Host is on Free Tier and has created 7 rooms in the current calendar month, creation is blocked with inline modal: `"Monthly room limit reached (7/month). Upgrade to Premium for unlimited creations."`

### 4.2 Room Join (Member)
- Member enters 4-digit PIN or scans QR code. Idempotent action resolves room metadata in `WAITING` state. Local SQLite `rooms` and `room_members` cached.
- **Free Tier Capacity Limit:** If room Host is on Free Tier and participant count is 5, additional joins are blocked with inline modal: `"Room capacity limit reached (5 participants). Upgrade to Premium for larger rooms."`

### 4.3 Lobby & Real-Time Sync
- Firestore real-time snapshot listener syncs participant list across all connected devices in $\le 2\text{s}$. Local `room_members` cache updated.
- **Host View:** Sees participant count, participant roster, "Start Session" button, and quota status.
- **Member View:** Sees participant list and waiting banner. Host controls are completely hidden (not just disabled).

### 4.4 Active Session & Leaderboard
- Host taps "Start Session". All devices activate local motion detection.
- Confirmed violations are logged to local SQLite and synced to Firestore `rooms/{roomId}/violations/{eventId}`.
- Real-time Penalty Leaderboard updates across all client UIs in $\le 2\text{s}$ sorted by ascending Penalty Score.

### 4.5 Early Exit (Member Request)
- Member taps "Request Early Exit". Modal confirmation pops up: `"Request early exit? Your score will freeze at current time."`
- Host receives real-time alert with "Approve" / "Deny".
- **On Approval:** Member status transitions to `EARLY_EXIT`. Motion detection stops, Penalty Score freezes at exit timestamp. Member remains in participant pool for bill splitting.
- **On Denial:** Member status remains `ACTIVE`.

### 4.6 Early Termination Vote (Group Consensus)
- Any active Member or Host taps "Initiate Termination Vote". Modal confirmation pops up: `"Vote to end session early? Bill settlement will be skipped."`
- Cloud Function creates `terminationVote` document with a 30-second countdown.
- All active participants receive interactive voting modal ("Yes" / "No").
- **100% Consensus within 30s:** Session transitions `ACTIVE → CANCELLED`. Session ends immediately without bill settlement.
- **Timeout / Non-Consensus:** Vote document is purged by Cloud Function after 30s; modal dismisses; session continues uninterrupted.

### 4.7 Host End Session
- Host taps "End Session". Modal confirmation pops up: `"End session? Final scores will be frozen."`
- Cloud Function transitions room `ACTIVE → COMPLETED`, freezes final scores, and navigates Host to Bill Settlement input.

---

## 5. Session Lifecycle State Machine

```
              ┌─────────────────────────────────────────────────────────────┐
              │                                                             │
              ▼                                                             │
        ┌───────────┐    Host Starts    ┌───────────┐    Host Ends    ┌───────────┐
───►    │  CREATED  │ ────────────────► │  WAITING  │ ──────────────► │  ACTIVE   │
        └───────────┘                   └───────────┘                 └───────────┘
                                                                            │
                                                  100% Termination Vote     │
                                           ┌────────────────────────────────┼──────────────────────────────┐
                                           │                                │                              │
                                           ▼                                ▼                              ▼
                                    ┌───────────┐                    ┌───────────┐                  ┌───────────┐
                                    │ CANCELLED │                    │ COMPLETED │                  │  ABORTED  │
                                    └───────────┘                    └───────────┘                  └───────────┘
                                   (Bill Split Excluded)            (Bill Split Active)            (Network Crash Recovery)
```

1. `CREATED → WAITING`: Room initialized by Host; PIN/QR generated; Lobby active.
2. `WAITING → ACTIVE`: Host starts session; motion detection engaged for all participants.
3. `ACTIVE → COMPLETED`: Host ends session; final Penalty Scores computed; transitions to Bill Settlement.
4. `ACTIVE → CANCELLED`: 100% consensus on Early Termination Vote within 30s; session cancelled without bill split.
5. `ACTIVE → ABORTED`: Host drops for >15 minutes or network crash recovery; room marked stale; participant stats saved locally.

---

## 6. Bill Settlement & VietQR UX

### 6.1 Total Bill Input
- Accessible to Host only on `COMPLETED` sessions. Host enters total bill amount in integer VND (validated $\ge 1,000$).

### 6.2 Hybrid Bill Allocation Algorithm
- **Base Allocation:** 40% of bill split equally among all members.
- **Penalty Allocation:** 60% of bill allocated proportionally based on individual Penalty Score vs group total Penalty Score. Zero-violation members pay equal base shares. Early Exit leavers are included using their score frozen at departure.
- **Host Manual Override:** Host may assign custom VND or percentage penalties to specific members. Remaining bill balance is distributed equally among non-overridden zero-violation members.
- **Deterministic Rounding:** All shares rounded to nearest 1,000 VND. Residual discrepancy $\Delta = B - \sum P_i'$ distributed 1,000 VND at a time according to descending residual rank ($R_i = P_i - P_i'$). Guarantee: $\sum \text{Member Shares} = \text{Total Bill}$ with zero discrepancy.

### 6.3 VietQR Generation & Memo Format
- Member taps "Pay Share". App displays scannable NAPAS-compliant VietQR image string:  
  `https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-compact2.png?amount=<SHARE_VND>&addInfo=DL%20<ROOM_PIN>%20<MEMBER_NAME>`
- **Structured Memo:** `DL [RoomCode] [MemberName]` (e.g. `DL 4829 MINH`).
- Non-custodial operation: DontLift never holds, transfers, or escrows funds.

### 6.4 Payment Status Tracking
- Default state: `UNPAID`.
- Host manually toggles state to `MARKED_AS_PAID` upon verifying bank receipt. No automatic bank API integration.

---

## 7. Monetization UX & Activation Code

### 7.1 Tier Comparison
| Capability | Free Tier | Lifetime Premium Tier (99,000 VND) |
|------------|-----------|-----------------------------------|
| Solo Focus Mode | Unlimited | Unlimited |
| Group Room Capacity | Max 5 participants | Unlimited |
| Room Creation Quota | Max 7 rooms/month | Unlimited |
| Violation Log Retention | Auto-purged after 7 days | Permanent SQLite retention |
| Penalty Leaderboard | Basic | Advanced, themes, analytics |
| Banner Ads | Light ads on non-session screens | 100% Ad-Free |

### 7.2 Activation Code Verification Flow
- User enters 16-character alphanumeric code `DONTLIFT-XXXX-XXXX-XXXX`.
- **Dual-Path Verification:**
  1. *Offline Path:* Validates embedded Luhn/checksum algorithm structure locally. Grants instant local SQLite entitlement `is_premium = true`.
  2. *Online Path:* Syncs with Firestore `activationCodes/{code}` Cloud Function, marks code `redeemedBy = uid`, and locks entitlement to user profile.
- Unlocks ad-free experience, permanent logs, and unlimited room creations immediately.

### 7.3 Ad Display Rules
- Non-intrusive banner ads rendered strictly on non-session screens (Lobby, History, Profile, Settings).
- Ads are **strictly suppressed** during active Solo Focus and Group Room sessions and completely disabled for Premium users.

---

## 8. UX Considerations (Derived from PRD & Spec)

### 8.1 Sensor Permission & Availability
- **Permission Request:** On first session launch, request accelerometer permission with clear rationale.
- **Permission Denied:** Display inline banner: `"Motion detection requires sensor access. Enable in Settings."`
- **Sensor Unavailable:** Unbypassable error state: `"Accelerometer unavailable on this device. Focus sessions require motion sensors."`

### 8.2 App Lifecycle Interruption
- **iOS Backgrounding:** Display notice: `"Session continues in background for up to 3 minutes."` (`beginBackgroundTask` extended execution).
- **Android Backgrounding:** Display notice: `"Session may pause if app is killed."` (`ON_STOP` observer).
- **Return to Foreground:** Toast notice: `"Session resumed. X violations recorded while away."`

### 8.3 Network Interruption & Reconnect
- **Offline Banner:** Top persistent banner: `"Offline — scores will sync when reconnected."`
- **Syncing Indicator:** Pulse dot indicator: `"Syncing violations..."`
- **Sync Complete:** Toast notice: `"All scores synced."`
- **Sync Failure:** Inline error action: `"Sync failed. Retry."`

### 8.4 Host vs Member UI Differentiation
- **Host Sees:** "Start Session", "End Session", "Approve/Deny Early Exit", "Enter Bill", "Override Shares", "Mark as Paid", Free Tier quota warnings (room limit / capacity limit).
- **Member Sees:** "Request Early Exit", "Initiate Termination Vote", "Vote for Termination", "View Leaderboard", "Generate VietQR".
- **Visibility Guarantee:** Host controls are completely unrendered (not just disabled) for Members.

### 8.5 Confirmation & Destructive Actions
- **Early Exit Request:** Modal `"Request early exit? Your score will freeze at current time."`
- **Early Termination Vote:** Modal `"Vote to end session early? Bill settlement will be skipped."`
- **Host End Session:** Modal `"End session? Final scores will be frozen."`

### 8.6 Validation & Recovery States
- **Bill Input:** `"Amount must be a positive integer ≥ 1,000 VND."`
- **Activation Code:** `"Invalid code pattern. Format: DONTLIFT-XXXX-XXXX-XXXX."`
- **Room PIN:** `"Room expired or invalid PIN."`
- **Free Tier Quota:** `"Monthly room limit reached (7/month). Upgrade to Premium for unlimited creations."` / `"Room capacity limit reached (5 participants). Upgrade to Premium for larger rooms."`
- **Recovery Action:** `"Retry"` button provided on all network/validation error screens.

### 8.7 Privacy & Security UX
- **Token Storage:** Completely invisible (Expo SecureStore).
- **Sensor Data Privacy:** Raw motion sensor streams never leave the mobile device.
- **Data Sync Privacy:** `"Your violation data is synced to your account only."`
- **Activation Code Offline Verification:** `"Code is verified offline. No personal data sent to server."`

---

## 9. Empty States

- **No Solo Sessions:** `"No focus sessions completed yet. Tap 'Start Focus' to begin your first session."`
- **No Group Rooms:** `"No group rooms joined or created. Create a room or scan a QR code to start."`
- **No Violations:** `"Zero violations recorded! Perfect phone discipline."`
- **No Bill Yet:** `"Session active. Bill settlement will appear when the Host ends the session."`

---

## 10. Recovery & Sync Architecture

- **Offline-First SQLite:** All violation events write locally to SQLite with `event_id` UUID before queuing for Firestore sync.
- **UUID Idempotency:** Duplicate sync attempts key on `event_id` to guarantee zero duplicate violation records.
- **Sync Status Badges:** Visual indicator chips (`PENDING`, `SYNCED`, `FAILED`) on session logs.

---

## 11. Accessibility Guidelines

- **Reduced Motion:** Respect OS-level reduced motion settings (disable background fluid pulse animations).
- **Typography:** Main timer numbers rendered at minimum **48pt** bold readable font.
- **Color Contrast:** Violation alerts and error states adhere to WCAG AA compliance (4.5:1 minimum contrast ratio).
- **Screen Reader Support:** Full ARIA/accessibility labels for timers, status indicators, and leaderboard entries.
- **Touch Targets:** Interactive controls minimum **44pt × 44pt** hit area.

---

## 12. Responsive & Layout Behavior

- **Mobile-First Layout:** Optimized for narrow screens ($\le 375\text{px}$ width).
- **Tablet Adaptation:** Dual-pane layout for Group Room Mode on tablet devices (Left: Participant List & Timer; Right: Real-time Leaderboard).
- **Orientation:** Supports portrait orientation primary; locks timer screens to portrait to prevent accidental sensor tilt invalidation.

---

## 13. Strict Feature Exclusions (REJECT IMMEDIATELY)

- ❌ **No Kiosk Mode / OS Lockdown / Device Admin controls.**
- ❌ **No In-App Wallet / Custodial balances / Direct bank API integration.**
- ❌ **No In-App Chat / Social messaging.**
- ❌ **No AI Assistant / AI productivity coaching / AI penalty generation.**
- ❌ **No Automatic Bank Verification / Bank API scraping.**
- ❌ **No Password Reset Email Flow (MVP).**
- ❌ **No Email Verification Enforcement (MVP).**
- ❌ **No SSO / Social Login (Deferred to Post-MVP v1.1).**
- ❌ **No Analytics Dashboards (MVP).**
- ❌ **No MCP or unsupported platform enhancements.**

---

## 14. Human Review Gate

Before prototype execution (P4.4), the human partner must approve:
1. Interaction Contract & Lifecycle States (`CREATED → WAITING → ACTIVE → COMPLETED / CANCELLED / ABORTED`).
2. Design System Foundations (Colors, Typography, Component Token Map).
3. Accessibility approach & Touch target specs.
4. Responsive strategy for mobile and tablet.
5. Preservation of all strict feature exclusions.

---

## 15. Visual Direction & Design System Foundations

### 15.1 Reference Direction (Non-Binding)
- **Frosted Glass / Liquid Pearl:** Translucent blurred cards, subtle ambient depth, soft gradients.
- **Reference Warning:** ⚠️ *Frosted Glass / Liquid Pearl is a non-binding reference direction, NOT a rigid target. Developers must research additional references (modern landing pages, Pinterest, Dribbble).*

### 15.2 Core Design Principles
- **Clarity First:** Timer numbers, violation alerts, and error states maintain max contrast and readability.
- **Subtle Depth:** Layering achieved through backdrop blur and soft shadow, never decorative clutter.
- **Consistency:** Uniform glass treatment applied across identical component types.
- **Performance Fallback:** Fallback solid opaque dark card background rendered on low-end devices unable to maintain 60fps with backdrop blur.

### 15.3 Glass Treatment Application Map
| Component | Glass Treatment | Rationale |
|-----------|----------------|-----------|
| Solo Focus Timer Card | ✅ Subtle Blur ($15\text{px}$) | Calming, non-distracting depth |
| Group Room Participant List | ✅ Subtle Blur ($12\text{px}$) | Layered participant hierarchy |
| Penalty Leaderboard Rows | ✅ Subtle Blur ($10\text{px}$) | High contrast row differentiation |
| Bill Breakdown Card | ✅ Subtle Blur ($15\text{px}$) | Clean numerical focus |
| VietQR Display Card | ✅ Subtle Blur ($20\text{px}$) | Premium card presentation |
| Activation Code Input | ✅ Subtle Blur ($10\text{px}$) | Modern clean text input |
| Timer Numbers | ❌ No Blur (Opaque Solid) | Max WCAG contrast required |
| Violation Alerts | ❌ No Blur (Solid Red Alert) | High urgency & clear visibility |
| Error States | ❌ No Blur (Solid Surface) | Actionable, plain legibility |

### 15.4 Design System Tokens & Foundations

#### Color Palette
- **Background Deep:** `#0B0F19` (Rich Dark Slate)
- **Glass Card Fill:** `rgba(255, 255, 255, 0.07)`
- **Glass Card Border:** `rgba(255, 255, 255, 0.12)`
- **Primary Focus Accent:** `#3B82F6` (Electric Sapphire)
- **Violation Danger:** `#EF4444` (Crimson Alert)
- **Success / Marked Paid:** `#10B981` (Emerald Green)
- **Text Primary:** `#F9FAFB` (99% White)
- **Text Secondary:** `#9CA3AF` (Muted Cool Gray)

#### Typography Scale
- **Timer Display:** 56pt Bold Monospace / SF Pro Display
- **Section Heading:** 24pt SemiBold
- **Card Title / PIN:** 20pt Bold Monospace
- **Body Text:** 16pt Regular
- **Caption / Badges:** 13pt Medium

#### Micro-Interactions
- **Grace Period Timer:** Radial progress ring decaying smoothly over 3.0 seconds.
- **Violation Event:** Instant screen border pulse in Crimson (`#EF4444`) + device haptic feedback (`[0, 200, 100, 200]`).
- **Leaderboard Position Change:** Smooth row height animation ($250\text{ms}$ ease-out).

---

## 16. Validation Checklist

- [x] The proposal begins with user work (focus, accountability, fair bill split), not visual style.
- [x] Main, failure, and recovery states are observable.
- [x] Accessibility and narrow-view behavior are explicit.
- [x] Exclusions match product artifacts (PRD + Feature Spec).
- [x] Design system foundations are complete (colors, typography, components, micro-interactions, accessibility).
- [x] All mandatory domain vocabulary is used correctly.
- [x] Offline-first behavior and sync states are covered.
- [x] Visual direction is clearly marked as reference-only.
- [x] Premium/Ads, ABORTED, and Hybrid Bill Allocation are referenced from PRD/Spec, not invented.
