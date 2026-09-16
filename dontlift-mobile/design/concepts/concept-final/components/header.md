# Component: Header (`header.md`)

- **Name:** Top Chrome Header & Status Bar
- **Status:** Extracted (Appears in all 10 screens)
- **Screen References:**
  - `01-login.html` through `10-hardware-error.html` (`.acrylic-chrome-header`, `.frosted-header`, `.header-glass`)

---

## Visual Treatment
- **Background Fill:** `rgba(255, 255, 255, 0.35)` to `rgba(255, 255, 255, 0.40)`
- **Backdrop Blur:** `blur(40px) saturate(180%)`
- **Border:** `border-bottom: 1px solid rgba(255, 255, 255, 0.85)`
- **Shadow:** `0 4px 20px rgba(0, 0, 0, 0.03)`
- **Height / Layout:** `pt-safe`, 2-row layout:
  - Top row: Status bar (`h-6`, time `9:41`, signal/wifi/battery icons)
  - Bottom row: App bar (`h-14`, Logo + title "DontLift", mode subtitle, Sync/Offline status pill, User avatar button)

---

## Props / Variants
- `subtitle`: `'Solo Focus'` | `'Group Room Mode'` | `'Host Allocation'` | `'Hardware Diagnostics'`
- `showBack`: boolean (shows back arrow button `arrow_back_ios_new` when true, e.g. in screen 03)
- `syncStatus`: `'synced'` | `'offline'` | `'syncing'`

---

## States
- **Normal:** Translucent header glass locked at top (`fixed top-0 z-50`).
- **Synced:** Green pulse dot + "Synced" text.
- **Offline:** Amber pulse dot + "Offline Mode Ready" text.

---

## Accessibility Notes
- Safe area inset padding (`pt-safe`) handles iOS notch and dynamic island.
