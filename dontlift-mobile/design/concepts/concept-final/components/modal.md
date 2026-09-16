# Component: Modal Overlay (`modal.md`)

- **Name:** Glass Overlay Dialog / Sheet Modal
- **Status:** Extracted (Appears in 3 screens: `03-solo-focus-timer.html` grace overlay card, `05-group-lobby.html` state previews accordion modal, `08-member-bill-settlement.html` toast overlay)
- **Screen References:**
  - `03-solo-focus-timer.html` (`#grace-card` / notification overlay panel)
  - `05-group-lobby.html` (Interactive state preview modal overlay)
  - `08-member-bill-settlement.html` (`#toastNotification` bottom glass toast sheet)

---

## Visual Treatment
- **Backdrop Overlay:** `fixed inset-0 bg-slate-900/30 backdrop-blur-md z-50`
- **Dialog Panel:** `frosted-glass` card (`rgba(255, 255, 255, 0.40 - 0.90)`, `border-white/90`, `shadow-2xl`, `rounded-3xl`, `p-6`)
- **Animation:** Fade in + scale up (`transition-all duration-300`)

---

## Props / Variants
- `title`: string
- `description`: string
- `primaryActionLabel`: string
- `secondaryActionLabel`: string
- `isOpen`: boolean

---

## States
- **Open:** Dialog centered or anchored to bottom sheet position with backdrop blur active.
- **Closed:** `hidden` / `pointer-events-none opacity-0`.

---

## Accessibility Notes
- Modal intercepts focus; includes dismiss trigger or backdrop tap close handler.
