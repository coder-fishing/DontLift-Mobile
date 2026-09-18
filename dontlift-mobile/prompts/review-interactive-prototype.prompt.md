# P4.5 — Review the Interactive Prototype

> * **Role:** REVIEW GATE
> * **Skills:** `/skill:product-design-audit` (required), `/skill:react-native-expert` (supporting: assess implementation-state gaps)
> * **Interaction mode:** inspect-and-report
> * **Output mode:** review findings
> * **Approval gate:** Human accepts corrections before the design record changes
> * **Updates:** `../docs/product-design.md` after human review
> * **Run context:** Fresh session; attach or provide every input below.

## Use This When

The static prototype runs and you need observable UX, responsive, and accessibility findings before accepting it.

## Inputs

* **Accepted design brief:** `product-design-brief.md`
* **Selected design:** `\design\concepts\concept-final`
* **Running static prototype:** `prototype` and `src`

## Task

Use `/skill:product-design-audit` to capture and inspect the following flows:

### 1. Log In — Sign Up

* Enter phone number and 6-digit PIN.
* Implements an offline-first security mechanism using SQLite; does not rely on an intermediary server.
* Registration requires:

  * Full name
  * Email
  * Password
  * Password confirmation

### 2. Time Selection

* Focus sessions:

  * **25m** — Pomodoro
  * **45m** — Deep Work Flow
  * **60m** — Total Immersion
* Customizable time increments using **Custom Dial Stepper ±5m**.
* Stopwatch mode.

### 3. Solo Timer

* Large arc countdown timer.
* Phone gyroscope-based lock/unlock mechanism.
* 3-second simulation / grace period:

  * Press the **Elevator Simulation** button to test the alert feature.
  * Position the phone correctly.

### 4. Solo Summary

* Statistics:

  * 100% successful press rate
  * Streak
  * Zero penalty points
* SQLite telemetry log.

### 5. Group Lobby

* Room code: `#8821`
* PIN copy button.
* Member list:

  * Alex Rivers
  * Minh Tran
  * Sarah Jenkins
  * David K
* Member statuses such as:

  * Grounded
  * Ready
  * Calibrating
  * etc.

### 6. Active Group Session

* Real-time group countdown timer.
* Violation leaderboard:

  * Update rankings for remaining participants.
  * Calculate penalties in real time.

### 7. Bill Allocation

* Host enters the total amount, e.g. `550,000 VND`.
* Automatically calculate each member's amount based on the formula:

  * **40%** split equally.
  * **60%** allocated based on violation rates.

### 8. VietQR P2P Settlement

* Display the amount due per member, e.g. `165,000 VND`.
* VietQR code for direct P2P transfer.
* Transfer memo copy function.
* Payment confirmation button.

### 9. Pro Activation

* Input field for license key, e.g. `DL-PRO-2026-X99`.
* Unlock:

  * Unlimited group features.
  * Permanent telemetry storage.

### 10. Hardware Diagnostics — `Screen10HardwareError`

Check the health of:

* Accelerometer
* Gyroscope — 50Hz
* Tabletop leveling button

## Navigation

Implement the navigation bar menu based on the approved design/concept.

## Review Requirements

For each **confirmed issue**, report:

1. **Evidence** — Observable evidence from the prototype or implementation.
2. **Impact** — Effect on UX, accessibility, responsiveness, or interaction.
3. **Affected interaction** — The specific flow, screen, or state affected.
4. **Smallest correction** — The minimum change required to resolve the issue.

Use `$frontend-expert` to distinguish:

* A visible UI/UX defect.
* A state-handling implementation gap.
* A responsive implementation gap.

Do **not** change the design record until findings have been reviewed and accepted by a human.

## Constraints and Source Precedence

Use the following precedence when evaluating findings:

1. **Accepted design artifacts and human decisions**
2. **Evidence captured in this review run**
3. **AI suggestions**

Additional constraints:

* Do not report a preference as a defect.
* Do not redesign product scope.
* Do not introduce backend behavior.

## Expected Output

Produce a prioritized review containing:

* **Confirmed findings**
* **Accepted corrections**
* **Deferred risks**
* **Evidence limits**
* Explicit **Not run** checks
* Explicit **Blocked** checks

The review must clearly distinguish between confirmed defects, implementation-state gaps, risks, and checks that could not be verified.

## Save or Update

After human review, update:

`../docs/product-design.md`

Only add:

* Accepted corrections
* Deferred risks

Do not update the design record before human approval.

## Human Review Required

The human must:

1. Review the reported findings.
2. Approve the proposed corrections.
3. Accept any remaining risks.

Only after this review should the prototype be treated as an **accepted reference**.

## Verification Checklist

* [ ] Glass-effect concept
* [ ] Keyboard navigation functions correctly.
* [ ] Narrow display modes function correctly.
* [ ] Reduced motion settings function correctly.
* [ ] Interaction flows function correctly across supported states.
* [ ] Navigation matches the approved design/concept.
* [ ] Prototype matches the selected design concept.
* [ ] Responsive behavior matches the accepted design.
* [ ] Accessibility behavior is observable and functional.
* [ ] No confirmed implementation gaps remain unreported.
* [ ] All unverified items are explicitly marked **Not run** or **Blocked**.
