# Liquid Acrylic (Real Frosted Glass) — Design System Specification

> **Source of Truth:** `design/concepts/concept-final/styles/glass.css` and HTML screens `01-login.html` through `10-hardware-error.html`.
> **Project:** DontLift Mobile (`projects/16602532424212421306`)
> **Constraint:** Extracted strictly from code. No invented values.

---

## 1. Color Palette Tokens

### Canvas & Substrate
- **Background Base (`--color-canvas-bg` / `--color-surface`):** `#faf8ff`
- **Canvas Gradient Mesh (`--color-canvas-gradient` / `.frost-bg` / `.mesh-gradient-bg`):**
  `linear-gradient(135deg, #e0e7ff 0%, #ede9fe 50%, #d1fae5 100%)` (or `linear-gradient(145deg, #E0E7FF 0%, #EDE9FE 45%, #D1FAE5 100%)`)
- **Mesh Blooms:** Indigo `#e0e7ff` / `#c7d2fe`, Purple `#ede9fe` / `#ddd6fe`, Emerald `#d1fae5` / `#a7f3d0`, Sky `#e0f2fe`

### Glass Surface Fills
- **Glass Surface Base (`--glass-surface-base` / `.glass-panel` / `.acrylic-card`):** `rgba(255, 255, 255, 0.35)`
- **Glass Surface Active (`--glass-surface-active`):** `rgba(255, 255, 255, 0.60)`
- **Glass Surface Navigation (`--glass-surface-nav` / `.glass-nav` / `.acrylic-chrome-header`):** `rgba(255, 255, 255, 0.40)` to `rgba(255, 255, 255, 0.45)`
- **Glass Surface Inset / Subpanel (`--glass-surface-inset` / `.glass-input` / `.frosted-subpanel`):** `rgba(255, 255, 255, 0.25)` to `rgba(255, 255, 255, 0.28)`

### Glass Strokes & Highlights
- **Glass Border Stroke (`--glass-border-stroke` / `--glass-border-color`):** `1px solid rgba(255, 255, 255, 0.90)` (Header/Nav: `rgba(255, 255, 255, 0.85)`, Subpanel: `rgba(255, 255, 255, 0.75)`)
- **Specular Top Light (`--glass-specular-top`):** `rgba(255, 255, 255, 0.95)`
- **Specular Bottom Reflection (`--glass-specular-bottom`):** `rgba(255, 255, 255, 0.25)`

### Slate Foreground & Text
- **Text Primary (`--color-slate-primary` / `--color-on-surface`):** `#0f172a` (`rgb(15, 23, 42)`)
- **Text Secondary (`--color-slate-secondary`):** `#1e293b`
- **Text Tertiary (`--color-slate-tertiary`):** `#475569`
- **Text Muted / Variant (`--color-slate-muted` / `--color-on-surface-variant`):** `#64748b` / `#434655` / `#334155`

### Functional Accents
- **Primary Action (`--color-accent-primary` / `--color-primary`):** `#2563eb` (M3 token `#004ac6` / Tailwind config `#0058be`, container `#2563eb` / `#2170e4`)
- **Success (`--color-accent-success` / `--color-secondary`):** `#10b981` (M3 token `#006c49` / `#006947`, container `#6cf8bb` / `#6ffbbe`)
- **Warning (`--color-accent-warning`):** `#f59e0b` / `#d97706` / `#b45309`
- **Violation / Alert (`--color-accent-alert` / `--color-error` / `--color-tertiary-container`):** `#ef4444` / M3 token `#ba1a1a` / `#cf2c30` (container `#ffdad6`)
- **Offline Mode Indicator:** `#f59e0b` / `#d97706` amber pulse on glass pill
- **Sync State Indicator:** `#10b981` / `#006c49` emerald pulse on glass pill
- **Disabled State:** `not detected — needs verification` (standard CSS utility relies on Tailwind `opacity-50 pointer-events-none` or `bg-slate-200/50 text-slate-400`)

---

## 2. Typography Tokens

- **Font Family Base / Body / Headline / Label:** `'Plus Jakarta Sans'`, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- **Font Family Monospace (`--font-family-mono`):** `'JetBrains Mono'`, monospace

### Scale Breakdown
- **Timer Display (`font-timer-display-mobile`):** `JetBrains Mono`, 48px – 64px, line-height 56px, letter-spacing -0.03em, font-weight 700 / 800
- **Headline LG (`font-headline-lg`):** `Plus Jakarta Sans`, 28px, line-height 36px, letter-spacing -0.02em, font-weight 700
- **Headline MD (`font-headline-md`):** `Plus Jakarta Sans`, 22px, line-height 28px, letter-spacing -0.015em, font-weight 700
- **Headline SM (`font-headline-sm`):** `Plus Jakarta Sans`, 18px, line-height 24px, letter-spacing -0.01em, font-weight 700
- **Body LG (`font-body-lg`):** `Plus Jakarta Sans`, 16px, line-height 24px, font-weight 500 / 600
- **Body MD (`font-body-md`):** `Plus Jakarta Sans`, 14px, line-height 20px, letter-spacing 0.005em, font-weight 500
- **Body SM (`font-body-sm`):** `Plus Jakarta Sans`, 12px, line-height 16px, letter-spacing 0.01em, font-weight 500
- **Caption (`text-caption`):** `Plus Jakarta Sans`, 11px – 12px, line-height 16px, font-weight 500 / 600
- **Label Mono (`font-label-mono`):** `JetBrains Mono`, 12px, line-height 16px, letter-spacing 0.02em, font-weight 600 / 700

---

## 3. Glassmorphism Recipe

- **Fill:** `rgba(255, 255, 255, 0.35)` (Primary panel), `rgba(255, 255, 255, 0.45)` (Header/Nav), `rgba(255, 255, 255, 0.25)` (Inset/Subpanel)
- **Backdrop Blur:** `blur(40px) saturate(160%)` (`--glass-backdrop-blur-default`), `blur(50px) saturate(180%)` (`--glass-backdrop-blur-elevated`)
- **Border Stroke:** `1px solid rgba(255, 255, 255, 0.90)`
- **Top-Left Highlight:** `inset 1px 1px 2px 0px rgba(255, 255, 255, 0.95)`
- **Shadow Matrix:** `inset -1px -1px 2px 0px rgba(255, 255, 255, 0.25), 0 8px 32px rgba(0, 0, 0, 0.08)`

---

## 4. Spacing Scale

- **Extra Small (`--space-xs`):** `0.25rem` (4px)
- **Small (`--space-sm`):** `0.5rem` (8px)
- **Medium / Gutter (`--space-md` / `--gutter`):** `1.0rem` (16px)
- **Large (`--space-lg`):** `1.5rem` (24px)
- **Extra Large (`--space-xl`):** `2.0rem` (32px)
- **Outer Margin (`--margin-outer` / `px-margin`):** `1.25rem` (20px) / `1.0rem` (16px)
- **Section Spacing:** `12px` to `16px` (`space-y-3`, `space-y-3.5`, `space-y-4`)
- **Component Gap:** `8px` (`gap-2`), `10px` (`gap-2.5`), `12px` (`gap-3`), `16px` (`gap-4`)

---

## 5. Corner Radii

- **Card / Panel (`--radius-xl` / `rounded-3xl` / `rounded-2xl`):** `1.5rem` (24px) / `1.75rem` (28px)
- **Nested Card / Input (`--radius-lg` / `rounded-xl`):** `1.0rem` (16px) / `0.75rem` (12px)
- **Medium (`--radius-md`):** `0.75rem` (12px)
- **Default (`--radius-default`):** `0.5rem` (8px)
- **Small (`--radius-sm`):** `0.25rem` (4px)
- **Pill / Badge / Nav (`--radius-full` / `rounded-full`):** `9999px`

---

## 6. Component Inventory

1. **Timer:** Housed in `frosted-glass` card; 48-64px `JetBrains Mono` numbers, status label above, progress ring / glow ambient background.
2. **Phone-Down Indicator:** `frosted-glass-pill` badge showing real-time sensor state ("Phone Down & Facing Table" / "Phone Lifted"), green/amber pulse dot.
3. **Grace Period Ring:** 3-second animated SVG countdown ring with warning color transition (`border-red-300/80` or amber ring).
4. **Participant List:** Vertical stack of participant rows inside a `frosted-glass` card; host pill badge, online/synced status indicator dots.
5. **Penalty Leaderboard:** Ranked cards showing participant violation counts and VND penalty amounts; subpanel styling (`frosted-subpanel`).
6. **Violation Log:** Time-stamped list of phone-lift events with violation duration and penalty cost; red/amber badge styling.
7. **Bill Allocation:** Interactive host form with itemized subtotal, tax/tip, penalty offset calculation, and individual member breakdown cards.
8. **Manual Override Input:** Glass input fields (`acrylic-input` / `glass-input`) with focus ring (`focus:ring-2 focus:ring-primary/20`).
9. **VietQR Display:** Center-aligned glass card containing dynamic VietQR image, banking details (Bank, Account #, Owner), copy CTAs, and transfer amount.
10. **Activation Code Input:** Segmented/mono glass input field (`glass-input`) for entering 6-character Pro license keys.
11. **Sensor Permission Error:** Glass alert banner with warning icon (`material-symbols-outlined`), amber/alert tint, and OS settings permission instructions.
12. **Hardware Error Banner:** Diagnostic hero card displaying sensor checklist (Accelerometer, Gyroscope, Magnetometer, Proximity) with status icons.
13. **Offline State:** Top header pill displaying "Offline Mode Ready" with amber pulse dot.
14. **Sync State:** Top header pill displaying "Synced" with emerald green pulse dot.
15. **Empty State:** `not detected — needs verification` (no standalone empty state component found in screen HTML).
16. **Primary CTA:** Full-width rounded button with primary blue fill (`bg-primary` / `bg-[#2563eb]`), text white, shadow (`shadow-md shadow-primary/25`).
17. **Secondary CTA:** Translucent glass button (`acrylic-button-sec` / `frosted-glass-pill`) with slate text (`#0F172A`), 1px white border (`border-white/90`), inner shadow.
18. **Modal / Confirmation:** Centered glass overlay card with backdrop blur and primary/secondary action buttons.
19. **Session Status:** Top header strip displaying session mode ("Solo Focus" / "Group Room"), timer telemetry, and connection status.

---

## 7. Missing Values

- `Disabled state exact token`: Standard disabled color token not declared in `:root`; HTML relies on standard Tailwind `opacity-50 pointer-events-none` or `bg-slate-200/50 text-slate-400`.
- `Empty State component`: No standalone empty state component pattern present in the 10 HTML screens.
