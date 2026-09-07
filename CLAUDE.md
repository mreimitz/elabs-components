# CLAUDE.md

Project memory for Claude Code — lean by design; the binding detail lives in `.claude/rules/`.

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
- `@elabs-ai/components-charts` — MetricCard, MetricGrid, ChartCard, ChartFrame, AutoChart (spec-driven via a serializable `ChartSpec`).
- `@elabs-ai/components-marketing` — Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.
- `@elabs-ai/components-editor` — token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace (file tabs).
- `@elabs-ai/components-viewer` — FileViewer: a file the app did not write, via a pluggable adapter registry (ADR 0024).
- `@elabs-ai/components-terminal` — terminal surfaces (shell/agent output, coding-agent CLI look-alikes); a layer-2 leaf — `@elabs-ai/components-ai` must never import it.
- `@elabs-ai/components-process` — process mining / event-log analysis; the one layer-3 package (ADR 0034).
- Apps: `apps/docs` (Storybook); `fixtures/consumer-smoke` (install-shape smoke test).

## Architecture rules

- Dependencies flow one way: `tokens` → `ui`/`icons` → `data`/`ai`/`flow`/`maps`/`charts`/`marketing`/`editor`/`viewer`/`terminal` → `process`.
  `process` is the one **layer-3** package (ADR 0034): it composes `flow`/`charts`/`data`/`ui`
  and nothing depends on it. Primitives go DOWN into the base package that owns them;
  compositions go UP. Layer-2 leaves still never import each other.
- Import across packages via `@elabs-ai/components-*`, never relative paths.
- Two consumption modes: import stable primitives; copy-own prototype blocks via the registry (`npx shadcn add`).
- Packages export TypeScript source (apps transpile it); `tsup` builds `dist/` for distribution.

## Commands

- `pnpm install` · `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm format`
- `pnpm check:changed` (typecheck/lint/test scoped to the diff vs `origin/main`) · `pnpm gates` (every gate, in parallel)
- `pnpm storybook` · `pnpm --filter @elabs-ai/components-docs test-storybook` (stories as interaction + a11y tests)
- `pnpm registry:validate` · scope anything with `--filter @elabs-ai/components-<pkg>`

## Coding standards

- `forwardRef` + spread `...props` + accept `className` merged via `cn()`.
- Variants via `class-variance-authority`; export public types.
- Semantic tokens only — **no raw hex outside `packages/tokens/src/themes.css`**.
- Radix primitives for interactive/overlay behavior; React Aria only where it clearly helps.

## Component creation workflow

Use `/new-component <pkg> <Name> [purpose]`: `tsx`, `index.ts`, `*.stories.tsx`, `*.test.tsx`, tokens, barrel export,
then `pnpm --filter @elabs-ai/components-<pkg> typecheck && pnpm --filter @elabs-ai/components-<pkg> lint && pnpm --filter @elabs-ai/components-<pkg> test`. Audit with `/review-component`.

## Storybook MCP (agent tooling)

With `pnpm storybook` running (MCP at `http://localhost:6006/mcp`) prefer `mcp__storybook__*` over grepping source: real props, previews, interaction + a11y tests.
**Never hallucinate a component prop — verify it via the MCP docs tools first.**
Start the server (background) to verify UI and stop it when done; never for non-UI work. See the storybook-mcp rule.

## Theming rules

Themes are `data-theme` blocks in `themes.css`, exposed via `@theme inline`; every theme overrides every token. Add one with `/new-theme`.
**Two themes ship: `light` (default) and `dark`.**
The **decoration dial** (`--decoration` 0–10, orthogonal to color) adds drafting texture to any theme; see the decoration + theming rules.

## Registry rules

Stable primitives → packages; prototype compositions → registry blocks/templates.
Keep `registry/registry.json` valid (`pnpm registry:validate`). See the registry rule.

## Safety rules

- Never commit secrets, `.env`, or machine-specific absolute paths.
- No destructive commands; no force pushes (hooks enforce this).
- No paid dependencies; don't build closed abstractions that block editing.

## Quality gates

Run the scoped checks locally (`pnpm check:changed`); the full battery is CI (`pnpm gates` mirrors it).
Definition of done: [the quality-gates rule](.claude/rules/quality-gates.md).

## Issue workflow

Fix small in-scope findings directly; file only what you leave behind — `/file-issue` batches
findings into root-caused GitHub issues (finders report, builders fix). See the issue-workflow rule.

## Detailed rules

**Canonical decisions** (D1–D7): `docs/DECISIONS.md` is the single source; the table below is a generated, stale-gated mirror — edit there, then run `pnpm gen`.

<!-- brand-ui:gen:decisions:start -->
<!-- Generated from the DECISIONS:SUMMARY region of `docs/DECISIONS.md` — edit decisions there, not here. -->

<!-- prettier-ignore -->
| # | Decision | The short answer | Detail rule |
| --- | --- | --- | --- |
| **D1** | Which paradigm? | **Build-with** components (you/the agent write the code) — the default, ~99%. Generative-UI is rare. | [`decision-routing.md`](../.claude/rules/decision-routing.md) |
| **D2** | Rendering agent output | A **conversation** → AI SDK `UIMessage` + `@elabs-ai/components-ai`. An **agent-designed surface** → A2UI (WP-11). | [`ai-sdk-vs-a2ui.md`](../.claude/rules/ai-sdk-vs-a2ui.md) |
| **D3** | Which package | `@elabs-ai/components-*`: app UI → ui · data → data · chat → ai · canvas → `@elabs-ai/components-flow` · in-chat agent workspace graph → `@elabs-ai/components-ai` · KPIs → charts · landing → marketing · code → editor · files → viewer · shell → terminal · process mining → process · tokens → tokens · icons → icons · icon rail → `ContextRail` (ui), chat drill-down → `ContextPanel` (ai) | `skills/brand-ui/SKILL.md` (generated table) |
| **D4** | Import vs copy-own | Stable shared primitives → **import** `@elabs-ai/components-*`. Prototype-specific blocks → **copy-own** (registry). | [`registry.md`](../.claude/rules/registry.md) |
| **D5** | Scope boundary (what brand-ui ISN'T) | brand-ui is a **presentation layer**, not an SDK/runtime. It renders models; it never owns model calls. | [`scope-and-non-goals.md`](../.claude/rules/scope-and-non-goals.md) |
| **D6** | Dependency & import discipline | `ai` (Vercel AI SDK) is **types-only, peer, never runtime**. Semantic tokens only; one-way dep graph. | [`ai-sdk-vs-a2ui.md`](../.claude/rules/ai-sdk-vs-a2ui.md) · [`styling-and-tokens.md`](../.claude/rules/styling-and-tokens.md) |
| **D7** | Maintainer decisions | New component → dedupe-gate → right package (D3) → built to rules → **auto-registered** (gate, not memory). | [`quality-gates.md`](../.claude/rules/quality-gates.md) |

<!-- brand-ui:gen:decisions:end -->

- **Cross-cutting rules load on EVERY session** (no `paths:` frontmatter): `design-system`, `design-first`, `component-api`, `styling-and-tokens`, `theming`, `accessibility`, `interaction-guidelines`, `conceptual-framing`, `quality-gates`, `issue-workflow`, `icons`, `storybook-mcp`, `decision-routing`, `scope-and-non-goals`, `loading-states`, `attribution`.
- **Package/area rules are path-scoped** (`paths:` frontmatter, loaded only when a matching file is touched): chart-components, editor-components, viewer-components, react-flow-components, map-components, data-components, ai-chat-components, ai-sdk-vs-a2ui, decoration, terminal-components, process-components, registry, architecture-review.

Always-on governance is budgeted (72 KB total, 8 KB per rule — `pnpm rules:scoping:check`); history lives in `docs/rules-history/`.
