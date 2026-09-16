# Component: Input Field (`input-field.md`)

- **Name:** Frosted Glass Input Field
- **Status:** Extracted (Appears in 3 screens: `01-login.html`, `07-host-bill-allocation.html`, `09-activation.html`)
- **Screen References:**
  - `01-login.html` (Email / Username input)
  - `07-host-bill-allocation.html` (Total Bill Amount input)
  - `09-activation.html` (Pro License Code segmented input)

---

## Visual Treatment
- **Background Fill:** Translucent inset glass (`.acrylic-input` / `.glass-input`, `rgba(255, 255, 255, 0.35)` to `rgba(255, 255, 255, 0.25)`)
- **Backdrop Blur:** `blur(40px) saturate(160%)`
- **Border:** `1px solid rgba(255, 255, 255, 0.90)`
- **Shadow:** `inset 1px 1px 2px rgba(255, 255, 255, 0.95), inset -1px -1px 2px rgba(255, 255, 255, 0.25), 0 2px 10px rgba(0, 0, 0, 0.04)`
- **Border Radius:** `16px` (`rounded-xl` / `rounded-2xl`)

---

## Props / Variants
- `label`: string
- `placeholder`: string
- `value`: string
- `type`: `'text'` | `'number'` | `'code'`
- `error`: optional string

---

## States
- **Default:** Subtle frosted glass inset box with muted placeholder text (`text-slate-400`).
- **Focus:** `background: rgba(255, 255, 255, 0.50)`, `border-color: rgba(37, 99, 235, 0.8)`, focus ring `0 0 0 3px rgba(37, 99, 235, 0.18)`.
- **Error:** `border-red-400 bg-red-500/5`.

---

## Accessibility Notes
- Always paired with visible `<label>` text or aria-label attributes.
