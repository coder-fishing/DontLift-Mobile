# Component: Leaderboard Row (`leaderboard-row.md`)

- **Name:** Penalty & Focus Leaderboard Row
- **Status:** Extracted (Appears in 2 screens: `04-solo-summary.html`, `06-group-active.html`)
- **Screen References:**
  - `04-solo-summary.html` (Solo summary rank breakdown)
  - `06-group-active.html` (Group penalty leaderboard tray)

---

## Visual Treatment
- **Container:** Inset glass subpanel (`frosted-inner-item` / `frosted-subpanel`, `rgba(255, 255, 255, 0.25 - 0.32)`, `border-white/85`, `rounded-xl`).
- **Layout:** Flex row with rank badge (1st/2nd/3rd or #1/#2), avatar circle, participant name, focus percentage / violation count, and penalty VND amount.

---

## Props / Variants
- `rank`: number (1, 2, 3...)
- `name`: string
- `violations`: number
- `penaltyVnd`: number (e.g. `0 ₫`, `35.000 ₫`)
- `isHost`: boolean

---

## States
- **Zero Penalty / Leader:** Green pill badge (`0 ₫` penalty, `bg-emerald-500/10 text-emerald-700`).
- **Penalized:** Amber/Red penalty amount pill (`35.000 ₫`, `bg-red-500/10 text-red-600 font-bold`).

---

## Accessibility Notes
- Monetary amounts formatted with explicit currency suffix `₫` and standard Vietnamese number separator (period).
