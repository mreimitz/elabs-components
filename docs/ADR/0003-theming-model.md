# ADR 0003 — Theming model

- Status: Accepted
- Date: 2026-06-04

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
  reads/sets it. `THEMES`/`THEME_META` enumerate the available themes.
- Shipped themes: **qlik-bright** (Qlik brand, the default), **qlik-dark**,
  and **blueprint** (cyanotype paper, white ink, full reprographic texture).
  `qlik-bright`/`qlik-dark` derive from the Qlik brand palette (Qlik Green
  primary).

## Consequences

- Re-branding = editing token values; components never change.
- Adding a theme is mechanical (`/new-theme`): one CSS block + a `THEMES` entry.
- Components must use tokens exclusively — enforced by review, the quality gates,
  and a non-blocking boundary hook that warns on raw hex.
- `data-theme` (vs. a `.dark` class) generalizes cleanly to N brands/modes.
