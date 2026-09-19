# DontLift — Product Design Record

> **Status:** APPROVED (Post-Interactive Prototype Review P4.5)  
> **Source Artifacts:** PRD v1.6.0 · Feature Spec v1.1.0 · Project Context v1.0.0 · Product Design Brief v1.0.0 · Liquid Acrylic Concept Final  
> **Version:** 1.1.0  
> **Canonical Path:** `docs/product-design.md`  

---

## 1. User Struggle & Core Purpose

DontLift is designed to solve phone distraction in focus and social contexts through gamified, offline-first accountability without invasive OS-level controls:

1. **Phone Distraction during Focus & Hangouts:** Users pick up phones out of habit during study sessions, library work, and meals, breaking deep focus and human connection.
2. **Lack of Lightweight Accountability:** No lightweight, non-invasive mechanism exists to enforce group phone discipline without requiring OS lockdown, device admin privileges, or kiosk modes.
3. **Fair & Gamified Bill Splitting:** Social gatherings lack a fun, objective way to split café/restaurant bills based on actual phone discipline during the meeting.

---

## 2. Auth Flow & Identity UX

### 2.1 Registration Flow
- **Inputs:** `displayName` (Full Name), `email`, `password`, `passwordConfirm`.
- **Backend Engine:** Firebase Authentication (Email/Password provider).
- **Behavior:** On submission, Firebase creates the account, initializes `users/{uid}` in Firestore, and sets up local SQLite profile.
- **Error Handling:** Existing emails return a generic `"Registration failed. Please try again."` message to prevent user enumeration. Malformed email/weak password inputs trigger client-side validation messages before network request.

### 2.2 Login Flow
- **Inputs:** `email` / phone, `password` / PIN.
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
- User selects **Countdown Timer** (presets: 25m Pomodoro Sprint, 45m Deep Work Flow, 60m Total Immersion, or Custom Stepper ±5m bounded 5m–180m) or **Open-ended Stopwatch**.
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
- **Hardware Requirement:** Focus sessions strictly require motion sensors. Devices without accelerometers display an unbypassable error state (`ERR_SENS_0x4F`: "Accelerometer unavailable on this device. Focus sessions require motion sensors.").

### 3.3 Session Summary
- Displays upon completion: Total Duration, Lift Count, Total Violation Duration, Discipline Rate (100% for clean sessions), Streak Status, and Penalty Score.
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
- Real-time Penalty Leaderboard updates across all client UIs in $\le 2\text{s}$ sorted by ascending Penalty Score (lowest penalties rank highest).

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
- **Structured Memo:** `DL [RoomCode] [MemberName]` (e.g. `DL 8821 MINH`).
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
- User enters 16-character alphanumeric code `DONTLIFT-XXXX-XXXX-XXXX` or sample license `DL-PRO-2026-X99`.
- **Dual-Path Verification:**
  1. *Offline Path:* Validates embedded Luhn/checksum algorithm structure locally. Grants instant local SQLite entitlement `is_premium = true`.
  2. *Online Path:* Syncs with Firestore `activationCodes/{code}` Cloud Function, marks code `redeemedBy = uid`, and locks entitlement to user profile.
- Unlocks ad-free experience, permanent logs, and unlimited room creations immediately.

### 7.3 Ad Display Rules
- Non-intrusive banner ads rendered strictly on non-session screens (Lobby, History, Profile, Settings).
- Ads are **strictly suppressed** during active Solo Focus and Group Room sessions and completely disabled for Premium users.

---

## 8. Visual Direction & Design System Foundations

### 8.1 Liquid Acrylic (Real Frosted Glass) Specification
- **Background Base:** `#faf8ff` with ambient gradient mesh `linear-gradient(145deg, #E0E7FF 0%, #EDE9FE 45%, #D1FAE5 100%)`.
- **Primary Panel Fill:** `rgba(255, 255, 255, 0.35)` with `backdrop-filter: blur(40px) saturate(160%)`.
- **Navigation & Header Fill:** `rgba(255, 255, 255, 0.45)` with `backdrop-filter: blur(40px) saturate(160%)`.
- **Inset Subpanels / Inputs:** `rgba(255, 255, 255, 0.25)` with `backdrop-filter: blur(30px) saturate(160%)`.
- **Glass Border Stroke:** `1px solid rgba(255, 255, 255, 0.90)`.
- **Specular Top-Left Light:** `inset 1px 1px 2px 0px rgba(255, 255, 255, 0.95)`.
- **Specular Bottom Reflection:** `inset -1px -1px 2px 0px rgba(255, 255, 255, 0.25)`.
- **Elevation Shadow:** `0 8px 32px rgba(0, 0, 0, 0.08)`.

### 8.2 Color Palette Tokens
- **Text Primary:** `#0F172A` (Slate 900)
- **Text Secondary:** `#1E293B` (Slate 800)
- **Text Tertiary:** `#475569` (Slate 600)
- **Text Muted:** `#64748B` (Slate 500)
- **Primary Action Accent:** `#2563EB` (Blue 600)
- **Success / Marked Paid:** `#10B981` (Emerald 500)
- **Warning:** `#F59E0B` (Amber 500)
- **Violation Danger / Alert:** `#EF4444` (Red 500)

### 8.3 Typography Tokens
- **Font Families:** `'Plus Jakarta Sans'` (Primary Body & Headlines), `'JetBrains Mono'` (Timer Readout, PIN, Monospace Labels).
- **Timer Readout:** `JetBrains Mono`, 48px – 64px, bold tabular figures.
- **Headline LG:** `Plus Jakarta Sans`, 28px bold.
- **Headline MD:** `Plus Jakarta Sans`, 22px bold.
- **Headline SM:** `Plus Jakarta Sans`, 18px bold.
- **Body Text:** `Plus Jakarta Sans`, 14px – 16px medium/regular.
- **Caption / Mono Badges:** `JetBrains Mono` / `Plus Jakarta Sans`, 11px – 12px font-semibold.

---

## 9. Interactive Prototype Review Gate (P4.5) Findings & Resolutions

During gate review P4.5, the running interactive prototype and React Native codebases were audited against all 10 core flows. The human partner approved the following corrections and deferred risks:

### 9.1 Accepted Corrections

1. **Primary CTA Button Height Standardization:**
   - *Issue:* Buttons styled with Tailwind class `h-13` (in `SoloSelectScreen`, `GroupLobbyScreen`, `BillAllocationScreen`, `VietQRSettlementScreen`) resolved to restricted heights (20px–24px) violating minimum touch target standards.
   - *Correction:* Standardize all primary action buttons across prototype templates and native styles to `min-h-[48px] py-3.5` / `h-12` (minimum 48px hit height).

2. **Full Name Registration Field in Native Screen:**
   - *Issue:* `src/screens/LoginScreen.tsx` lacked the `Full Name` (`displayName`) input in Sign Up mode, preventing profile initialization for room rosters.
   - *Correction:* Add `authName` state and the "Full Name" input field preceding email/phone in `src/screens/LoginScreen.tsx`.

3. **Stopwatch Mode Selector in Native Solo Focus:**
   - *Issue:* `src/screens/SoloSelectScreen.tsx` lacked the segmented control for switching between Countdown Timer and Stopwatch Mode.
   - *Correction:* Implement the segmented `FocusModeType` toggle (`countdown` vs `stopwatch`) into `src/screens/SoloSelectScreen.tsx`.

4. **Header Control Deck & Minor Action Touch Target Enlargement:**
   - *Issue:* Header drawer button `#btn-control-deck` rendered at 36px × 36px, below the recommended 44px × 44px mobile touch area.
   - *Correction:* Increase touch bounding area to `min-w-[44px] min-h-[44px]` (or apply `hitSlop` in native components).

5. **Dynamic Radial SVG Progress Arc in Native Solo Timer:**
   - *Issue:* `src/screens/SoloTimerScreen.tsx` utilized a static View border ring instead of a progressive radial countdown arc.
   - *Correction:* Implement `react-native-svg` with dynamic `strokeDashoffset` in `src/screens/SoloTimerScreen.tsx` matching the approved web prototype.

---

### 9.2 Deferred Risks

1. **Hardware Sensor Drift & Device Throttling in Real-World Conditions:**
   - *Risk:* Web and emulator testing simulate 50Hz sensor streams via software clocks. Real-world physical device sensor noise, table tilt thresholds, battery saving sleep states, and OS background execution limits must be calibrated on physical test devices.
   - *Mitigation:* 3.0-second high-precision grace period and 50Hz low-pass sensor filtering mitigate transient bumps.

2. **Non-Custodial Manual Payment Verification:**
   - *Risk:* DontLift operates without banking API webhooks; settlement relies on Host manual confirmation (`MARKED_AS_PAID`) upon checking their personal banking app.
   - *Mitigation:* Structured transfer memo (`DL [RoomCode] [MemberName]`) and recipient bank account details allow fast cross-verification.

3. **Mesh Sync Network Latency & Transient Disconnects:**
   - *Risk:* Firestore snapshot listener latency ($\le 2\text{s}$) can fluctuate over weak mobile networks during active sessions.
   - *Mitigation:* Offline-first local SQLite queue with UUIDv4 event idempotency guarantees no lost or duplicate violation entries upon reconnection.

---

## 10. Strict Feature Exclusions

- ❌ **No Kiosk Mode / OS Lockdown / Device Admin controls.**
- ❌ **No In-App Wallet / Custodial balances / Direct bank API integration.**
- ❌ **No In-App Chat / Social messaging.**
- ❌ **No AI Assistant / AI productivity coaching / AI penalty generation.**
- ❌ **No Automatic Bank Verification / Bank API scraping.**
- ❌ **No Password Reset Email Flow (MVP).**
- ❌ **No Email Verification Enforcement (MVP).**
- ❌ **No SSO / Social Login (Deferred to Post-MVP v1.1).**
- ❌ **No Analytics Dashboards (MVP).**
