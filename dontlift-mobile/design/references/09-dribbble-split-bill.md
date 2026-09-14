# Reference 09: Split Bill — Mobile App UI Design & Animation

## Metadata
- **Source:** Dribbble
- **Link:** https://dribbble.com/shots/19330716-Split-Bill-Mobile-App-UI-Design-Animation
- **Date inspected:** 2026-09-14
- **Screenshot:** `screenshots/09-dribbble-split-bill.png`

## ⚠️ SCOPE: BILL SETTLEMENT UI ONLY

This reference is used **only for bill breakdown, split calculation, and payment flow UI study**, NOT for features outside DontLift scope.

DontLift does NOT include: traditional bill split (without penalty), group expense tracking, receipt scanning.

## Observations

### Colors
- Background: [light / dark — note what you see]
- Card fill: [note]
- Accent: [note]
- Text: [note]

### Layout
- Border radius: [note]px
- Padding: [note]px
- Bill breakdown: [how items are listed]
- Per-person share: [how displayed]
- Total: [how displayed]

### Typography
- Font: [note]
- Amount size: [note]
- Weight: [note]

### Bill Breakdown UI
- Item list: [how items are listed]
- Per-person split: [how each person's share is shown]
- Total: [how total is displayed]
- Tax / tip: [if present]

### Payment Flow
- Payment method selection: [if present]
- QR code: [if present]
- Confirmation: [if present]

### Animation (from title)
- Split animation: [describe if visible]
- Number counting: [if present]
- Transition: [if present]

## Evaluation

### Strengths
- Bill breakdown layout is clear
- Per-person share display is readable
- Animation adds polish
- Payment flow is intuitive

### Mismatches with DontLift
- ⚠️ **May be light theme** (DontLift uses dark theme)
- ⚠️ **May not have glassmorphism** (DontLift uses glass)
- ⚠️ **May not have QR** (DontLift uses VietQR)
- ⚠️ **Traditional split** (DontLift uses Hybrid Bill Allocation with penalty weighting)

### Application to DontLift
- **Use:**
  - Bill breakdown layout
  - Per-person share display
  - Amount typography (large, readable)
  - Animation for split calculation
  - Payment confirmation flow
- **Avoid:**
  - Light theme (use dark `#0B0F19`)
  - Traditional split (use Hybrid Bill Allocation)
  - Receipt scanning (not in scope)
- **Try:**
  - Split animation with number counting
  - Per-person share card layout
  - Payment status badge
  - QR code display in glass card