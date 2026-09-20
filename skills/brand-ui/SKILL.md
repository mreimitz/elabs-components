---
name: brand-ui
description: Build UI with the brand-ui component system (@elabs-ai/components-* packages — ui, data, ai, flow, maps, charts, marketing, editor, viewer, terminal, tokens, icons). Use when working in a project that depends on @elabs-ai/components-ui or any @elabs-ai/components-* package, when adding/composing components, building dashboards, data tables, AI/chat surfaces, React Flow canvases, MapLibre maps, code editors, file/document viewers, app shells, forms, or marketing sections, when theming with the token system, or when the user mentions brand-ui, @brand, light/dark themes, or "our design system". Provides live project context, the real component API, composition patterns, and the rules that keep components token-driven, accessible, and theme-safe.
user-invocable: false
allowed-tools:
  - Bash(npx @elabs-ai/components-cli *)
  - Bash(pnpm brand-ui *)
  - Bash(npx brand-ui *)
  - Bash(npx shadcn@latest *)
  - Bash(pnpm dlx shadcn@latest *)
---

# brand-ui

A source-owned, token-driven React component system (`@elabs-ai/components-*`),
themeable to any brand. This file is the router: follow the routine, and load a
reference file only when the task needs it.

Run the CLI as `pnpm exec brand-ui <cmd>` or `npx brand-ui <cmd>` once
`@elabs-ai/components-cli` is a dev dependency (`pnpm add -D` or `npm install -D`;
public npm, no token), or with no install as `npx -y @elabs-ai/components-cli <cmd>`.
Inside the brand-ui repo: `pnpm brand-ui <cmd>`. When the `mcp__brand-ui__*` tools are
connected they answer the same without a shell. Examples below say `brand-ui`.

## The routine

1. `brand-ui info`: once per session. Packages present, themes, tokens, registry.
2. `brand-ui search <need>`: the component, a copy-own registry block, or for a whole
   screen ("dashboard", "chatbot", "settings page") the playbook and template to start from.
3. `brand-ui docs <Component> --brief`: its parts and real props. Never guess an API;
   drop `--brief` for every prop.
4. Build: compose existing components, their variants and semantic tokens.
5. `brand-ui audit <path>`: the static token and type-role pass. For the rendered
   cross-theme and contrast pass, use the `brand-ui-audit` skill.

## Decisions

<!-- brand-ui:gen:decisions:start -->
<!-- Generated from the decision summary by `pnpm gen`; edit the decisions there. -->

- **D1 · Which paradigm?** **Build-with** components (you/the agent write the code) — the default, ~99%. Generative-UI (A2UI) is for screens the agent must design at runtime.
- **D2 · Rendering agent output** A **conversation** → AI SDK `UIMessage` + `@elabs-ai/components-ai`. An **agent-designed surface** → A2UI: JSON validated against the catalog, rendered by `A2uiSurface`.
- **D3 · Which package** `@elabs-ai/components-*`: app UI → ui · data → data · chat → ai · canvas → `@elabs-ai/components-flow` · in-chat agent workspace graph → `@elabs-ai/components-ai` · KPIs → charts · dashboard sheet → `@elabs-ai/components-charts/dashboard` · landing → marketing · code → editor · files → viewer · shell → terminal · process mining → process · tokens → tokens · icons → icons · icon rail → `ContextRail` (ui), chat drill-down → `ContextPanel` (ai)
- **D4 · Import vs copy-own** Stable shared primitives → **import** `@elabs-ai/components-*`. Prototype-specific blocks → **copy-own** (registry).
- **D5 · Scope boundary (what brand-ui ISN'T)** brand-ui is a **presentation layer**, not an SDK/runtime. It renders models; it never owns model calls.
- **D6 · Dependency & import discipline** `ai` (Vercel AI SDK) is **types-only, peer, never runtime**. Semantic tokens only; one-way dep graph.
- **D7 · Maintainer decisions** New component → dedupe-gate → right package (D3) → built to rules → **auto-registered** (gate, not memory).
<!-- brand-ui:gen:decisions:end -->

## Packages

<!-- brand-ui:gen:catalogue:start -->
<!-- Generated from the manifest by `pnpm gen`; package purposes are PKG_PURPOSE in the CLI. -->

**Themes (2):** dark, light (default) · **Tokens:** 285 · **Registry blocks:** 67 · **Components:** 446 in 13 packages

- `@elabs-ai/components-tokens` (2): Semantic CSS-variable themes + ThemeProvider/useTheme.
- `@elabs-ai/components-icons` (32): Brand/product-vocabulary icons + BrandLogo (generic glyphs use lucide-react).
- `@elabs-ai/components-ui` (132): Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).
- `@elabs-ai/components-data` (14): TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker.
- `@elabs-ai/components-ai` (75): ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, citations.
- `@elabs-ai/components-flow` (19): Branded React Flow canvas, nodes, edges, controls, inspector.
- `@elabs-ai/components-maps` (13): MapLibre GL maps: MapCanvas, markers, popups, controls, routes, arcs, GeoJSON, clusters.
- `@elabs-ai/components-charts` (96): MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download).
- `@elabs-ai/components-marketing` (8): Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.
- `@elabs-ai/components-editor` (7): Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace.
- `@elabs-ai/components-viewer` (5): FileViewer — any file (image, text, JSON, CSV) via a pluggable adapter registry.
- `@elabs-ai/components-terminal` (17): Terminal surfaces: shell/agent output and coding-agent CLI look-alikes.
- `@elabs-ai/components-process` (26): Process mining and event-log analysis: process map, variants, cases, conformance — composes flow/charts/data.

_One count per component; `brand-ui docs <Component>` lists its parts (`CardHeader`, …)._

<!-- brand-ui:gen:catalogue:end -->

## Rules that always apply

- Semantic tokens only (`bg-background`, `text-muted-foreground`, `bg-primary`,
  `border-border`); never hex, `rgb()`, `bg-[#…]` or a palette class like `text-gray-500`.
- Type is a role: `text-title`, `text-body`, `text-caption`, … or `<Heading>`/`<Text>`;
  never `text-sm` or `text-[17px]`.
- `className` is for layout, never recoloring; use the component's variants.
- Focus: `focus-ring` on any interactive element you author; never remove the outline
  without it.
- Overlays (`Dialog`, `Sheet`, `Popover`, `DropdownMenu`) own focus, dismissal and
  stacking: no hand-rolled traps, no manual `z-index`. `Dialog`, `Sheet` and `Drawer`
  need a title (`sr-only` if hidden); `Avatar` needs `AvatarFallback`.
- Real elements (`<button>`, `<a>`, `<input>`), labelled inputs, `aria-label` on
  icon-only controls. Every async region shows loading, empty and error states
  (`Skeleton`, `StatePanel`).
- It must read in every theme: rely on tokens, never `dark:`.
- Icons: `lucide-react` for generic glyphs, `@elabs-ai/components-icons` for brand marks.

## Load when needed

- Composing an app shell, dashboard, chat, flow or form: [reference/composition.md](reference/composition.md)
- Which component for a need; import or copy-own: [reference/components.md](reference/components.md)
- Rendering agent output (chat messages, tool calls, JSX strings, A2UI surfaces): [reference/agent-output.md](reference/agent-output.md)
- Charts, KPI tiles, `ChartFrame`: [reference/charts.md](reference/charts.md)
- Which chart for a data shape: `brand-ui chart-for "<data shape>"`, or [reference/chart-selection.md](reference/chart-selection.md)
- A dashboard sheet (`DashboardSpec`): [reference/sheet-for.md](reference/sheet-for.md)
- Theming and re-branding: [reference/theming.md](reference/theming.md)
- The rules above with Incorrect/Correct code: [reference/rules.md](reference/rules.md)
