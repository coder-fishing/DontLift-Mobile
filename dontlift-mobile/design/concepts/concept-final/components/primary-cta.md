# Component: Primary CTA Button (`primary-cta.md`)

- **Name:** Primary Action Button
- **Status:** Extracted (Appears in multiple screens: 01, 02, 04, 05, 07, 08, 09, 10)
- **Screen References:**
  - `01-login.html` ("Sign In with Google")
  - `02-solo-focus-select.html` ("Start Solo Session")
  - `04-solo-summary.html` ("Done & Return Home")
  - `05-group-lobby.html` ("Start Group Session")
  - `07-host-bill-allocation.html` ("Confirm Allocation & Request Settlement")
  - `08-member-bill-settlement.html` ("I Have Paid via VietQR")
  - `09-activation.html` ("Activate Pro License")
  - `10-hardware-error.html` ("Re-check Sensors")

---

## Visual Treatment
- **Background Fill:** Solid Primary Blue (`bg-primary` / `bg-[#2563eb]` / `bg-[#004ac6]`)
- **Typography:** Text white (`text-white`), font weight `font-bold` / `font-extrabold`, size `text-sm` or `text-base`
- **Shape & Shadow:** `w-full py-3.5` (or `py-4`), `rounded-2xl` / `rounded-xl`, shadow `shadow-md shadow-primary/25` / `shadow-lg shadow-blue-500/30`

---

## Props / Variants
- `label`: string
- `icon`: optional string (Material symbol name)
- `fullWidth`: boolean (default true)
- `disabled`: boolean

---

## States
- **Default:** Solid blue background with white text and drop shadow.
- **Pressed / Active:** `active:scale-[0.98] transition-transform`
- **Disabled:** `opacity-50 pointer-events-none bg-slate-400`

---

## Accessibility Notes
- High contrast: White text on `#2563eb` primary blue achieves > 4.5:1 WCAG ratio. Minimum touch height ≥ 44px (`py-3.5`).
