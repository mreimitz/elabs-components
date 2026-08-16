# ADR 0003 — Theming model

- Status: Accepted
- Date: 2026-06-04
- **Amended by:** ADR [0029](./0029-open-theme-registry.md) — the mechanism below is
  unchanged, but the SET of themes is no longer closed: `ThemeName` is `string`,
  `THEMES`/`THEME_META` became `BUILT_IN_THEMES`/`BUILT_IN_THEME_META`, and a consumer
  registers their own themes through `<ThemeProvider themes={…}>`.

## Context

The system must support multiple brands and modes (light/dark and beyond)
without changing component code, and must let coding agents add themes safely.

## Decision

**Semantic CSS variables, switched by a `data-theme` attribute**, exposed to
Tailwind v4 via `@theme inline`.

- `packages/tokens/src/themes.css` is the single source of truth. `:root` holds
  the default (light) theme; each other theme is a `[data-theme="name"]` block.
- Tokens are **semantic**, not literal: `--background`, `--foreground`,
  `--primary`, `--muted-foreground`, `--surface`, `--sidebar`, `--canvas`,
  `--flow-node`, `--chat-user`, `--chart-1..5`, `--radius`, etc.
- `@theme inline` maps each token to a Tailwind color/utility
  (`--color-background: var(--background)`), so components use `bg-background`,
  `text-muted-foreground`, `border-border` — never raw values.
- `ThemeProvider` writes `data-theme` and persists the choice; `useTheme()`
  reads/sets it. The available themes are the provider's REGISTRY (ADR 0029);
  `BUILT_IN_THEME_DEFINITIONS` is its default.
- Reference themes: **light** (the default) and **dark**. `blueprint`
  (cyanotype paper, white ink, full reprographic texture) is kept as source but
  PAUSED — see @.claude/rules/paused-surfaces.md.

## Consequences

- Re-branding = editing token values; components never change.
- Adding a theme is mechanical: one CSS block covering `THEME_TOKEN_NAMES`, plus a
  registry entry (`/new-theme` in this repo; `defineTheme` in a consumer's).
- Components must use tokens exclusively — enforced by review, the quality gates,
  and a non-blocking boundary hook that warns on raw hex.
- `data-theme` (vs. a `.dark` class) generalizes cleanly to N brands/modes.
