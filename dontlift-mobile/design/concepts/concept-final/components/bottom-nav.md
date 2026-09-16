# Component: Bottom Navigation (`bottom-nav.md`)

- **Name:** Bottom Navigation Bar
- **Status:** Extracted (Appears in 9 screens: 01, 02, 04, 05, 06, 07, 08, 09, 10; omitted in active solo timer 03)
- **Screen References:**
  - `01-login.html` (`.acrylic-chrome-nav`)
  - `02-solo-focus-select.html` (`.frosted-bottom-nav`)
  - `04-solo-summary.html` (`.frosted-nav`)
  - `05-group-lobby.html` (`.nav-glass`)
  - `06-group-active.html` (`.bottom-nav-glass`)
  - `07-host-bill-allocation.html` (`.nav-glass`)
  - `08-member-bill-settlement.html` (`.nav-glass`)
  - `09-activation.html` (`.nav-glass`)
  - `10-hardware-error.html` (`.nav-glass`)

---

## Visual Treatment
- **Background Fill:** `rgba(255, 255, 255, 0.40)` to `rgba(255, 255, 255, 0.45)`
- **Backdrop Blur:** `blur(40px) saturate(180%)`
- **Border:** `border-top: 1px solid rgba(255, 255, 255, 0.85)` to `rgba(255, 255, 255, 0.90)`
- **Shadow:** `0 -4px 24px rgba(0, 0, 0, 0.04)` to `0 -8px 32px rgba(0, 0, 0, 0.06)`
- **Height / Layout:** Fixed bottom navigation, `h-16` (64px), `pb-safe`, 4 tab items (Solo Focus, Group Room, Settlement, Activation). Home indicator pill `w-32 h-1 bg-slate-900/20` centered at bottom.

---

## Props / Variants
- `activeTab`: `'solo-focus'` | `'group-room'` | `'settlement'` | `'activation'`

---

## States
- **Active Tab:** Text color `text-primary` (`#004ac6` / `#2563eb`), font weight `font-bold` / `font-extrabold`, icon filled or vibrant color.
- **Inactive Tab:** Text color `text-[#334155]` / `text-on-surface-variant` (`#434655`), font weight `font-medium`, icon outline.

---

## Accessibility Notes
- Touch targets: Minimum 64px width × 44px height per tab option (`min-w-[64px] min-h-[44px]`).
- Uses `aria-current="page"` on selected tab link.
