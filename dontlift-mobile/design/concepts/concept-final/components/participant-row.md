# Component: Participant Row (`participant-row.md`)

- **Name:** Group Session Participant Row
- **Status:** Extracted (Appears in 2 screens: `05-group-lobby.html`, `06-group-active.html`)
- **Screen References:**
  - `05-group-lobby.html` (Lobby participant list)
  - `06-group-active.html` (Active room participant grid / list)

---

## Visual Treatment
- **Container:** Translucent glass item pod (`frosted-glass-pill` or inset card `p-3 rounded-2xl`).
- **Layout:** Avatar with status dot indicator, participant display name, role pill (Host / Member), phone-down status badge, and readiness indicator.

---

## Props / Variants
- `name`: string
- `role`: `'host'` | `'member'`
- `phoneState`: `'down'` | `'lifted'` | `'waiting'`
- `isReady`: boolean

---

## States
- **Phone Down (Focused):** Green dot + "Phone Down" badge (`text-emerald-700 bg-emerald-500/10`).
- **Phone Lifted (Violation):** Red/Amber pulse dot + "Phone Lifted" warning pill.
- **Waiting / Lobby Ready:** Blue/Slate checkmark indicator.

---

## Accessibility Notes
- Status dots pair color with explicit text labels ("Phone Down", "Lifted") to ensure accessibility for color-blind users.
