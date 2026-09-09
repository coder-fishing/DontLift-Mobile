# DontLift — Reusable Project Context

> **Version:** 1.0.0  
> **Source:** `docs/project-brief.md` + Approved Architectural Decisions  
> **Canonical Target:** `docs/project-context.md`

---

## 1. Product Boundary & Core Mechanics

### 1.1 Solo Focus Mode
- Supports both **Countdown Timer** and **Open-ended Stopwatch**.
- Tracks active focus duration, total violation count, accumulated violation duration, and overall **Penalty Score**.
- Generates a focus summary immediately upon session completion.

### 1.2 Group Room Mode
- **Host:** Creates and configures the room, manages room lifecycle (start/end), approves **Early Exit** requests, inputs the total bill amount (in integer VND), and views the live/final **Penalty Leaderboard** and bill breakdown.
- **Member:** Joins via 4-digit PIN or QR code, views session state and personal violations, requests Early Exit, votes for **Early Termination**, views final rankings, and generates **VietQR** for peer-to-peer (P2P) payment to the Host.
- Real-time room state is synchronized across all connected clients via WebSocket (STOMP) when network is available.

### 1.3 Phone-Down Detection & 3-Second Grace Period
- Isolates raw motion sensor detection from UI logic through abstract application states:
  `UNKNOWN` | `FACE_DOWN` | `INVALID` | `LIFTED`
- **3-Second Grace Period:** When an `INVALID` state is detected, a 3-second grace countdown initiates. If the phone returns to `FACE_DOWN` within 3 seconds, the event is ignored (mitigating false positives from table vibration or minor adjustments). If `INVALID` persists after 3 seconds, a **Violation Log** is recorded.
- Confirmed violations record exact violation duration and may trigger haptic/auditory warnings.
- App `background` / `inactive` state transitions during active sessions are treated as violations subject to OS limits.

---

## 2. Fixed System Constraints

### 2.1 Hardware Sensors
- Uses `Expo Sensors` (Accelerometer / Gyroscope) for local device orientation detection.
- Raw sensor streams must remain local on the device and must never be continuously streamed to the backend server.

### 2.2 Offline-First SQLite Reconciliation
- All violation events are immediately written to local SQLite storage with a unique `event_id` (UUID) before being queued for synchronization.
- Sync mechanism to Spring Boot backend must be **Idempotent**, **Retryable**, and **Duplicate-safe**.
- **Backend Authority:** The Spring Boot backend is the single source of truth. Mobile clients cannot authoritatively finalize session state, penalty scores, or bill allocations.

### 2.3 VietQR P2P Settlement
- Generates NAPAS / VietQR compliant QR codes populated with Host bank details, exact member payment share, and structured transfer memo: `DL [RoomCode] [MemberName]`.
- **Non-custodial Guarantee:** DontLift never holds money, manages wallets, escrows funds, or executes direct banking API transfers.
- **Payment States:** Limited to `UNPAID` and `MARKED_AS_PAID`. Verification occurs strictly out-of-app by the Host.

---

## 3. Decisions, Assumptions & Open Questions

### 3.1 Approved Decisions
1. **Default Penalty Formula:**  
   $$\text{Penalty Score} = (\text{Lift Count} \times 10) + (\text{Violation Duration in Seconds} \times 1)$$
2. **Deterministic Bill Splitting:**  
   $$\sum \text{Member Shares} = \text{Total Bill (VND)}$$  
   Shares are rounded to the nearest 1,000 VND. Members with 0 violations still pay a base share.
3. **Consensus Early Termination:** Requires **100% approval** of currently active members, validated server-side.
4. **Host-Approved Early Exit:** Freezes member stats at time of departure and excludes them from future active violation accumulation.

### 3.2 System Assumptions
1. All target diod devices feature reliable accelerometer sensors supported by Expo Development Build.
2. WebSocket STOMP connections automatically retry and resynchronize room state upon network recovery.

### 3.3 Open Questions (To resolve in technical specification phase)
1. Exact ratio split between base fee allocation vs. penalty weighted adjustment in bill splitting algorithm.
2. Exact bill calculation rule for Early Exit members (whether prorated or frozen at exit time).
3. Grace period applicability for OS lifecycle transitions (`background` / `inactive`).

---

## 4. Domain Vocabulary & Strict Exclusions

### 4.1 Mandatory Domain Vocabulary
- `Solo Focus Mode`
- `Group Room Mode`
- `3-Second Grace Period`
- `Phone-Down Detection`
- `Violation Log`
- `Offline-First SQLite Reconciliation`
- `VietQR P2P`
- `Penalty Leaderboard`
- `Host`
- `Member`

### 4.2 Strict Feature Exclusions (REJECT IMMEDIATELY IF REQUESTED)
- ❌ **No Kiosk Mode / OS Lockdown / Device Admin privileges.**
- ❌ **No In-App Wallet / Custodial Balances / Payment Gateway integration.**
- ❌ **No In-App Chat / Social Feeds / Friends Management.**
- ❌ **No Camera-based Detection / Computer Vision / Gaze Tracking.**
- ❌ **No AI Assistant / AI Productivity Coaching / AI Penalties.**

---

## 5. Source Hierarchy

1. **Newer human-approved decisions** (highest priority).
2. **Approved Project Brief** (`docs/project-brief.md`).
3. **AI technical recommendations / proposals** (lowest priority).
