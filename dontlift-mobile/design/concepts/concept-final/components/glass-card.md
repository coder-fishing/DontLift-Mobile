# Component: Glass Card (`glass-card.md`)

- **Name:** Glass Card / Acrylic Card Panel
- **Status:** Extracted (Appears in all 10 screens)
- **Screen References:**
  - `01-login.html` (`.acrylic-card`)
  - `02-solo-focus-select.html` (`.frosted-glass`)
  - `03-solo-focus-timer.html` (`.frosted-glass`)
  - `04-solo-summary.html` (`.frosted-panel`)
  - `05-group-lobby.html` (`.frosted-glass`)
  - `06-group-active.html` (`.frosted-glass`)
  - `07-host-bill-allocation.html` (`.frosted-glass`)
  - `08-member-bill-settlement.html` (`.frosted-glass`)
  - `09-activation.html` (`.real-frosted-glass`)
  - `10-hardware-error.html` (`.frosted-glass`)

---

## Visual Treatment
- **Background Fill:** `rgba(255, 255, 255, 0.32)` to `rgba(255, 255, 255, 0.35)`
- **Backdrop Blur:** `blur(40px) saturate(160%)` to `blur(40px) saturate(180%)`
- **Border:** `1px solid rgba(255, 255, 255, 0.90)`
- **Shadow Matrix:** `inset 1px 1px 2px 0px rgba(255, 255, 255, 0.95), inset -1px -1px 2px 0px rgba(255, 255, 255, 0.25), 0 8px 32px rgba(0, 0, 0, 0.08)`
- **Border Radius:** `24px` (`rounded-3xl` / `rounded-2xl`)

---

## Props / Variants
- `variant`: `'default'` (35% fill), `'inset'` / `'nested'` (`rgba(255, 255, 255, 0.25)`, `radius 16px`), `'alert'` (`border-red-300/80` / `border-amber-300`)
- `padding`: `'sm'` (12px / `p-3`), `'md'` (16px / `p-4`), `'lg'` (20px-24px / `p-5` or `p-6`)

---

## States
- **Default:** Translucent glass surface with light specular highlight.
- **Focused / Active:** Background fill shifts to `rgba(255, 255, 255, 0.50)` or border tint changes to primary blue (`rgba(37, 99, 235, 0.8)`).
- **Alert / Warning:** Border color shifts to red/amber stroke (`border-red-400/80`).

---

## Accessibility Notes
- Contrast ratio: Slate text `#0F172A` over 35% white glass panel meets WCAG AA standards (≥ 4.5:1).
