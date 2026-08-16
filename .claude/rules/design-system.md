# Design system philosophy

brand-ui is a **source-owned, token-driven** component system. The default look
is modern enterprise SaaS: restrained, app-first, polished, and equally at home
in dashboards, AI/chat clients, React Flow canvases, and the occasional
marketing page.

Core principles:

- **Tokens are the source of truth.** Every visual decision is a semantic token
  in `@elabs/components-tokens`. Components reference tokens, never raw values. Re-branding
  is a token change, not a component change.
- **Source ownership over lock-in.** Code is meant to be read and modified.
  Avoid clever abstractions that prevent a team from editing a component.
- **Two consumption modes.** Stable primitives are _imported_ from `@elabs/components-*`;
  prototype-specific compositions are _copy-owned_ via the registry.
- **One direction of dependency.** `tokens` → `ui`/`icons` →
  `data`/`ai`/`flow`/`maps`/`charts`/`marketing`/`editor`/`viewer`/`blueprint`. Never import sideways with relative
  paths; use the package alias.
- **Brand-agnostic components.** No package hardcodes a brand. Brand lives in
  tokens, icons, logos, and theme variables.
- **Restraint.** Prefer fewer, composable primitives over many bespoke ones.

When in doubt, optimize for: can a coding agent extend this safely without
breaking theming or accessibility?
