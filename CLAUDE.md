# CLAUDE.md

Project memory for Claude Code — lean by design; binding detail lives in `.claude/rules/`.

## Purpose

`brand-ui` is an internal, **source-owned, token-driven** React component system for internal apps, prototypes, POCs, AI/chat clients, data grids, dashboards, React Flow canvases and presales demos.
Default look: modern enterprise SaaS, restrained and app-first, themeable to any brand. A reusable system, not an app.

## Tech stack

pnpm workspaces + Turborepo · TypeScript · React 19 · Tailwind CSS v4 (CSS variables + `@theme inline`) · Radix UI · TanStack Table · React Flow (`@xyflow/react`) · Storybook 10 (+ `addon-mcp` / `addon-vitest` / `addon-a11y`) · Vitest + Testing Library · tsup · ESLint 9 + Prettier. No paid dependencies.

## Packages

- `@elabs-ai/components-tokens` — semantic CSS-variable themes + `ThemeProvider`/`useTheme`.
- `@elabs-ai/components-ui` — foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).
- `@elabs-ai/components-icons` — brand/product-vocabulary icons + `BrandLogo`; generic glyphs come from Lucide (`lucide-react`).
- `@elabs-ai/components-data` — TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker.
- `@elabs-ai/components-ai` — chat: ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, Sources, CodeBlock, Artifact.
- `@elabs-ai/components-flow` — branded React Flow canvas, nodes, edges, controls, inspector.
- `@elabs-ai/components-maps` — token-driven MapLibre GL maps: MapCanvas, MapMarker, MapPopup, MapControls, MapRoute, MapArc, MapGeoJSON, MapClusterLayer.
- `@elabs-ai/components-charts` — MetricCard, MetricGrid, ChartCard, ChartFrame, AutoChart (spec-driven via a serializable `ChartSpec`) · `/dashboard` subpath: sheet surface (ADR 0037).
- `@elabs-ai/components-marketing` — Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.
- `@elabs-ai/components-editor` — token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace (file tabs).
- `@elabs-ai/components-viewer` — FileViewer: a file the app did not write, via a pluggable adapter registry (ADR 0024).
- `@elabs-ai/components-terminal` — terminal surfaces (shell/agent output, coding-agent CLI look-alikes); a layer-2 leaf — `@elabs-ai/components-ai` must never import it.
- `@elabs-ai/components-process` — process mining / event-log analysis; the one layer-3 package (ADR 0034).
- Apps: `apps/docs` (Storybook); `apps/home` (the website, ADR 0038); `fixtures/consumer-smoke` (install-shape smoke test).

Dependencies flow one way: `tokens` → `ui`/`icons` → `data`/`ai`/`flow`/`maps`/`charts`/`marketing`/`editor`/`viewer`/`terminal` → `process` (the one layer-3 composite, ADR 0034). Import across packages via `@elabs-ai/components-*`, never relative paths.

## Commands

`pnpm install` · `dev` · `build` · `lint` · `typecheck` · `test` · `format` · `check` (every repo convention rule, one runner; `--rule <id>`, `--list`) · `check:test` (rule fixtures + script self-tests) · `check:changed` (scoped to your diff) · `storybook` · `gen` (regenerate generated doc regions)

## Conventions

Read [`.claude/rules/conventions.md`](.claude/rules/conventions.md) (component API, styling/tokens, theming, accessibility, loading states, icons) and [`.claude/rules/decisions.md`](.claude/rules/decisions.md) (D1–D7, canonical in `docs/DECISIONS.md`). Package-specific detail is path-scoped — `ai.md`, `charts.md`, `data.md`, `flow-maps-editor.md`, `registry.md`, `storybook-mcp.md` — loaded only when a matching file is touched. Definition of done, review routing and the gate catalogue: `CONTRIBUTING.md` and `docs/GATES.md`.

## Safety

- Never commit secrets, `.env`, or machine-specific absolute paths.
- No raw hex outside `packages/tokens/src/themes.css`; no paid dependencies.
- No destructive commands; no force pushes (hooks enforce this).

<!-- brand-ui:gen:decisions:start -->
<!-- Generated from the DECISIONS:SUMMARY region of `docs/DECISIONS.md` — edit decisions there, not here. -->

<!-- prettier-ignore -->
| # | Decision | The short answer | Detail rule |
| --- | --- | --- | --- |
| **D1** | Which paradigm? | **Build-with** components (you/the agent write the code) — the default, ~99%. Generative-UI (A2UI) is for screens the agent must design at runtime. | [`decisions.md`](.claude/rules/decisions.md) |
| **D2** | Rendering agent output | A **conversation** → AI SDK `UIMessage` + `@elabs-ai/components-ai`. An **agent-designed surface** → A2UI: JSON validated against the catalog, rendered by `A2uiSurface`. | [`ai.md`](.claude/rules/ai.md) |
| **D3** | Which package | `@elabs-ai/components-*`: app UI → ui · data → data · chat → ai · canvas → `@elabs-ai/components-flow` · in-chat agent workspace graph → `@elabs-ai/components-ai` · KPIs → charts · dashboard sheet → `@elabs-ai/components-charts/dashboard` · landing → marketing · code → editor · files → viewer · shell → terminal · process mining → process · tokens → tokens · icons → icons · icon rail → `ContextRail` (ui), chat drill-down → `ContextPanel` (ai) | `skills/brand-ui/SKILL.md` (generated table) |
| **D4** | Import vs copy-own | Stable shared primitives → **import** `@elabs-ai/components-*`. Prototype-specific blocks → **copy-own** (registry). | [`registry.md`](.claude/rules/registry.md) |
| **D5** | Scope boundary (what brand-ui ISN'T) | brand-ui is a **presentation layer**, not an SDK/runtime. It renders models; it never owns model calls. | [`decisions.md`](.claude/rules/decisions.md) |
| **D6** | Dependency & import discipline | `ai` (Vercel AI SDK) is **types-only, peer, never runtime**. Semantic tokens only; one-way dep graph. | [`ai.md`](.claude/rules/ai.md) · [`conventions.md`](.claude/rules/conventions.md) |
| **D7** | Maintainer decisions | New component → dedupe-gate → right package (D3) → built to rules → **auto-registered** (gate, not memory). | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

<!-- brand-ui:gen:decisions:end -->
