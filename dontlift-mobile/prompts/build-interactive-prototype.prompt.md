# P4.4 — Build Interactive Prototype

* **Role:** PRIMARY
* **Skills:** `/skill:react-native-expert` (mandatory), `/skill:brainstorming` (conditional: when approved interactions conflict with development constraints)
* **Interaction Method:** Planning and approval
* **Method Output:** Source code modifications
* **Approval Checkpoint:** Confirmation of the selected direction and resolution of any conflicts prior to modifying the prototype
* **Standard Output:** `dontlift-mobile-design/prototype/`
* **Execution Context:** New working version; attach or provide all inputs listed below.
## Use Case
The user has selected a design based on the guidelines, and a one-off static prototype is required to evaluate compatibility.
## Data Inputs
* Approved design brief: `product-design-brief.md`
* Approved direction: `product-design.md`
* UI design: `design/concepts`
* Selected concept and user evaluation notes
## Tasks
Use `/skill:react-native-expert` to implement the following functions:
### 1. Log In — Sign Up
* Enter phone number and 6-digit PIN.
* Implements an offline-first security mechanism using SQLite; does not rely on an intermediary server.
* Registration requires full name, email, password, and password confirmation.
### 2. Time Selection
* Focus sessions:
  * 25m — Pomodoro
  * 45m — Deep Work Flow
  * 60m — Total Immersion
* Customizable time increments using Custom Dial Stepper ±5m.
* Stopwatch mode.
### 3. Solo Timer 
* Large arc countdown timer.
* Phone gyroscope-based lock/unlock mechanism.
* 3-second simulation (3-second grace period):
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
  * 40% split equally.
  * 60% allocated based on violation rates.
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
* Check the health of:
  * Accelerometer
  * Gyroscope — 50Hz
  * Tabletop leveling button
### Navigation
* Implement the navigation bar menu based on the approved design/concept.
## Prototype Constraints
* Please review the current prototype before making changes.
* Use `/skill:react-native-expert` for implementation.
* If an approved interaction cannot be developed without significant changes to content or functionality, use `/skill:brainstorming` to discuss the matter with the user and await a decision.
* The prototype must not rely on external libraries or backend systems.
* Reset the state upon page reload.
* Adhere to approved guidelines regarding:
  * Materials
  * Contrast
  * Focus states
  * Glass effects
* Do not copy reference materials directly.
* Do not introduce unsupported actions.
## Priority of Authorized Source Information
1. User-approved interaction decisions
2. Accepted design deliverables
3. Selected concepts
4. AI-proposed development options
## Expected Deliverables
Updated files:
* `prototype/index.tsx`
* `prototype/styles.css`
* Any related files required to run the prototype
## Saving or Updating
* Edit only the prototype files listed above.
* Document design decisions separately via the designated review process.
* Do not unilaterally alter the design of previously approved interactions.
## User Review Required
The user will evaluate the functional prototype before it is considered the official design specification.
## Verification Checklist
Verify that:
* Interactions function correctly without backend support.
* Error states retain user input and provide guidance for the next step.
* The following states can be evaluated:
  * Empty state
  * Selection shortcuts
  * Expanded state
  * Collapsed view
  * Reduced motion mode