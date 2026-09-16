# Component: Secondary CTA Button (`secondary-cta.md`)

- **Name:** Secondary Glass Button / Action Pill
- **Status:** Extracted (Appears in multiple screens: 01, 02, 04, 05, 07, 08, 09, 10)
- **Screen References:**
  - `01-login.html` ("Continue as Guest")
  - `02-solo-focus-select.html` ("Custom Duration")
  - `04-solo-summary.html` ("Share Summary")
  - `05-group-lobby.html` ("Invite via QR")
  - `07-host-bill-allocation.html` ("Reset Form")
  - `08-member-bill-settlement.html` ("Download QR Image")
  - `09-activation.html` ("Buy Key online")
  - `10-hardware-error.html` ("Open System Settings")

---

## Visual Treatment
- **Background Fill:** Translucent Glass (`.acrylic-button-sec` / `.frosted-glass-pill`, `rgba(255, 255, 255, 0.38 - 0.45)`)
- **Backdrop Blur:** `blur(28px)` to `blur(40px)`
- **Border:** `1px solid rgba(255, 255, 255, 0.90)`
- **Typography:** Slate text (`text-[#0F172A]` / `text-slate-800`), font weight `font-bold` / `font-semibold`

---

## Props / Variants
- `label`: string
- `icon`: optional string
- `variant`: `'pill'` | `'button'`

---

## States
- **Default:** Translucent glass fill with specular light top border.
- **Hover / Active:** `hover:bg-white/50 active:scale-[0.98]`

---

## Accessibility Notes
- Uses dark slate text over light glass for WCAG AA contrast.
