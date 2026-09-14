# Reference 08: Multi-Chain Crypto Wallet — QR & Payment UI

## Metadata
- **Source:** Dribbble
- **Link:** https://dribbble.com/shots/27660701-Multi-Chain-Crypto-Wallet-App-UI-Web3-DeFi-Wallet-Design
- **Date inspected:** 2026-09-14
- **Screenshot:** `screenshots/08-dribbble-crypto-wallet-qr.png`

## ⚠️ SCOPE: QR / PAYMENT UI ONLY

This reference is used **only for QR display and payment status UI study**, NOT for features.

DontLift does NOT include: crypto wallet, multi-chain, token selection, wallet sharing, DeFi.

## Observations

### Colors
- Background: Dark (near-black / deep charcoal)
- Glass fill: `rgba(255, 255, 255, 0.06–0.10)`
- Glass border: `rgba(255, 255, 255, 0.12–0.18)`
- Accent: Emerald green gradient (`#10B981` range)
- Text: `#F9FAFB` (near-white)

### Layout
- Border radius: ~20–24px
- Padding: ~16–20px
- Card-based layout
- QR code centered, prominent
- Mobile-first (portrait)

### Blur & Depth
- Backdrop blur: ~15–25px
- Shadow: soft, diffused
- Edge highlight: present
- Layering: glass cards on dark background

### Typography
- Font: Modern sans-serif
- Size: ~14–18pt
- Weight: Regular / Medium / SemiBold
- Amount display: larger, bold

### QR Display
- QR code centered in glass card
- Amount displayed above QR
- Address / memo below QR
- Clear visual hierarchy

### Payment Status (if present)
- Status badge (paid / pending / failed)
- Color-coded
- Clear iconography

## Evaluation

### Strengths
- Dark interface matches DontLift
- Glassmorphism cards on dark background
- QR code display is clean and prominent
- Emerald accent works well for success states
- Payment status UI is clear

### Mismatches with DontLift
- ❌ **Crypto wallet features** (not focus app)
- ❌ **Multi-chain / token selection** (not needed)
- ⚠️ **Emerald accent** (DontLift uses `#3B82F6` for primary, `#10B981` for success)
- ❌ **Wallet sharing** (not needed)

### Application to DontLift
- **Use:**
  - Dark background `#0B0F19`
  - Glass fill `0.07`, border `0.15`
  - Blur `15–20px`
  - Border radius `20–24px`
  - QR code centered in glass card
  - Amount displayed prominently
  - Memo / address below QR
  - Payment status badge (color-coded)
  - Emerald `#10B981` for success / marked-as-paid
- **Avoid:**
  - Crypto wallet features
  - Multi-chain / token selection
  - Wallet sharing
  - Emerald as primary accent (use blue `#3B82F6`)
- **Try:**
  - QR code in glass card with soft shadow
  - Amount + memo layout
  - Status badge animation