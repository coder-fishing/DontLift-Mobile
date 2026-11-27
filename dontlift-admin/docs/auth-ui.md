# Authentication UI Direction

The owner selected bilingual English and Vietnamese interface copy. The existing Glass UI
components are the visual foundation. Technical documentation remains English.

## Purpose and scope

The authentication slice has one job: help an existing user sign in, show the result of server
verification, and identify the signed-in admin. It does not present revenue, user lists, orders,
or security claims that have not been verified.

## Visual direction

- Use the existing liquid-glass Card for the single sign-in surface. Its translucency separates
  the form from the page canvas; do not add blur to every nested control.
- Pair the glass surface with a dark, quiet brand panel and a restrained training-related mark.
  This connects the admin workspace to DontLift without inventing a logo or profile artwork.
- Use existing semantic foreground, border, focus, and status tokens. Keep copy readable over the
  composed glass background; focus must remain visible by keyboard.
- Use a two-column layout on wide screens and stack the brand panel and form on narrow screens.
  Controls remain labeled, password-manager compatible, paste enabled, and keyboard operable.
- Show the English label first and the Vietnamese translation next to it. Errors and recovery
  actions are bilingual as well.
- Keep verification, forbidden, dependency, session-expired, sign-out, and incomplete-sign-out
  states distinct. Unknown access never shows the identity workspace.

## Design-system search

The UI/UX Pro Max search returned Glassmorphism as a fit for modern admin/financial interfaces and
warned about contrast, keyboard focus, reduced motion, and responsive checks. Its operations
landing-page pattern was not applied because this feature is not a marketing page or live telemetry
dashboard. Accessibility search results reinforced labeled fields, paste/password-manager support,
submission feedback, and actionable error recovery. Next.js guidance favors keeping pages as server
components and limiting client behavior to the auth provider and interactive views.

The app's existing typeface and semantic theme remain in use; no new font or decorative assets are
introduced. The Glass UI material serves hierarchy and focus, not decoration across every element.
