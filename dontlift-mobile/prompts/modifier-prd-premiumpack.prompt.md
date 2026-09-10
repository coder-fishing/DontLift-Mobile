# Modifier: Premium Pack — Monetization Strategy

> **Role:** Product Requirements Modifier
> **Skills:** `$qskill-executing-plans` (required)
> **Interaction mode:** draft-then-approve
> **Output mode:** interactive draft → approved artifact
> **Approval gate:** confirm before saving
> **Inputs:**
>   - PRD: `chapter-03-ai-for-requirements-product-analysis/docs/product-requirements.md`
>   - Project Context: `docs/project-context.md`
> **Canonical Output:**
>   - Updated PRD
>   - Updated Project Context

## Task

Add a "Monetization Strategy" section to both the PRD and Project Context, using the Freemium + Lifetime Premium model below.

## Monetization Strategy Content

### Revenue Model
- **Type:** Freemium with Lifetime Premium
- **Price:** 99,000 VNĐ (one-time purchase)
- **Payment Method:** VietQR via external website
- **Delivery:** Activation code via email

### Free Tier
| Feature | Limit |
|---------|-------|
| Solo Focus Mode | Unlimited |
| Group Room participants | Max 5 |
| Rooms created/month | 7 |
| Violation Log retention | 7 days |
| Penalty Leaderboard | Basic |
| Ads | Light, non-intrusive |

### Premium Features
| Feature | Benefit |
|---------|---------|
| Unlimited Group Room | No participant limit |
| Permanent Violation Log | Never lose history |
| Advanced Leaderboard | Themes, export, insights |
| Detailed Analytics | Charts, patterns |
| Custom Themes | Personalization |
| Ad-free | Clean experience |
| Priority Support | Faster response |

### Activation Flow
1. User visits website → pays via VietQR
2. System generates activation code (DONTLIFT-XXXX-XXXX-XXXX)
3. Code sent via email
4. User enters code in app → Premium unlocked
5. Code verified offline via checksum

### Constraints Compliance
- ✅ No In-App Wallet
- ✅ No payment gateway custody
- ✅ No real funds handling in app
- ✅ VietQR only for P2P settlement between users

## Execution Steps

1. **Read** `docs/project-context.md` → identify current section numbering
2. **Read** PRD → identify current section numbering
3. **Append** new "Monetization Strategy" section to project-context with the NEXT sequential number
4. **Insert** new "Monetization Strategy" section into PRD at the appropriate position (before Exclusions)
5. **Renumber** affected sections in PRD (Exclusions, Phased Scope)
6. **Update version** in PRD (increment minor version)
7. **Update Source Hierarchy** in project-context to note this is a newer human-approved decision (higher priority than brief)
8. **Present draft** for human approval
9. **Save** only after human confirms

## Human Review Gate

Present the draft to the human. Do NOT save until:
- Every new section is approved
- Section numbering is consistent
- Version is updated
- Source Hierarchy reflects the new decision

## Execution Command

```bash
/cat prompts/modifier-prd-premiumpack.prompt.md
```