# Component: Status Badge (`status-badge.md`)

- **Name:** Translucent Status Pill Badge
- **Status:** Extracted (Appears in all 10 screens)
- **Screen References:**
  - `01-login.html` through `10-hardware-error.html` (`.acrylic-pill`, `.frosted-glass-pill`, `.real-frosted-pill`)

---

## Visual Treatment
- **Container:** Pill shape (`rounded-full`, `px-3 py-1` or `px-2.5 py-0.5`).
- **Background Fill:** Translucent glass (`rgba(255, 255, 255, 0.38 - 0.45)`).
- **Backdrop Blur:** `blur(28px) saturate(160%)`.
- **Border:** `1px solid rgba(255, 255, 255, 0.90 - 0.95)`.
- **Inner Content:** Flex row with 6px pulsing color dot (`w-1.5 h-1.5 rounded-full animate-pulse`) + uppercase font-label-mono text (`text-[11px]` / `text-xs`).

---

## Props / Variants
- `status`: `'synced'` (Emerald `#10b981`) | `'offline'` (Amber `#f59e0b`) | `'host'` (Primary Blue `#2563eb`) | `'alert'` (Red `#ef4444`)

---

## States
- **Synced:** Green dot + "Synced" / "Sync Ready" text.
- **Offline:** Amber dot + "Offline Mode Ready" text.
- **Host Badge:** Primary blue dot + "HOST" text.

---

## Accessibility Notes
- Combines colored dot indicator with explicit text string for color-blind accessibility.
