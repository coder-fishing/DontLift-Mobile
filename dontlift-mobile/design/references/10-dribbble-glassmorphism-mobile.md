# Reference 10: Dating App UI — Glassmorphism Mobile Experience

## Metadata
- **Source:** Dribbble
- **Link:** https://dribbble.com/shots/27340416-Dating-App-UI-Design-Glassmorphism-Mobile-Experience
- **Date inspected:** 2026-09-13
- **Screenshot:** `screenshots/10-dribbble-glassmorphism-mobile.png`

## Observations

### Colors
- Background: Dark theme (deep charcoal / near-black)
- Glass fill: `rgba(255, 255, 255, 0.06–0.10)`
- Glass border: `rgba(255, 255, 255, 0.12–0.18)`
- Accent: Soft gradient (likely pink / purple for dating context)
- Text: `#F9FAFB` (near-white)

### Layout
- Border radius: ~20–28px
- Padding: ~16–20px
- Card-based layout with layered glass panels
- Mobile-first (portrait orientation)

### Blur & Depth
- Backdrop blur: ~20–30px
- Shadow: soft, diffused
- Edge highlight: present
- Layering: multiple glass layers (cards on background)

### Typography
- Font: Modern sans-serif (Inter / SF Pro style)
- Size: ~14–18pt
- Weight: Regular / Medium / SemiBold

### Micro-interactions (inferred from static shot)
- Smooth card transitions
- Likely hover / tap feedback on interactive elements
- Soft fade or slide animations

## Evaluation

### Strengths
- Glassmorphism applied elegantly on dark theme
- Clear hierarchy with layered panels
- Soft gradients add depth without clutter
- Mobile-first layout is clean and legible

### Mismatches with DontLift
- Dating context (not focus / accountability)
- Accent colors are pink / purple; DontLift uses `#3B82F6`
- No timer, leaderboard, or QR elements

### Application to DontLift
- **Use:**
  - Glass fill `0.07`, border `0.15`
  - Border radius ~20–24px for cards
  - Layered glass panels for depth
  - Soft gradients as ambient background
- **Avoid:**
  - Blur > 30px (performance impact)
  - Pink / purple accent (keep `#3B82F6`)
  - Overly decorative gradients
- **Try:**
  - Multi-layer glass cards
  - Subtle gradient glow behind key cards
  - Soft shadow for depth