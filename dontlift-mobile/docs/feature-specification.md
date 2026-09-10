# DontLift — Detailed Feature Specification

> **Status:** APPROVED  
> **Traceability:** PRD v1.6.0 (`US-01` – `US-19`, `FR-01` – `FR-06`) · Project Context v1.0.0  
> **Version:** 1.1.0  

---

## 1. Registration, Authentication & Identity Specification

### 1.1 Auth Capabilities & Flow
- **Registration (`US-01`):**  
  - Inputs: `email` (string), `password` (string), `displayName` (string).  
  - Engine: Firebase Authentication (Email/Password provider).  
  - Success behavior: Firebase Auth creates user account, returns ID Token + Refresh Token, and initializes Firestore user document (`users/{uid}`) and local SQLite profile.  
  - Failure behavior:  
    - Existing email: Returns generic error `"Registration failed. Please try again."` without disclosing account existence (prevents user enumeration).  
    - Weak password / Malformed email: Returns localized validation error before sending network request.  
- **Login (`US-02`):**  
  - Inputs: `email` (string), `password` (string).  
  - Success behavior: Authenticates with Firebase, obtains tokens, writes user session to secure local storage.  
  - Failure behavior: Generic `"Invalid email or password"` message.  
- **Token Management & Security:**  
  - Access Token (1-hour validity) and Refresh Token MUST be stored in Expo `SecureStore` (Keychain on iOS, EncryptedSharedPreferences on Android).  
  - `AsyncStorage` plain text storage is strictly PROHIBITED for tokens.  
  - Firebase JS SDK automatically handles silent token refresh in the background prior to expiry without interrupting active sessions.

### 1.2 Authentication Lifecycle & Scope Boundaries
- **MVP Exclusions:** Password reset email flow, email verification enforcement, account deletion self-service.  
- **Deferred Auth Features (Post-MVP v1.1):** Social Login via Google, Facebook, and Apple authentication providers is explicitly deferred to Post-MVP v1.1 (documented in PRD Section 10). Social login components are not built during MVP.

---

## 2. Authorization & Protected Access Specification

### 2.1 Role-Based Access Control (RBAC)

| Role | Target Resource | Allowed Actions | Authorization Mechanism |
|------|-----------------|-----------------|-------------------------|
| **Host** | Room (`rooms/{roomId}`) | Create room, Start session, End session, Approve/Deny Early Exit requests, Enter Total Bill, Override penalty shares, Mark payments as paid. | Firestore Security Rule: `request.auth.uid == resource.data.hostId` |
| **Member** | Room (`rooms/{roomId}`) | Join room via PIN/QR, Request Early Exit, Vote for Early Termination, View leaderboard, View final breakdown, Generate VietQR. | Firestore Security Rule: `request.auth.uid in resource.data.participantIds` |
| **Anonymous / External** | Room (`rooms/{roomId}`) | None (Blocked). | Denied by default in Security Rules. |

### 2.2 Entitlement & Quota Authorization Rules
- **Host Room Creation Limit (`US-06`, `FR-06`):**  
  - Free Tier Host: Max 7 created rooms per calendar month. Evaluated via Cloud Function before room creation (`COUNT(rooms WHERE hostId == uid AND createdAt >= firstDayOfMonth) < 7`).  
  - Premium Tier Host: Unlimited room creations (`is_premium == true`).  
- **Room Capacity Limit (`US-07`, `FR-06`):**  
  - Free Tier Host Room: Max 5 participants (1 Host + 4 Members). Blocked at join time via Cloud Function (`participantCount < 5`).  
  - Premium Tier Host Room: Unlimited participants.

---

## 3. Room & Session Lifecycle State Machine

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

### 3.1 Lifecycle States & Transition Rules

| Initial State | Target State | Trigger Event | Authority | Side Effects |
|---------------|--------------|---------------|-----------|--------------|
| `None` | `CREATED` | Host initializes room | Client -> Cloud Function | Unique 4-digit PIN generated; Room doc created. |
| `CREATED` | `WAITING` | Room doc written to Firestore | Firestore | Lobby live; QR Code rendered; Members can join. |
| `WAITING` | `ACTIVE` | Host taps "Start Session" | Cloud Function | Motion detection activated on all member devices; local SQLite timer started. |
| `ACTIVE` | `COMPLETED` | Host taps "End Session" | Cloud Function | Final Penalty Scores frozen; Host navigated to Total Bill entry (`US-13`). |
| `ACTIVE` | `CANCELLED` | 100% consensus on Early Termination Vote | Cloud Function | Session terminated early; Penalty calculation and Bill Settlement bypassed (`US-11`). |
| `ACTIVE` | `ABORTED` | Host offline timeout / drop > 15m | Cloud Function Cron | Room marked stale; participant stats saved locally. |

---

## 4. Feature Flow Specifications

### 4.1 Solo Focus Mode (`US-03`, `US-04`, `US-05`, `FR-01`)
1. **Mode Selection:** User selects **Countdown Timer** (sets duration e.g. 25m) or **Open-ended Stopwatch**. Taps "Start Focus".
2. **State Initialization:** Local SQLite writes session row (`status = 'ACTIVE'`, `started_at = NOW()`).
3. **Motion Detection Loop:**  
   - Sensor manager polls device Accelerometer at 50Hz.
   - Evaluates orientation states: `UNKNOWN`, `FACE_DOWN`, `INVALID`, `LIFTED`.
4. **3-Second Grace Period Enforcement:**  
   - Transition to `INVALID` or `LIFTED` starts local high-precision timer $T_{\text{grace}} = 3.0\text{s}$.
   - If orientation returns to `FACE_DOWN` before $T_{\text{grace}} \ge 3.0\text{s}$, timer is cleared; no violation is logged.
   - If $T_{\text{grace}} \ge 3.0\text{s}$, a `ViolationLog` entry is instantiated:  
     `event_id = UUIDv4()`, `session_id`, `started_at = T_start`, `sync_status = 'PENDING'`.
   - Continuous violation updates `ended_at = T_end` and `duration_seconds` when phone returns to `FACE_DOWN`.
   - Haptic feedback pattern (`[0, 200, 100, 200]`) fires on confirmed violation.
5. **OS Lifecycle Transitions (`US-04` / Resolved Decision OQ-3):**  
   - iOS: App moving to `background` triggers `beginBackgroundTask`. Violation timer starts. If app remains in background $\ge 3\text{s}$, violation recorded. Extended background task cleaned up via `endBackgroundTask`.
   - Android: Lifecycle observer catches `ON_STOP`. Violation recorded immediately if session is active; background sync deferred to WorkManager if app killed.
6. **Session Completion:** User taps "End Session" or Countdown reaches zero.  
   - Session transitions to `COMPLETED`.  
   - Summary screen presents: Total Duration, Lift Count, Total Violation Duration, Penalty Score.  
   - Session summary written to local SQLite and queued for Firestore sync.

### 4.2 Group Room Mode (`US-06` – `US-12`, `FR-03`, `FR-04`)
1. **Room Creation (`US-06`):** Host taps "Create Room". Server returns 4-digit PIN (e.g. `4829`) and QR string (`dontlift://room/4829`). Room enters `WAITING` state. Local `rooms` table row created.
2. **Room Join (`US-07`):** Member enters PIN or scans QR code. Cloud Function checks room status (`WAITING`), capacity (Free Host $\le 5$), and adds member to `rooms/{roomId}/members/{uid}`. Operation is idempotent. Member caches room metadata into local `rooms` and `room_members` tables.
3. **Lobby & Real-Time Listener (`US-08`):** Firestore real-time snapshot listener syncs participant list across all devices in real time and updates local `room_members` SQLite cache. Host sees "Start Session" button; Members see waiting banner.
4. **Session Active (`US-09`):** Host starts session. All devices trigger local motion detection (`FR-01`). Each confirmed violation writes to local SQLite and syncs to Firestore `rooms/{roomId}/violations/{eventId}`. Penalty Leaderboard updates across all connected clients within $\le 2\text{s}$.
5. **Early Exit Flow (`US-10`):**  
   - Member taps "Request Early Exit". Firestore document written to `rooms/{roomId}/requests/{reqId}`.  
   - Host receives banner prompt with "Approve" / "Deny".  
   - On Host Approval: Member's state changes to `EARLY_EXIT`. Sensor detection stops. Penalty Score is frozen at exit timestamp. Member remains in participant pool for bill splitting.  
   - On Host Denial: Member remains `ACTIVE`.
6. **Early Termination Vote (`US-11`):**  
   - Any active member taps "Initiate Termination Vote".  
   - Cloud Function creates `rooms/{roomId}/terminationVote` with a 30-second deadline.  
   - All active members receive interactive modal.  
   - If 100% of active members vote "Yes" within 30s $\rightarrow$ Cloud Function transitions room to `CANCELLED`. Session ends without bill settlement.  
   - If 30s elapses without 100% consensus $\rightarrow$ Cloud Function deletes vote document; modal dismissed; session continues uninterrupted.
7. **Host Session End (`US-12`):** Host taps "End Session". Cloud Function sets room to `COMPLETED`, computes final authoritative Penalty Scores, and navigates Host to Bill Settlement.

### 4.3 Bill Settlement & VietQR (`US-13` – `US-15`, `FR-05`)
1. **Total Bill Input (`US-13`):** Host enters total bill amount in VND (e.g. `350000`). Input validated as positive integer $\ge 1,000$.
2. **Calculation Engine (`US-14`):** Cloud Function executes Hybrid Bill Allocation algorithm (Section 5.2). Generates deterministic share per member.
3. **Host Override Option (`US-14`):** Host MAY manually set a specific VND share or percentage for specific members. Unassigned balance is automatically split equally among members with 0 violations.
4. **Breakdown Display (`US-14`):** Real-time snapshot updates members' UI with exact individual share, violation count, and penalty breakdown.
5. **VietQR Code Generation (`US-15`):**  
   - Member taps "Pay Share".  
   - Client generates NAPAS/VietQR compliant payload string:  
     `https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-compact2.png?amount=<SHARE_VND>&addInfo=DL%20<ROOM_PIN>%20<MEMBER_NAME>`  
   - Member scans QR using banking app to complete payment.
6. **Payment Status Tracking (`US-15`):** Payment state defaults to `UNPAID`. Host manually toggles member state to `MARKED_AS_PAID` upon receiving bank notification. DontLift does NOT execute custodial transfers or bank API polling.

### 4.4 Monetization & Activation Code (`US-19`, `FR-06`)
1. **Code Format:** `DONTLIFT-XXXX-XXXX-XXXX` (16 uppercase alphanumeric characters divided by hyphens).
2. **Verification Dual-Path:**  
   - **Offline Path:** Evaluates embedded Luhn/Checksum algorithm on string structure. If valid, grants local temporary premium entitlement in SQLite.  
   - **Online Path:** Cloud Function verifies code against `activationCodes/{code}` in Firestore, marks code as `redeemedBy = uid`, and sets `users/{uid}.is_premium = true`.
3. **Entitlement Unlocks:** Hides banner ads, removes 7-day violation log auto-purge, unlocks unlimited room capacity and unlimited monthly room creations.

---

## 5. Business Rules & Mathematical Specifications

### 5.1 Penalty Score Formula (`FR-01`)

$$\text{Penalty Score} = (N_{\text{lift}} \times W_{\text{lift}}) + (T_{\text{violation}} \times W_{\text{duration}})$$

Where:
- $N_{\text{lift}}$ = Total count of confirmed violations (integer $\ge 0$).
- $W_{\text{lift}}$ = Weight per lift violation (Fixed default: $10$).
- $T_{\text{violation}}$ = Total cumulative violation duration in integer seconds.
- $W_{\text{duration}}$ = Weight per violation second (Fixed default: $1$).

---

### 5.2 Hybrid Bill Allocation & Deterministic Splitting Algorithm (`FR-05`)

Given:
- Total Bill Amount: $B \in \mathbb{Z}^+$ (in VND, e.g. $500,000$).
- Participant count: $N$.
- Individual Penalty Scores: $S_i$ for $i \in \{1, \dots, N\}$.

#### Step 1: Base & Penalty Weight Split
- Base Weight $W_{\text{base}} = 0.40$ (40% of bill split equally).
- Penalty Weight $W_{\text{penalty}} = 0.60$ (60% of bill weighted by Penalty Score).
- Base Share Pool: $B_{\text{base}} = B \times W_{\text{base}}$
- Penalty Share Pool: $B_{\text{penalty}} = B \times W_{\text{penalty}}$

#### Step 2: Individual Share Calculation
Total Group Penalty Score: $S_{\text{total}} = \sum_{j=1}^N S_j$.

- **If $S_{\text{total}} = 0$ (Zero violations in entire group):**  
  $$P_i = \frac{B}{N} \quad \forall i \in \{1, \dots, N\}$$

- **If $S_{\text{total}} > 0$:**  
  $$P_i = \left( \frac{B_{\text{base}}}{N} \right) + \left( B_{\text{penalty}} \times \frac{S_i}{S_{\text{total}}} \right)$$

#### Step 3: Host Manual Override Handling (If Applied)
If Host manually assigns fixed amount $O_m$ to subset of members $M \subset \{1, \dots, N\}$:
1. Deduct overrides from total bill: $B_{\text{rem}} = B - \sum_{m \in M} O_m$.
2. Distribute $B_{\text{rem}}$ among non-overridden members using Step 2 formula over remaining participants.

#### Step 4: Deterministic 1,000 VND Rounding & Remainder Distribution
1. Initial 1,000 VND Rounding:  
   $$P_i' = \text{round}\left( \frac{P_i}{1000} \right) \times 1000$$
2. Discrepancy Calculation:  
   $$\Delta = B - \sum_{i=1}^N P_i'$$
3. Remainder Adjustment:  
   - Sort participants by rounding residual $R_i = P_i - P_i'$ descending.  
   - If $\Delta > 0$, add $+1,000$ VND to the top $\frac{\Delta}{1000}$ participants in residual rank.  
   - If $\Delta < 0$, subtract $-1,000$ VND from the bottom $\frac{|\Delta|}{1000}$ participants in residual rank.  
4. Invariant Assertion: $\sum_{i=1}^N P_i'' = B$ exactly. Zero mathematical discrepancy.

---

### 5.3 Retention Purge Engine (`FR-06`)
- Executed on local SQLite database at application startup and daily background task:
  ```sql
  DELETE FROM violation_logs 
  WHERE created_at < DATETIME('now', '-7 days') 
    AND (SELECT is_premium FROM entitlements LIMIT 1) = 0;
  ```

---

## 6. Data Architecture, Persistence & Offline Reconciliation

### 6.1 SQLite Local Database Schema (`FR-02`)

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL, -- UUIDv4
    mode TEXT CHECK(mode IN ('COUNTDOWN', 'STOPWATCH', 'GROUP')) NOT NULL,
    status TEXT CHECK(status IN ('CREATED', 'ACTIVE', 'COMPLETED', 'CANCELLED')) NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    synced_at TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY NOT NULL, -- Room ID string / UUID
    host_id TEXT NOT NULL,
    pin TEXT NOT NULL,
    status TEXT CHECK(status IN ('CREATED', 'WAITING', 'ACTIVE', 'COMPLETED', 'CANCELLED')) NOT NULL DEFAULT 'CREATED',
    participant_count INTEGER NOT NULL DEFAULT 1,
    total_bill INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT,
    sync_status TEXT CHECK(sync_status IN ('PENDING', 'SYNCED', 'FAILED')) DEFAULT 'PENDING'
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_host_id ON rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_rooms_pin ON rooms(pin);

CREATE TABLE IF NOT EXISTS room_members (
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT CHECK(status IN ('ACTIVE', 'EARLY_EXIT')) NOT NULL DEFAULT 'ACTIVE',
    penalty_score INTEGER NOT NULL DEFAULT 0,
    lift_count INTEGER NOT NULL DEFAULT 0,
    violation_duration INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);

CREATE TABLE IF NOT EXISTS violation_logs (
    event_id TEXT PRIMARY KEY NOT NULL, -- UUIDv4
    session_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER DEFAULT 0,
    sync_status TEXT CHECK(sync_status IN ('PENDING', 'SYNCED', 'FAILED')) DEFAULT 'PENDING',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entitlements (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Single row enforcement
    is_premium INTEGER NOT NULL DEFAULT 0,
    activation_code TEXT,
    activated_at TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);
```

---

### 6.2 Firestore Data Model (`FR-03`)

```
/users/{uid}
  ├── displayName: string
  ├── email: string
  ├── is_premium: boolean
  └── createdAt: timestamp

/rooms/{roomId}
  ├── hostId: string
  ├── pin: string (indexed)
  ├── status: "CREATED" | "WAITING" | "ACTIVE" | "COMPLETED" | "CANCELLED"
  ├── participantCount: number
  ├── totalBill: number | null
  ├── createdAt: timestamp
  │
  ├── /members/{uid}
  │     ├── displayName: string
  │     ├── status: "ACTIVE" | "EARLY_EXIT"
  │     ├── penaltyScore: number
  │     ├── liftCount: number
  │     ├── violationDuration: number
  │     └── joinedAt: timestamp
  │
  ├── /violations/{eventId}
  │     ├── eventId: string
  │     ├── userId: string
  │     ├── startedAt: timestamp
  │     ├── endedAt: timestamp
  │     └── durationSeconds: number
  │
  └── /billShares/{uid}
        ├── shareVnd: number
        ├── paymentStatus: "UNPAID" | "MARKED_AS_PAID"
        └── updatedAt: timestamp
```

---

### 6.3 Offline Sync Queue & Idempotency Rules (`FR-02`)
1. **Local Write First:** Every violation event is written immediately to local SQLite `violation_logs` with `sync_status = 'PENDING'` and a generated UUID `event_id`. Room changes write locally to `rooms` with `sync_status = 'PENDING'`.
2. **Background Sync Worker:**  
   - Listens to network status via Expo NetInfo.  
   - When online, queries all rows WHERE `sync_status == 'PENDING'`.  
   - Executes batch `setDoc` to Firestore `/rooms/{roomId}/violations/{eventId}` with `{ merge: true }`.
3. **Idempotency Guarantee:** Firestore document key is set directly to the local SQLite UUID `event_id`. Retries or duplicate submissions write to the exact same document path without duplicating entries or score calculations.
4. **Reconciliation:** Upon successful Firestore write acknowledgment, SQLite updates `sync_status = 'SYNCED'`.

---

## 7. Required UI States & Error Handling Specification

Every UI screen MUST implement explicit state rendering across the 5 canonical UI states:

| Screen | Loading State | Empty State | Error State | Offline State | Syncing State |
|--------|---------------|-------------|-------------|---------------|---------------|
| **Auth / Login** | Spinner on button; fields disabled | Blank form with placeholders | Inline form alert: `"Invalid email or password"` | Offline banner: `"Internet connection required to log in"` | N/A |
| **Room Lobby (`US-08`)** | Skeleton list of participant slots | Card: `"Waiting for host to start..."` | Modal: `"Room expired or invalid PIN"` | Top banner: `"Reconnecting to room..."` | Badge: `"Syncing members..."` |
| **Active Focus (`US-09`)** | Sensor initialization overlay | N/A | Alert: `"Accelerometer unavailable on this device"` | Subtitle: `"Tracking offline. Scores sync when reconnected"` | Pulse dot: `"Syncing violations..."` |
| **Bill Settlement (`US-14`)** | Shimmer cards for calculated shares | Banner: `"Host has not entered bill total yet"` | Toast: `"Failed to calculate shares. Retry"` | Card banner: `"Showing cached bill split"` | Spinner on Host override submit |
| **Activation (`US-19`)** | Button spinner: `"Verifying code..."` | Blank code input mask | Text under input: `"Invalid activation code pattern or already redeemed"` | Badge: `"Validated offline via checksum"` | Spinner: `"Syncing entitlement..."` |

---

## 8. Requirements Traceability Matrix

| Specification Section | PRD User Story | Functional Requirement |
|-----------------------|----------------|------------------------|
| **1. Auth & Identity** | `US-01`, `US-02` | `N/A` |
| **2. Protected Access** | `US-06`, `US-07`, `US-08`, `US-12` | `FR-04` |
| **3. Lifecycle State Machine** | `US-03`, `US-06`, `US-11`, `US-12` | `FR-04` |
| **4.1 Solo Focus Mode** | `US-03`, `US-04`, `US-05` | `FR-01`, `FR-02` |
| **4.2 Group Room Mode** | `US-06`, `US-07`, `US-08`, `US-09`, `US-10`, `US-11`, `US-12` | `FR-03`, `FR-04` |
| **4.3 Bill Settlement & VietQR** | `US-13`, `US-14`, `US-15` | `FR-05` |
| **4.4 Monetization & Activation** | `US-19` | `FR-06` |
| **5. Business Rules & Math** | `US-04`, `US-05`, `US-14`, `US-16` | `FR-01`, `FR-05`, `FR-06` |
| **6. Data & Offline Sync** | `US-04`, `US-09`, `US-16` | `FR-02`, `FR-03` |
| **7. Required UI States** | All User Stories | All Functional Requirements |

---

## 9. Validation Checklist

- [x] **Success Behavior:** Every primary action (Registration, Room Join, Motion Violation Logging, Early Exit, Termination Vote, Bill Allocation, VietQR Generation) has an explicit success path defined.
- [x] **Failure Behavior:** Clear error handling and messaging specified for invalid credentials, duplicate rooms, full rooms, motion sensor dropouts, expired termination votes, and invalid activation codes.
- [x] **Recovery Behavior:** Offline event queuing in SQLite with UUID idempotency handles transient network failure recovery without data duplication.
- [x] **Persistence:** Local SQLite schemas (including `sessions`, `rooms`, `room_members`, `violation_logs`, `entitlements`) and Firestore document models strictly defined.
- [x] **Authorization:** RBAC matrix specifies Host vs Member permissions enforced at both Firestore Security Rule and UI layers.
- [x] **Destructive Actions:** Early Exit, Session Termination, and Host End Session require explicit user interaction confirmation.
