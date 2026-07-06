# Utility Hub Design System

Reading this as: a bilingual utility workspace for AI, VPS, cross-border, and developer users, with an artful premium workbench language rather than a terminal or hacker aesthetic.

## Direction

- Primary vibe: Premium utilitarian minimalism with editorial luxury.
- Product metaphor: a calm digital tool gallery, part precision desk, part catalog, part refined editor.
- Avoid: terminal green, cyberpunk neon, AI-purple gradients, generic admin dashboards, equal three-card feature rows.
- Favor: asymmetric bento layouts, quiet texture, precise typography, double-bezel tool panels, restrained motion.

## Tokens

- Light canvas: warm ivory and mist gray.
- Dark canvas: ink black and graphite.
- Accent: one cool sage-blue accent across the whole product.
- Typography: display sans + UI sans + mono. Do not default to Inter, Roboto, Arial, or Open Sans.
- Corners: small UI radius, larger shell radius. Keep the rule consistent.
- Shadows: almost none. Use hairlines, inset highlights, and low-opacity ambient shadows.

## Layout Rules

- The home page uses search-first navigation, favorites, recents, and an asymmetric tool grid.
- Tool pages use a `ToolShell`: context header, favorite control, input panel, output panel, action row.
- All multi-column layouts must collapse to one column below 768px.
- Do not use `h-screen`; use `min-height: 100dvh` where needed.
- One visual theme applies to the whole page. Do not invert individual sections randomly.

## Motion Rules

- Animate only `transform` and `opacity`.
- Use custom cubic-bezier motion, not default `ease-in-out`.
- Respect `prefers-reduced-motion`.
- Motion must communicate hierarchy, state, or feedback.

## Interaction Rules

- Favorites and recent tools are local-only.
- Sensitive tools must clearly state local processing.
- 2FA secrets may be saved locally, but must not sync to cloud.
- HTML preview must use a sandboxed iframe and avoid `allow-same-origin`.

## Copy Rules

- Chinese is the primary interface language; English supports scanning and international utility naming.
- Avoid inflated marketing language. Use plain, specific tool descriptions.
- Keep hero copy short; the primary interaction is the search/command input.
