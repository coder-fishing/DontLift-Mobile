# Component: Violation Row (`violation-row.md`)

- **Name:** Real-time Violation Event Row
- **Status:** Extracted (Appears in 3 screens: `03-solo-focus-timer.html`, `04-solo-summary.html`, `06-group-active.html`)
- **Screen References:**
  - `03-solo-focus-timer.html` (Violation Log Tray)
  - `04-solo-summary.html` (Solo Summary Violation Breakdown)
  - `06-group-active.html` (Group Active Session Violation Feed)

---

## Visual Treatment
- **Container:** Inset glass item (`frosted-inner-item` / `glass-card-nested`, `p-3 rounded-xl`).
- **Layout:** Flex row with alert icon (`warning` / `phone_iphone`), timestamp in `JetBrains Mono` (`14:22:05`), event detail ("Phone Lifted for 8s"), duration badge, and calculated penalty cost.

---

## Props / Variants
- `timestamp`: string (e.g. `'14:22:05'`)
- `durationSeconds`: number (e.g. `8`)
- `penaltyVnd`: number (e.g. `10.000 ₫`)
- `participantName`: optional string (for group mode)

---

## States
- **Grace Period Resolved (No Penalty):** Green check mark ("Lifted < 3s — Grace Period Applied").
- **Penalty Incurred:** Red/Amber badge with duration and penalty amount ("Lifted 8s — Penalty: 10.000 ₫").

---

## Accessibility Notes
- Duration and penalty values formatted in bold JetBrains Mono typography for precise readouts.
