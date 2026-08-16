# ADR 0001 — Architecture

- Status: Accepted
- Date: 2026-06-04

## Context

We need an internal component system that is fast to use for prototypes, POCs,
AI/chat apps, data grids, dashboards, React Flow canvases and presales demos —
reusable across many internal apps, themeable per brand, and easy for both
humans and coding agents to extend.

## Decision

A **pnpm + Turborepo monorepo** of small, single-purpose TypeScript/React
packages, plus a Storybook docs app and a Vite playground.

- **pnpm workspaces** — fast, strict, disk-efficient installs; first-class
  workspace protocol for internal packages; the package manager Turborepo and
  shadcn document against.
- **Turborepo** — task graph + caching for `build`/`lint`/`typecheck`/`test`
  across packages with one command. `turbo.json` uses the v2 `tasks` key.
- **TypeScript + React** — typed public APIs are what make components legible to
  coding agents; React is the target runtime.
- **Tailwind CSS v4** — CSS-first theming via `@theme inline` + CSS variables;
  design tokens become utilities with no JS config. Pairs naturally with the
  semantic-token model.
- **shadcn-style owned source** — components live in our repo as editable
  source (built on Radix), not behind a closed package boundary, so teams can
  read and modify them.
- **Storybook** — component documentation and visual review, loading co-located
  stories from every package with live theme switching.
- **Registry distribution** — a shadcn-compatible registry lets prototype blocks
  be _copy-owned_ (`npx shadcn add`) while stable primitives are _imported_.

Internal packages use the **"just-in-time" pattern**: their `exports` point at
TypeScript source, so apps (Vite/Storybook) transpile them directly with no
pre-build step. `tsup` builds `dist/` for external distribution.

## Consequences

- One install, one task runner, consistent tooling across packages.
- Apps consume source directly → instant DX, no stale build artifacts.
- Slightly more config per package (mitigated by shared `typescript-config` and
  `eslint-config` packages).
- The repo assumes Node ≥ 20 and pnpm.
