# P4.2b — Extract Rationale, Design System & Reusable Components from Stitch Screens

> **Role:** PRIMARY
> **Skills:** `$ui-ux-pro-max` (required: extract design system), `$qskill-brainstorming` (supporting: clarify design rationale), `$anti-slop` (required: prevent invented values)
> **Interaction mode:** plan-then-approve
> **Output mode:** interactive draft → approved artifact
> **Approval gate:** human approves all files before saving
> **Canonical output:**
> - `design/concepts/concept-final/rationale.md`
> - `design/concepts/concept-final/design-system.md`
> - `design/concepts/concept-final/components/*.md`
> **Run context:** fresh session; attach every input below.

---

## 1. Metadata

- **Source of truth:** HTML/CSS files in `design/concepts/concept-final/screens/` and `design/concepts/concept-final/styles/glass.css`
- **No invented values:** every value must come from actual code
- **Missing values:** must be marked as `not detected — needs verification`
- **Component extraction:** any component appearing in ≥2 screens must be extracted as a reusable spec
- **No code modification:** only read HTML/CSS; do NOT modify them

---

## 2. When to Use

Use this when:

- Stitch screens have already been fetched and saved into `design/concepts/concept-final/screens/`
- The HTML/CSS contains the visual system (colors, typography, spacing, glass recipe)
- You need a portable design system and rationale to support P4.3, P4.4, P4.5
- You want to avoid manually reading 10 HTML files and extracting tokens by hand
- You want to identify reusable components before building the React Native prototype in P4.4

Do NOT use this to invent design values. Only extract what is present.

---

## 3. Inputs

Required:

- `design/concepts/concept-final/screens/`
  - `01-login.html`
  - `02-solo-focus-select.html`
  - `03-solo-focus-timer.html`
  - `04-solo-summary.html`
  - `05-group-lobby.html`
  - `06-group-active.html`
  - `07-host-bill-allocation.html`
  - `08-member-bill-settlement.html`
  - `09-activation.html`
  - `10-hardware-error.html`
- `design/concepts/concept-final/styles/glass.css`

Context (read-only reference):

- `docs/product-design-brief.md`
- `docs/product-requirements.md`
- `docs/feature-specification.md`
- `design/references/summary.md`

If any input is missing, report the gap and ask for a usable file before proceeding.

---

## 4. Task

Read all HTML files in `design/concepts/concept-final/screens/` and `glass.css`.

Extract ACTUAL values from the code. Do NOT invent.

### 4.1 Create `design-system.md`

Include:

**Colors**
- Background base
- Glass fill
- Glass border
- Glass highlight
- Primary action
- Violation
- Success
- Warning
- Text primary
- Text muted
- Offline / syncing
- Disabled
- Surface

**Typography**
- Timer
- Heading
- Body
- Caption
- Label

**Glass recipe**
- Fill (rgba)
- Backdrop blur (px)
- Border (px + rgba)
- Top-left highlight
- Shadow (x, y, blur, rgba)

**Spacing scale**
- Base unit
- Page margin
- Section spacing
- Component spacing

**Corner radius**
- Card
- Input
- Pill

**Component inventory**
- Timer
- Phone-Down Indicator
- Grace Period Ring
- Participant List
- Penalty Leaderboard
- Violation Log
- Bill Allocation
- Manual Override Input
- VietQR Display
- Activation Code Input
- Sensor Permission Error
- Hardware Error Banner
- Offline State
- Sync State
- Empty State
- Primary CTA
- Secondary CTA
- Modal / Confirmation
- Session Status

For each component: list the visual treatment found in code.

### 4.2 Create `rationale.md`

Include:

**Source**
- Stitch project ID
- Style name (Real Frosted Glass)
- 10 screens

**Target experience**
- What the user should feel

**Visual philosophy**
- Why light theme + glass
- Why this fits DontLift

**Information hierarchy**
- What is dominant, secondary, tertiary
- How glass is used to group content

**Why this fits DontLift**
- Domain fit
- Behavior fit
- Accessibility fit

**Interaction risks**
- Contrast on light glass
- Blur performance
- Visual noise from multiple glass layers
- Small-width readability

**Review notes**
- What to test during human review
- What to verify in P4.3
- What to verify in P4.5

### 4.3 Extract Reusable Components

Identify components that appear in MULTIPLE screens.

Create a spec file for each repeated component in `design/concepts/concept-final/components/`.

Required components to check (extract only if they appear in ≥2 screens):

- `glass-card.md` — appears in all screens
- `bottom-nav.md` — appears in all screens
- `header.md` — appears in all screens
- `timer.md` — appears in Solo Focus Timer, Active Group Session
- `leaderboard-row.md` — appears in Active Group Session, Solo Summary
- `participant-row.md` — appears in Group Lobby, Active Group Session
- `primary-cta.md` — appears in multiple screens
- `secondary-cta.md` — appears in multiple screens
- `input-field.md` — appears in Login, Activation, Bill Allocation
- `modal.md` — appears in multiple screens
- `status-badge.md` — appears in multiple screens
- `qr-display.md` — appears in Member Bill Settlement
- `violation-row.md` — appears in Violation Log

For each component spec, include:

- Name
- Screens where it appears (with HTML file references)
- Visual treatment (colors, blur, border, shadow from design-system.md)
- Props / variants (extracted from HTML)
- States (default, pressed, disabled, loading, error)
- Accessibility notes
- Do NOT invent behavior not present in HTML

Mark components that appear only ONCE as `screen-specific — not extracted`.

### 4.4 Rules

- Use ACTUAL values from HTML/CSS
- Do NOT invent values
- If a value is missing → mark as `not detected — needs verification`
- Do NOT add features not present in PRD or Feature Spec
- Do NOT declare the concept a winner
- Do NOT modify HTML/CSS files
- Do NOT begin P4.3

---

## 5. Constraints

Source precedence:

1. Human-approved decisions
2. PRD and Feature Spec
3. HTML/CSS in `concept-final/`
4. AI suggestions

Rules:

- No invented colors, typography, spacing, or shadow
- No invented component behavior
- No unsupported features
- Preserve strict exclusions: No Kiosk Mode, No In-App Wallet, No In-App Chat, No AI Assistant, No automatic bank verification
- Use mandatory domain vocabulary: `Solo Focus Mode`, `Group Room Mode`, `3-Second Grace Period`, `Phone-Down Detection`, `Violation Log`, `Offline-First SQLite Reconciliation`, `VietQR P2P`, `Penalty Leaderboard`, `Host`, `Member`
- Mark `not detected` when a value cannot be found
- Do NOT modify HTML/CSS files
- Do NOT modify `product-design-brief.md`, `product-requirements.md`, `feature-specification.md`
- Do NOT begin P4.3

---

## 6. Expected Output

Files to create:
design/concepts/concept-final/
├── design-system.md
├── rationale.md
└── components/
  ├── glass-card.md
  ├── bottom-nav.md
  ├── header.md
  ├── timer.md
  ├── leaderboard-row.md
  ├── participant-row.md
  ├── primary-cta.md
  ├── secondary-cta.md
  ├── input-field.md
  ├── modal.md
  ├── status-badge.md
  ├── qr-display.md
  └── violation-row.md


Draft first. Present all files for approval before saving.

If a value cannot be extracted, mark it clearly and list it in a "Missing values" section at the end of `design-system.md`.

---

## 7. Save / Update + Human Review + Validation

### Save or Update

- Do NOT save until the human approves all drafts.
- After approval, write only:
  - `design/concepts/concept-final/design-system.md`
  - `design/concepts/concept-final/rationale.md`
  - `design/concepts/concept-final/components/*.md`
- Do NOT create any other file.

### Human Review Required

The human must:

- Confirm every value in `design-system.md` matches actual code
- Confirm `rationale.md` reflects the actual visual direction
- Confirm each component spec matches actual HTML
- Accept, reject, or request revisions per section
- Confirm "Missing values" list is acceptable
- Confirm "screen-specific" components are correctly marked

### Validation Checklist

- [ ] All colors extracted from actual code
- [ ] All typography values extracted from actual code
- [ ] Glass recipe matches `glass.css`
- [ ] Spacing scale matches actual layouts
- [ ] Corner radius matches actual layouts
- [ ] Shadow values match actual code
- [ ] Component inventory complete
- [ ] `rationale.md` includes source, philosophy, hierarchy, fit, risks, notes
- [ ] All repeated components identified
- [ ] Each repeated component has a spec file
- [ ] Screen-specific components marked as not extracted
- [ ] Component specs include props, variants, states
- [ ] No invented values
- [ ] Missing values clearly marked
- [ ] Mandatory domain vocabulary used correctly
- [ ] Strict exclusions preserved
- [ ] No unsupported features added
- [ ] All drafts presented for approval before saving