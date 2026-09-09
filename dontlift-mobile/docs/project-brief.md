# DontLift — Project Brief

## 1. Product Overview

**DontLift** is an offline-first mobile accountability application designed to reduce excessive phone usage during group study sessions, social hangouts, and solo focus periods.

Users place their phones face-down and start a session. When a phone is lifted, turned away from the expected face-down position, or the application becomes inactive during an active session, DontLift records a violation after a **3-second grace period**.

For group sessions, violations are converted into penalty scores. These scores affect the final bill distribution, creating a simple accountability and gamification mechanism.

At the end of a group session, members can pay their calculated share directly to the host using a generated **VietQR**.

DontLift is **non-custodial** and does not hold, transfer, or escrow user money.

---

# 2. Target Users

### Students & Study Groups

For students studying together in:

* Libraries
* Coffee shops
* Classrooms
* Study rooms

The goal is to encourage participants to stay focused and reduce unnecessary phone usage.

### Friends & Social Groups

For groups meeting for:

* Meals
* Coffee
* Social gatherings

Phone usage becomes part of a lightweight gamified bill-splitting experience.

### Solo Users

For individuals who want:

* A focus timer
* Phone-down accountability
* Violation statistics
* A lightweight alternative to aggressive phone-blocking applications

---

# 3. Core Product Features

## 3.1 Solo Focus

Users can create a solo session with either:

* Countdown timer
* Open-ended stopwatch

During the session the application tracks:

* Focus duration
* Violation count
* Violation duration
* Penalty score

The user can view a summary when the session ends.

---

## 3.2 Group Room

A user can create a room as **Host**.

Other users join using:

* 4-digit PIN
* QR code

### Host

The Host can:

* Create and configure a room
* Start and end the session
* Approve early-exit requests
* Manage session lifecycle
* Enter the final bill
* View the final leaderboard
* View the bill breakdown

### Member

Members can:

* Join a room
* Participate in the session
* View session status
* View their violations
* Request early exit
* Vote for early termination
* View final ranking
* View their calculated bill
* Generate VietQR for payment

Group state should be synchronized in realtime when network connectivity is available.

---

# 4. Phone-Down Accountability

DontLift uses device motion/orientation sensors to determine whether the phone remains in the expected face-down position.

The sensor system should be isolated from the UI and represented through application-level states such as:

```text
UNKNOWN
FACE_DOWN
INVALID
LIFTED
```

### 3-Second Grace Period

A possible violation is not immediately counted.

```text
Invalid state detected
        ↓
   Start 3s grace period
        ↓
Still invalid?
   ├── No → Ignore
   └── Yes → Record violation
```

The grace period reduces false positives caused by:

* Table movement
* Accidental bumps
* Minor adjustments
* Sensor noise

A confirmed violation records its duration.

The application may provide:

* Haptic feedback
* Optional warning sound
* Visual warning

App `background` / `inactive` transitions during an active session may also be treated as violations, subject to Android/iOS lifecycle limitations.

---

# 5. Offline-First

Offline operation is a core product requirement.

Important session events must be stored locally before being synchronized with the backend.

```text
Sensors / AppState
       ↓
Violation Engine
       ↓
Local SQLite
       ↓
Sync Queue
       ↓
Spring Boot API
       ↓
MySQL
```

Each event has a unique `event_id`.

Pending events are synchronized when connectivity returns and when the mobile platform permits execution.

Synchronization must be:

* Idempotent
* Retryable
* Duplicate-safe

The backend is authoritative for shared state and final results.

The client must not be trusted to directly modify:

* Final session state
* Final penalty scores
* Final bill allocation

---

# 6. Session Rules

## Normal Lifecycle

```text
CREATED
   ↓
WAITING
   ↓
ACTIVE
   ↓
COMPLETED
```

A session can also become:

```text
CANCELLED
```

---

## Early Exit

A member may request to leave an active group session.

The Host must approve the request.

After approval:

* The member's statistics are frozen.
* The member stops accumulating new violations.
* The member is removed from the active participant pool.
* The member is excluded from the final penalty pool according to the session rules.

Previously recorded events remain stored.

---

## Early Termination

Any active member may request termination.

The session terminates only when **100% of currently active members approve**.

If consensus is not reached, the session continues.

Consensus must be validated by the backend.

A cancelled session does not proceed to normal penalty-based bill settlement.

---

# 7. Penalty Scoring

Lower penalty score means better discipline.

The default formula is:

```text
Penalty Score =
    (Lift Count × W_count)
    +
    (Violation Duration × W_duration)
```

Default weights:

```text
W_count = 10
W_duration = 1
```

Example:

```text
Lift Count = 3
Violation Duration = 25 seconds

Penalty Score
= (3 × 10) + (25 × 1)
= 55
```

Scoring logic must be implemented as independent business logic so the weights and calculation strategy can be changed without modifying the UI or sensor layer.

---

# 8. Bill Splitting

After a completed group session, the Host enters the total bill in VND.

The application calculates each participating member's share based on their penalty scores.

The system must guarantee:

```text
SUM(Member Shares) = Total Bill
```

A member with zero violations must still have a valid bill share.

The exact weighting between the normal/base contribution and penalty adjustment should be isolated as configurable business logic.

All monetary values are represented as integer VND.

Shares are rounded to the nearest 1,000 VND. Any rounding difference is assigned deterministically so that the final sum always equals the original bill.

Final money calculations must use integer-safe arithmetic.

---

# 9. VietQR Settlement

DontLift generates a VietQR/NAPAS-compatible payment QR for each member.

The QR contains:

* Host bank information
* Host account number
* Host account name
* Exact payment amount
* Structured transfer description

Example:

```text
DL [RoomCode] [MemberName]
```

Payment flow:

```text
Session Complete
      ↓
Host enters bill
      ↓
Calculate member shares
      ↓
Member views amount
      ↓
Generate VietQR
      ↓
Member pays Host directly
```

DontLift does not:

* Hold money
* Provide wallets
* Use escrow
* Process bank transfers
* Automatically verify bank transfers

MVP payment states are limited to:

```text
UNPAID
MARKED_AS_PAID
```

Actual bank-transfer verification occurs outside the application.

---

# 10. Technology Stack

| Layer          | Technology                   |
| -------------- | ---------------------------- |
| Mobile         | React Native + TypeScript    |
| Runtime        | Expo Development Build       |
| Navigation     | React Navigation             |
| State          | Zustand                      |
| Sensors        | Expo Sensors                 |
| Local Database | SQLite / expo-sqlite         |
| Backend        | Java 17+ / Spring Boot 3.x   |
| ORM            | Spring Data JPA              |
| Database       | MySQL 8.0                    |
| Realtime       | Spring WebSocket / STOMP     |
| Authentication | Spring Security + JWT        |
| Payment        | VietQR / NAPAS-compatible QR |

---

# 11. Architecture Principles

The system follows clear separation of concerns:

```text
Sensor Layer
      ↓
Violation Engine
      ↓
Local Repository
      ↓
Sync Service
      ↓
Backend API
      ↓
Database
```

Realtime room updates:

```text
Spring Boot
     ↓
WebSocket
     ↓
Mobile Clients
```

The UI consumes application state through hooks/store mechanisms.

UI components should not directly contain:

* Sensor polling
* SQLite queries
* Synchronization logic
* Scoring calculations
* Bill calculations

Business logic should remain independently testable.

---

# 12. MVP Screens

### Authentication

* Login
* Registration

### Main

* Home / Dashboard

### Solo

* Create Solo Session
* Active Focus Session
* Solo Summary

### Group

* Create Room
* Join Room
* PIN Join
* QR Scanner
* Room Lobby
* Active Group Session
* Live Violation Leaderboard
* Session Summary

### Settlement

* Split-Bill Configuration
* Calculated Breakdown
* VietQR Screen / Modal

### Supporting

* User Profile
* Session History
* App Settings

---

# 13. Security & Privacy

The application must:

* Authenticate API requests.
* Validate user permissions server-side.
* Validate room and session membership.
* Protect authentication tokens using secure mobile storage.
* Prevent users from modifying authoritative scores.
* Prevent duplicate event processing.
* Validate synchronized events on the server.

Raw sensor data should remain local whenever possible.

Preferred:

```text
Raw Sensor Data
      ↓
Local Detection
      ↓
Violation Event
      ↓
SQLite
      ↓
Sync
```

The application should not continuously upload raw sensor streams.

---

# 14. Out of Scope

The MVP does not include:

### Payments

* Payment gateways
* Digital wallets
* Escrow
* Custodial balances
* Open Banking
* Automatic bank-transfer verification

### Device Control

* Device Administrator
* Kiosk Mode
* Forced screen locking
* Aggressive application blocking
* Root/jailbreak functionality

### Social

* Social feeds
* Direct messaging
* Public friend directories
* Follow/follower systems

### Advanced Detection

* Computer vision
* Camera-based detection
* Gaze detection
* Facial recognition

### AI

* AI assistant
* AI productivity coach
* AI-generated penalties

---

# 15. MVP Success Criteria

The MVP should achieve:

* **< 2%** false-positive violation rate on stationary tables during controlled testing.
* **100% eventual recovery** of queued offline violation events under normal network recovery conditions.
* **Zero mathematical discrepancy** between the final member-share sum and the original bill.
* VietQR successfully scannable by supported Vietnamese banking applications.
* Consistent group session state across connected clients.
* No duplicate violation events after retry/reconnection.
* Target session completion rate of **> 85%** across test cohorts.

---

# 16. Development Direction

This brief defines the **product-level source of truth**.

Detailed implementation should be developed separately in:

```text
docs/
├── architecture.md
├── database.md
├── business-rules.md
├── api.md
├── ui-spec.md
└── implementation.md
```

Implementation should proceed incrementally:

```text
1. Project Setup
       ↓
2. Authentication
       ↓
3. Solo Session
       ↓
4. Sensor & Violation Engine
       ↓
5. Group Room
       ↓
6. Realtime WebSocket
       ↓
7. Offline Sync
       ↓
8. Scoring
       ↓
9. Bill Splitting
       ↓
10. VietQR
       ↓
11. Testing & Integration
```

The implementation should prioritize **simple, testable, maintainable solutions** and must not introduce features outside the MVP without explicit approval.
