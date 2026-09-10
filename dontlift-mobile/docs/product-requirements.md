# DontLift — Product Requirements Document

> **Status:** APPROVED
> **Sources:** `docs/project-brief.md` · `docs/project-context.md`
> **Version:** 1.6.0

---

## 1. Executive Summary

**Problem Statement:** During group study sessions and social hangouts, phone distraction undermines focus and social presence, with no lightweight, gamified mechanism to hold participants accountable without invasive OS-level control.

**Proposed Solution:** DontLift is an offline-first mobile app that detects phone lifts via motion sensors, logs violations with a 3-second grace period, and converts violations into penalty scores that drive fair, gamified bill splitting settled via VietQR P2P payment — with zero custodial money handling.

**Success Criteria:**

| # | Signal | Threshold |
|---|--------|-----------|
| SC-1 | False-positive violation rate on a stationary table (controlled test) | < 2% |
| SC-2 | Offline violation event recovery under normal network reconnection | 100% eventual delivery |
| SC-3 | Member-share sum vs. original bill mathematical discrepancy | Zero |
| SC-4 | VietQR scan success rate in supported Vietnamese banking apps | 100% |
| SC-5 | Group session completion rate across test cohorts | > 85% |

---

## 2. User Personas

| Persona | Context | Primary Need |
|---------|---------|--------------|
| **Student (Member)** | Library, coffee shop, study room | Stay off phone; see personal violations; pay fair share |
| **Student (Host)** | Same venue | Run the session; enforce fairness; collect payment |
| **Friend group (any role)** | Meal, café, gathering | Gamified bill split based on phone discipline |
| **Solo User** | Anywhere | Personal focus timer with violation stats |

---

## 3. User Stories & Acceptance Criteria

### Authentication

**US-01 — Registration**
As a new user, I want to create an account so I can persist sessions and join group rooms.

*Acceptance Criteria:*
- Submitting valid credentials (email, password) creates a Firebase Authentication account and returns a Firebase ID token.
- Submitting a duplicate email returns a safe error without disclosing whether the email exists.
- Passwords are never returned in any response.
- Token is stored in secure mobile storage (not AsyncStorage plain text).

**US-02 — Login**
As a returning user, I want to log in so I can access my sessions and rooms.

*Acceptance Criteria:*
- Valid credentials return a Firebase ID token; invalid credentials surface a generic error with no user enumeration.
- ID token is refreshed transparently by the Firebase SDK before expiry without forcing re-login mid-session.

---

### Solo Focus Mode

**US-03 — Create Solo Session**
As a solo user, I want to choose between Countdown Timer and open-ended Stopwatch so I can structure my focus period.

*Acceptance Criteria:*
- User selects mode (Countdown or Stopwatch) and optionally sets a duration for Countdown.
- Session transitions: `CREATED → ACTIVE` upon start.
- Session state persists to local SQLite immediately on start.

**US-04 — Phone-Down Detection (Solo)**
As a solo user, I want the app to detect when I lift or move my phone so I am held accountable.

*Acceptance Criteria:*
- Orientation states `UNKNOWN`, `FACE_DOWN`, `INVALID`, `LIFTED` are mutually exclusive at any instant.
- When state transitions to `INVALID` or `LIFTED`, a 3-second grace period starts.
- If state returns to `FACE_DOWN` within 3 seconds, no violation is recorded.
- If `INVALID`/`LIFTED` persists ≥ 3 seconds, a Violation Log entry is written to SQLite with: `event_id` (UUID), session reference, `started_at`, `ended_at` (updated on resolution).
- App entering `background` or `inactive` state during an active session triggers the same grace-period logic, subject to OS background execution limits:
  - **iOS:** Background execution time is typically ≤ 30 seconds. The app must request extended time via `beginBackgroundTask` (up to ~3 minutes) and continuously monitor `backgroundTimeRemaining`; `endBackgroundTask` must be called before time expires to notify the OS cleanly.
  - **Android:** Available background time depends on battery optimization level (App Standby Buckets). Lifecycle change events must be observed to detect backgrounding; WorkManager may be used for tasks requiring guaranteed deferred completion. The violation is recorded at the moment the transition is detected; sensor polling stops when the OS suspends the process.
- Haptic feedback fires on confirmed violation (device-capability permitting).
- Raw sensor streams are never sent to the backend.

**US-05 — Solo Session Summary**
As a solo user, I want to see a summary when my session ends so I can review my discipline.

*Acceptance Criteria:*
- Summary displays: total focus duration, violation count, total violation duration, Penalty Score.
- Penalty Score = (Lift Count × 10) + (Violation Duration in seconds × 1).
- Session transitions to `COMPLETED`; state is written locally to SQLite and synced to Firestore.
- Summary is accessible immediately after session completion, even offline.

---

### Group Room Mode

**US-06 — Create Room (Host)**
As a Host, I want to create a room so participants can join and I can manage the session.

*Acceptance Criteria:*
- Room is created with a unique 4-digit PIN and scannable QR code.
- Room transitions: `CREATED → WAITING` on creation.
- Host identity is stored in Firestore and cannot be changed mid-session.
- If Host is on Free tier and has reached the limit of 7 created rooms in the current calendar month, room creation is blocked with a clear prompt to upgrade to Premium.

**US-07 — Join Room (Member)**
As a Member, I want to join a room via PIN or QR code so I can participate in a group session.

*Acceptance Criteria:*
- Valid PIN or QR code resolves to the correct room in `WAITING` state and adds the member.
- Invalid or expired PIN returns a clear error without exposing room internals.
- Joining is idempotent: scanning the QR twice does not duplicate membership.
- If the room Host is on Free tier and participant count reaches 5, additional members are blocked from joining with a clear error indicating the room size limit for Free Hosts.
**US-08 — Room Lobby**
As any participant, I want to see who is in the room before the session starts so I can confirm the group is ready.

*Acceptance Criteria:*
- Member list updates in real time via Firestore real-time listeners when members join or leave the lobby.
- Host sees a "Start Session" control; Members see a waiting state indicator.

**US-09 — Active Group Session**
As any participant, I want my phone-down violations tracked and visible in real time so the group stays accountable.

*Acceptance Criteria:*
- Phone-Down Detection (same rules as US-04) runs for every participant independently.
- Violations are written to local SQLite and synced to Firestore; Firestore is authoritative for all scores.
- A live Penalty Leaderboard (sorted by ascending Penalty Score) updates ≤ 2 seconds after a violation is confirmed and synced to Firestore.
- App `background`/`inactive` violation rules apply per US-04.

**US-10 — Early Exit (Member Request)**
As a Member, I want to request an early exit so I can leave without abandoning the session improperly.

*Acceptance Criteria:*
- Member taps "Request Early Exit"; Host receives a real-time notification via Firestore listener.
- Host can approve or deny.
- On approval: member's stats freeze at exit time; member stops accumulating violations; member is removed from the active participant pool but remains in the session record.
- Denied request: member remains active.
- Previously recorded violation events are not deleted.

**US-11 — Early Termination (Vote)**
As any active Member, I want to request session termination so the group can end early by consensus.

*Acceptance Criteria:*
- Any active member may initiate a termination vote.
- Session terminates only when 100% of currently active members approve; validated by a Firestore Cloud Function.
- If consensus is not reached within **30 seconds**, the vote document is deleted by the Cloud Function and the session continues.
- A cancelled session does not proceed to penalty-based bill settlement.

**US-12 — End Session (Host)**
As a Host, I want to end the session so the group can move to bill settlement.

*Acceptance Criteria:*
- Host taps "End Session"; room document transitions `ACTIVE → COMPLETED` in Firestore via a Cloud Function.
- Final Penalty Scores are computed by the Cloud Function and written to Firestore; client cannot override them.
- Session Summary is shown to all participants.

---

### Bill Settlement

**US-13 — Enter Total Bill (Host)**
As a Host, I want to enter the total bill amount so the app can calculate each member's share.

*Acceptance Criteria:*
- Input is a positive integer value in VND.
- Only accessible on a `COMPLETED` session.
- Only the Host can submit the bill amount.

**US-14 — Bill Breakdown**
As any participant, I want to see the calculated breakdown so I know exactly what each person owes.

*Acceptance Criteria:*
- Each member's share is calculated by default using a penalty-weighted formula computed via a Firestore Cloud Function.
- The Host may optionally override default penalty weights by manually assigning percentage or absolute VND penalty amounts per member; the remaining bill balance is split equally among non-penalized members.
- Shares are rounded to the nearest 1,000 VND with deterministic rounding adjustment such that SUM(Member Shares) = Total Bill exactly.
- Members with 0 violations receive a valid non-zero base share.
- Early Exit members participate in bill allocation using the same formula (automated penalty weight or Host override) based on their Penalty Score frozen at exit time. A member with zero violations at exit pays a normal equal base share identical to any non-penalized member.
- Bill breakdown is read-only for Members; only the Host can trigger calculation or override adjustments.

**US-15 — VietQR Payment**
As a Member, I want to generate a VietQR code so I can pay the Host directly in my banking app.

*Acceptance Criteria:*
- QR is NAPAS/VietQR-compliant, contains Host bank details, exact member amount, and memo `DL [RoomCode] [MemberName]`.
- QR is scannable by at least the top-5 Vietnamese banking apps (to be validated in test cohort).
- Payment state transitions: `UNPAID → MARKED_AS_PAID` (Host marks manually); no automatic verification.
- DontLift never holds, transfers, or escrows money.

---

### Supporting

**US-16 — Session History**
As a user, I want to view past sessions so I can track my progress over time.

*Acceptance Criteria:*
- History lists completed solo and group sessions with date, duration, violation count, and Penalty Score.
- History loads from local SQLite first; backend sync fills gaps when online.
- For Free tier users, Violation Logs older than 7 days are automatically purged from local SQLite and filtered out in history views. Premium users retain permanent violation logs.

**US-17 — User Profile**
As a user, I want to view and edit my profile so I can manage my account.

*Acceptance Criteria:*
- Editable fields: display name. Email changes are out of scope for MVP.
- Changes are written to Firestore and reflected immediately in the UI via real-time listener.

**US-18 — App Settings**
As a user, I want to configure basic app preferences so the app behaves as I expect.

*Acceptance Criteria:*
- Configurable: haptic feedback on/off, optional violation sound on/off.
- Settings persist locally across app restarts.
- Free tier displays non-intrusive ads on non-session screens (e.g. Lobby, History, Profile); Premium tier hides all ads completely.

---

**US-19 — Activation Code Entry (Premium Unlock)**
As a user who purchased Premium, I want to enter my activation code so I can unlock Lifetime Premium features.

*Acceptance Criteria:*
- Input field validates code format `DONTLIFT-XXXX-XXXX-XXXX` (uppercase alphanumeric).
- Code validity is verified offline using an embedded checksum algorithm (and validated online with Firestore if connected).
- Upon successful verification, entitlement status `is_premium = true` is persisted to local SQLite (and synced to user profile in Firestore).
- UI immediately unlocks all Premium features: unlimited room size, unlimited room creations, permanent log retention, advanced leaderboards, analytics, custom themes, and ad-free experience.
- Invalid or already-redeemed code displays a clear, actionable error message.
---

## 4. Functional Requirements

### FR-01 — Violation Engine
- Implements the state machine: `UNKNOWN | FACE_DOWN | INVALID | LIFTED`.
- Manages the 3-second grace period independently of UI and sensor layers.
- Emits a `ViolationLog` event to the local repository; never emits raw sensor data upstream.
- Penalty Score formula is encapsulated as replaceable business logic: Score = (LiftCount × W_count) + (ViolationDurationSeconds × W_duration); default W_count = 10, W_duration = 1.

### FR-02 — Offline-First SQLite Reconciliation
- All violation events are written to SQLite with a UUID `event_id` before queuing for sync to Firestore.
- Sync to Firestore is idempotent (keyed on `event_id`), retryable, and duplicate-safe.
- Firestore is the single source of truth for shared state; the client cannot authoritatively finalize scores, session state, or bill allocations.

### FR-03 — Realtime Room Sync
- Group room state (member list, violations, leaderboard, votes) is synchronized via Firestore real-time listeners.
- Firestore's built-in offline SDK cache provides automatic state recovery on network reconnection without duplication.

### FR-04 — Session Lifecycle Enforcement
- Valid transitions: `CREATED → WAITING → ACTIVE → COMPLETED` and `ACTIVE → CANCELLED` (early termination).
- Transition authority rests with Firestore Cloud Functions; the client writes a request document and reflects the resulting state change.

### FR-05 — Bill Splitting
- Integer VND arithmetic throughout; no floating point.
- Deterministic rounding: SUM(shares) = Total Bill always.
- **Hybrid Bill Allocation Model:** Default calculation applies automated penalty-weighted formula: Score = (LiftCount × 10) + (ViolationDurationSeconds × 1). The Host possesses an override interface to manually assign specific penalty percentages or absolute VND amounts per member, with unassigned remainder divided equally among zero-violation members.
- Early leavers (approved Early Exit) are included in bill allocation; their Penalty Score is frozen at exit time and used in the same formula as remaining members.
- Allocation logic is isolated as replaceable business logic; the UI and sync layer have no dependency on its internals.

### FR-06 — Non-Intrusive Ad Engine & Retention Purge
- Local SQLite database executes scheduled cleanup of Violation Logs older than 7 days for users with `is_premium = false`.
- Ad engine displays light, non-intrusive banner ads strictly on non-focus screens (Home, Lobby, History, Settings). Ads are suppressed entirely during active Solo Focus and Group Room sessions and for users with `is_premium = true`.

---

## 5. Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| **False-positive rate** | < 2% on a stationary, non-moving surface in controlled testing |
| **Leaderboard latency** | Penalty Leaderboard updates within 2 seconds of a confirmed, synced violation |
| **Offline resilience** | App is fully functional for Solo Focus Mode with no network; Group Room requires network to join but tolerates drops during session |
| **Sync reliability** | 100% eventual delivery of queued offline events under normal network recovery |
| **Bill math** | Zero discrepancy between SUM(member shares) and total bill |
| **Sensor data privacy** | Raw sensor streams never transmitted to backend |
| **Token security** | Firebase ID tokens managed by Firebase SDK; never stored manually in plain AsyncStorage |
| **Idempotency** | No duplicate violation events after retry or reconnection |
| **Platform** | React Native (Expo Development Build) targeting Android and iOS |

---

## 6. Assumptions

1. All target devices have a functioning accelerometer supported by Expo Sensors.
2. Firestore real-time listeners and offline SDK cache handle automatic reconnection and state resynchronization.
3. The Host's bank account details are entered by the Host manually; no bank API integration.
4. Vietnamese banking apps adhere to NAPAS/VietQR spec and can scan the generated QR.

---

## 7. Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| OQ-1 | Bill split model | Hybrid model: Automated penalty-weighted calculation by default; Host option to manually override per-member penalty percentages or absolute VND amounts with remaining bill split equally. |
| OQ-2 | Early Exit member bill rule | Included in bill allocation. Penalty Score frozen at exit time; applied via the same penalty-weighted/hybrid formula. Zero violations at exit = normal equal base share. |
| OQ-3 | Grace period on OS background/inactive | Violation recorded at transition detection. iOS: extend via `beginBackgroundTask`, monitor `backgroundTimeRemaining`, call `endBackgroundTask` before expiry. Android: observe lifecycle events; use WorkManager for deferred guaranteed work. |
| OQ-4 | Early termination vote timeout | 30 seconds; dismissed server-side on expiry, session continues. |
| OQ-5 | Backend stack | Spring Boot + MySQL replaced by Firebase Authentication + Firestore + Cloud Functions. Realtime sync via Firestore listeners replaces WebSocket/STOMP. |
| OQ-6 | Free Tier vs. Premium Limits | Free tier: max 5 participants/room, max 7 created rooms/month, 7-day violation log retention, light ads. Premium: unlimited rooms & participants, permanent logs, ad-free, offline checksum activation code (`DONTLIFT-XXXX-XXXX-XXXX`). |

## 8. Monetization Strategy

### 8.1 Revenue Model
- **Type:** Freemium with Lifetime Premium
- **Price:** 99,000 VNĐ (one-time purchase)
- **Payment Method:** VietQR via external website
- **Delivery:** Activation code via email

### 8.2 Free Tier
| Feature | Limit |
|---------|-------|
| Solo Focus Mode | Unlimited |
| Group Room participants | Max 5 |
| Rooms created/month | 7 |
| Violation Log retention | 7 days |
| Penalty Leaderboard | Basic |
| Ads | Light, non-intrusive |

### 8.3 Premium Features
| Feature | Benefit |
|---------|---------|
| Unlimited Group Room | No participant limit |
| Permanent Violation Log | Never lose history |
| Advanced Leaderboard | Themes, export, insights |
| Detailed Analytics | Charts, patterns |
| Custom Themes | Personalization |
| Ad-free | Clean experience |
| Priority Support | Faster response |

### 8.4 Activation Flow
1. User visits website → pays via VietQR
2. System generates activation code (DONTLIFT-XXXX-XXXX-XXXX)
3. Code sent via email
4. User enters code in app → Premium unlocked
5. Code verified offline via checksum

### 8.5 Constraints Compliance
- ✅ No In-App Wallet
- ✅ No payment gateway custody
- ✅ No real funds handling in app
- ✅ VietQR only for P2P settlement between users

## 9. Exclusions (Strict — Reject Without Approval)

- No payment gateway, in-app wallet, escrow, or custodial balances.
- No Kiosk Mode, Device Administrator, forced screen lock, or OS lockdown.
- No in-app chat, social feeds, or friend directories.
- No camera-based detection, computer vision, or gaze tracking.
- No AI assistant, AI coaching, or AI-generated penalties.
- No automatic bank-transfer verification.
- No MCP or unsupported platform enhancements.

---

## 10. Phased Scope

| Phase | Scope |
|-------|-------|
| **MVP** | Auth, Solo Focus Mode, Phone-Down Detection, Group Room (create/join/lobby/active/end), Early Exit, Early Termination, Penalty Leaderboard, Bill Entry, Bill Breakdown, VietQR, Session History, Profile, Settings |
| **Post-MVP (v1.1)** | Configurable penalty weights per room, extended session history analytics |
| **Post-MVP (v2.0)** | Additional gamification modes — to be defined after MVP validation |

---

## Validation Checklist

- [x] Each requirement serves the core phone-down accountability and Kanban-style session journey.
- [x] All acceptance criteria are observable (sensor state, UI state, database records, API responses).
- [x] Authentication (Firebase Auth), persistence (SQLite + Firestore), and authorization (Host vs. Member, Cloud Function-enforced) are explicit.
- [x] Exclusions prevent feature expansion beyond MVP.
- [x] Open Questions are named rather than silently invented.
