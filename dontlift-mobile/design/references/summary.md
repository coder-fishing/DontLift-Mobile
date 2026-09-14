# Human Check — Summary

## Date: 2026-09-14
## Total references: 12

---

## Common Patterns (≥3 references)

### Colors
- Dark background: `#0B0F19` – `#1A1A1A`
- Glass fill: `rgba(255, 255, 255, 0.06–0.12)`
- Glass border: `rgba(255, 255, 255, 0.12–0.20)`
- Accent: `#3B82F6` (DontLift)
- Success: `#10B981`
- Danger: `#EF4444`

### Layout
- Border radius: 16–28px
- Padding: 12–20px
- Row height: 60–72px
- Avatar: 40px circle

### Blur & Depth
- Backdrop blur: 15–30px
- Shadow: subtle
- Edge highlight: 0.1–0.2

### Typography
- Font: SF Pro, Inter, Plus Jakarta Sans
- Timer: 48–56pt Bold
- Name: 16pt Medium
- Points: 14pt Regular
- Rank: 18pt Bold

### Micro-interactions
- Duration: 150–250ms
- Easing: ease-out
- Tap scale: 0.95–0.98

---

## Divergent Patterns

| Pattern | Count | Notes |
|---------|-------|-------|
| Noise texture | 5/12 | Subtle |
| Gradient | 4/12 | Soft |
| Reflection | 3/12 | Edge highlight |
| Spring animation | 2/12 | Optional |

---

## Application to DontLift

### Use
- Dark bg `#0B0F19`
- Glass fill `rgba(255,255,255,0.07)`
- Blur 15px
- Border radius 16px
- Edge highlight 0.15
- Timer 56pt Bold
- Leaderboard row 72px
- Participant avatar 40px

### Avoid
- Blur > 30px
- Glass fill > 0.15
- Heavy gradients
- Light theme
- Mascot

### Try
- Noise texture
- Edge highlight
- Subtle reflection
- Glass card for all components

### Fallback
- Solid opaque dark card for low-end devices

---

## Open Questions for P4.2

1. Noise texture: yes or no?
2. Glass fill: 0.05 or 0.07?
3. Blur: 10px or 15px?
4. Gradient: yes or no?
5. Reflection: yes or no?

---

## Conclusion
12 references inspected. Ready for P4.2.