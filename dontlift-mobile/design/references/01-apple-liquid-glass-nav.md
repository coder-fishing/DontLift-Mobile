# Reference 01: Apple Liquid Glass — Navigation Bar

## Metadata
- **Source:** Dribbble
- **Link:** https://dribbble.com/shots/26294545-Apple-Liquid-Glass-Design-Navigation-Bar
- **Date inspected:** 2026-09-13
- **Screenshot:** `screenshots/01-apple-liquid-glass-nav.png`

## Observations

### Colors
- Background: `#1A1A1A` (dark gray)
- Glass fill: `rgba(255, 255, 255, 0.06–0.08)`
- Glass border: `rgba(255, 255, 255, 0.15–0.20)`
- Active item fill: `rgba(255, 255, 255, 0.15)`
- Text / Icon: `#F9FAFB` (near-white)
- Accent glow: Green gradient (bottom edge)

### Layout
- Border radius: ~28px
- Padding: ~12px
- Item spacing: ~24px
- 4 items: Home, Feed, Search, Settings
- Active item (Home) has its own pill shape

### Blur & Depth
- Backdrop blur: ~20–30px
- Shadow: subtle
- Edge highlight: present
- Layering: 2 glass layers (nav bar + active pill)

### Typography
- Font: SF Pro / Inter
- Size: ~13–15pt
- Weight: Regular / Medium
- Labels: "Home", "Feed", "Search", "Settings"

### Micro-interactions (inferred from static shot)
- Active pill moves when tapping another item
- Possible subtle scale animation
- Bottom glow may be ambient, not interactive

## Evaluation

### Strengths
- Glass treatment is refined, not overly blurred
- Active state is clear (pill shape)
- Layout is clean and legible
- Two glass layers create nice depth

### Mismatches with DontLift
- Only 4 items; DontLift needs more (timer, leaderboard, bill, activation, etc.)
- Accent color is green; DontLift uses `#3B82F6` (Electric Sapphire)
- No offline / syncing states

### Application to DontLift
- **Use:**
  - Glass fill `0.07`, border `0.15`
  - Border radius ~28px for nav bar
  - Active pill fill `0.15`
  - Two glass layers (nav + active)
- **Avoid:**
  - Blur > 30px (performance impact)
  - Green accent (keep `#3B82F6`)
- **Try:**
  - Subtle glow behind nav bar
  - Active pill transition animation