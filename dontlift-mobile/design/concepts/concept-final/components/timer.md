# Component: Timer (`timer.md`)

- **Name:** Focus Timer Display & Progress Ring
- **Status:** Extracted (Appears in 2 screens: `03-solo-focus-timer.html`, `06-group-active.html`)
- **Screen References:**
  - `03-solo-focus-timer.html` (Primary serene focus core timer display)
  - `06-group-active.html` (Group active session timer display)

---

## Visual Treatment
- **Typography:** `JetBrains Mono`, 48px – 64px (`text-5xl` / `text-6xl`), line-height 56px, letter-spacing -0.03em, font-weight 700 / 800, color `#0F172A`.
- **Container:** Housed inside a `frosted-glass` card (`p-6 flex flex-col items-center justify-center`).
- **Background Glow / Progress:** Circular SVG ring or ambient color bloom behind timer text (`bg-indigo-300/40 blur-3xl`).

---

## Props / Variants
- `mode`: `'solo'` | `'group'`
- `timeString`: string (e.g. `'24:52'`, `'44:18'`)
- `status`: `'active'` | `'paused'` | `'grace_period'` | `'completed'`

---

## States
- **Active Focus:** Clean mono time readout with steady ambient glow.
- **Grace Period Alert:** Timer text or ring turns warning red/amber with pulse effect.
- **Completed:** Displays `00:00` or completion checkmark icon.

---

## Accessibility Notes
- Font family `JetBrains Mono` ensures fixed-width numbers preventing horizontal layout jitter as seconds tick down.
