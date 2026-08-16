# PROJECT.md — Product vision

## What this is

`brand-ui` is an **internal, branded React component system** — source-owned,
token-driven, and reusable across many internal applications. It is built to make
internal product work fast: prototypes, POCs, AI/chat apps, data-heavy dashboards
and grids, React Flow design surfaces, presales/customer demos, and general
"vibecoding".

It follows the **shadcn-style ownership model**: components are editable source in
this repo (built on Radix), not opaque packages. Teams can read and modify them.

The default visual direction is **modern enterprise SaaS**: clean, polished,
restrained (not playful), app-first, and professional enough for customer POCs —
while remaining flexible enough for marketing sections. It is intentionally
**not a finished brand**: tokens are neutral placeholders, applied through colors,
semantic tokens, icons, logos, theme variables, component variants and layout
patterns, so a brand can be swapped via themes rather than hardcoded anywhere.

## Goals

- One system reused across many internal apps, themeable per brand.
- Fast to use for prototypes and demos; fast for coding agents to extend safely.
- First-class support for AI/chat UIs and React Flow canvases, plus data grids
  and dashboards.
- Multiple themes from day one (light, dark).
- Two consumption modes: imported stable primitives, and copy-owned registry
  blocks/templates.
- High-signal docs + Claude Code setup so humans and agents extend it correctly.

## Non-goals

- Not a finished, single-brand visual identity.
- Not a public, versioned, locked component library (source ownership is a goal).
- Not an application — it's a system. The playground/docs are demos, not products.
- **Not an SDK or runtime** — brand-ui is a presentation layer that renders agent/data models,
  not an owner of model calls, streaming, transport, or protocol engines. Full statement +
  rationale: decision **D5** in `docs/DECISIONS.md` and ADR
  [`0007`](docs/ADR/0007-presentation-layer-scope-boundary.md).
- No paid dependencies, no Figma dependency, no closed abstractions.

## Architecture

pnpm + Turborepo monorepo. Token package at the base, UI/icons above it, then
domain packages (data, ai, flow, charts, marketing). A Storybook docs app and a
Vite playground consume the packages directly (TypeScript source exports). A
shadcn-compatible registry distributes copy-owned blocks. See `docs/ADR/` for the
reasoning behind each major choice.

## Package overview

<!-- This table is GENERATED from the manifest by `pnpm gen`.
     Edit purposes in packages/cli/lib/render-docs.mjs (PKG_PURPOSE), not here. -->

<!-- brand-ui:gen:packages:start -->

| Package                          | Path                 | Purpose                                                                                  |
| -------------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| `@elabs-ai/components-tokens`    | `packages/tokens`    | Semantic CSS-variable themes + ThemeProvider/useTheme.                                   |
| `@elabs-ai/components-icons`     | `packages/icons`     | Brand/product-vocabulary icons + BrandLogo (generic glyphs use lucide-react).            |
| `@elabs-ai/components-ui`        | `packages/ui`        | Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).                           |
| `@elabs-ai/components-data`      | `packages/data`      | TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker.                   |
| `@elabs-ai/components-ai`        | `packages/ai`        | ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, citations.               |
| `@elabs-ai/components-flow`      | `packages/flow`      | Branded React Flow canvas, nodes, edges, controls, inspector.                            |
| `@elabs-ai/components-maps`      | `packages/maps`      | MapLibre GL maps: MapCanvas, markers, popups, controls, routes, arcs, GeoJSON, clusters. |
| `@elabs-ai/components-charts`    | `packages/charts`    | MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download).                    |
| `@elabs-ai/components-marketing` | `packages/marketing` | Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.                        |
| `@elabs-ai/components-editor`    | `packages/editor`    | Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace.                       |
| `@elabs-ai/components-viewer`    | `packages/viewer`    | FileViewer — any file (image, text, JSON, CSV) via a pluggable adapter registry.         |

<!-- brand-ui:gen:packages:end -->

## Roadmap (suggested)

- **Now:** harden the foundation; expand test coverage; add `Drawer`, `Accordion`,
  `Command`, `Toast` to `@elabs-ai/components-ui`.
- **Next:** DataTable saved views + server-side data; React Flow minimap +
  grouping; chat streaming helpers; more registry blocks/templates.
- **Shipped:** internal package releases — every distributable package publishes
  to GitHub Packages in lockstep from a version tag (`docs/RELEASING.md`,
  ADR 0016). `pnpm version:set` is the single writer of the lockstep version;
  deprecation and support policy is `docs/DEPRECATION.md`.
- **Later:** visual regression tests in Storybook; per-brand theme packs;
  optional RTL support.

## Acceptance criteria (foundation)

- All listed packages exist with real starter implementations and barrel exports.
- Token system with 2 themes (light, dark) switchable via `data-theme` +
  `ThemeProvider`.
- Storybook loads stories from all packages with live theme switching.
- Vite playground demonstrates app shell, dashboard/data table, AI chat, flow
  canvas and marketing sections, with a theme switcher.
- A valid shadcn-compatible registry with the required initial items.
- `.claude/` setup: settings, hooks, commands, agents, modular rules.
- Documentation: README, PROJECT, CLAUDE, AGENTS, CONTRIBUTING, ADRs, guidelines.

## Quality gates

See `.claude/rules/quality-gates.md`. Every component: typed, composable,
token-driven, theme-safe, accessible, story + smoke test, barrel export, green
`typecheck`/`lint`/`test`, no paid deps.
