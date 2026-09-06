# Design system

brand-ui is a **source-owned, token-driven** component system; default look: restrained, app-first enterprise SaaS.

- **Tokens are the source of truth.** Every visual decision is a semantic token in `@elabs-ai/components-tokens`. Components reference tokens, never raw values. Re-branding is a token change, not a component change.
- **Source ownership over lock-in.** Code is meant to be read and modified. Avoid clever abstractions that prevent a team from editing a component.
- **Two consumption modes.** Stable primitives are _imported_ from `@elabs-ai/components-*`; prototype-specific compositions are _copy-owned_ via the registry.
- **One direction of dependency.** `tokens` → `ui`/`icons` → `data`/`ai`/`flow`/`maps`/`charts`/`marketing`/`editor`/`viewer`/`terminal` → `process` (the one layer-3 composite — ADR 0034). Never import sideways with relative paths; use the package alias.
- **Brand-agnostic components.** No package hardcodes a brand. Brand lives in tokens, icons, logos, and theme variables.
- **Restraint.** Prefer fewer, composable primitives over many bespoke ones.

When in doubt, optimize for: can a coding agent extend this safely without breaking theming or accessibility?

History and measurements: docs/rules-history/design-system.md
