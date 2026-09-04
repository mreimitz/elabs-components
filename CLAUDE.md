# CLAUDE.md

Project memory for Claude Code. Keep this lean — detailed rules live in
`.claude/rules/` and are imported below.

## Purpose

`brand-ui` is an internal, **source-owned, token-driven** React component system
for internal apps, prototypes, POCs, AI/chat clients, data grids, dashboards,
React Flow canvases and presales demos. Default look: modern enterprise SaaS,
restrained and app-first, themeable to any brand. It is a reusable system, not
an app.

## Tech stack

pnpm workspaces + Turborepo · TypeScript · React 19 · Tailwind CSS v4 (CSS
variables + `@theme inline`) · Radix UI primitives · TanStack Table · React Flow
(`@xyflow/react`) · Storybook 10 (+ `addon-mcp` / `addon-vitest` / `addon-a11y`) ·
Vitest + Testing Library · tsup · ESLint 9 + Prettier. No paid dependencies.

## Packages

- `@elabs-ai/components-tokens` — semantic CSS-variable themes + `ThemeProvider`/`useTheme`.
- `@elabs-ai/components-ui` — foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).
- `@elabs-ai/components-icons` — brand/product-vocabulary icons + `BrandLogo`. Generic UI glyphs use the **default** icon library **Lucide** (`lucide-react`); see `icons.md`.
- `@elabs-ai/components-data` — TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker.
- `@elabs-ai/components-ai` — ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, Agent, Sources, Snippet, CodeBlock, Artifact, citations.
- `@elabs-ai/components-flow` — branded React Flow canvas, nodes, edges, controls, inspector.
- `@elabs-ai/components-maps` — token-driven MapLibre GL maps: MapCanvas (theme-aware basemap), MapMarker (+ content/label/popup/tooltip), MapPopup, MapControls, MapRoute, MapArc, MapGeoJSON, MapClusterLayer.
- `@elabs-ai/components-charts` — MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download wrapper), AutoChart (smart spec-driven chart that picks the right chart from a serializable `ChartSpec`).
- `@elabs-ai/components-marketing` — Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.
- `@elabs-ai/components-editor` — token-themed Monaco (VS Code) code editor: CodeEditor, DiffEditor, CodeWorkspace (file tabs), with a brand-ui context menu.
- `@elabs-ai/components-viewer` — FileViewer: render a file the app did not write (upload, signed URL, agent output) through a pluggable adapter registry. See ADR 0024.
- `@elabs-ai/components-terminal` — terminal surfaces: shell/agent output and coding-agent CLI look-alikes. A **layer-2 leaf** — nothing depends on it, and `@elabs-ai/components-ai` must never import it.
- Apps: `apps/docs` (Storybook); `fixtures/consumer-smoke` (install-shape smoke test).

## Architecture rules

- Dependencies flow one way: `tokens` → `ui`/`icons` → `data`/`ai`/`flow`/`maps`/`charts`/`marketing`/`editor`/`viewer`/`terminal` → `process`.
  `process` is the one **layer-3** package (ADR 0034): it composes `flow`/`charts`/`data`/`ui`
  and nothing depends on it. Primitives go DOWN into the base package that owns them;
  compositions go UP. Layer-2 leaves still never import each other.
- Import across packages via `@elabs-ai/components-*`, never relative paths.
- Two consumption modes: import stable primitives from `@elabs-ai/components-*`; copy-own
  prototype blocks via the registry (`npx shadcn add`).
- Internal packages export TypeScript source (apps transpile directly); `tsup`
  builds `dist/` for distribution.

## Commands

- `pnpm install` · `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test`
- `pnpm storybook` (Storybook) · `pnpm format`
- `pnpm --filter @elabs-ai/components-docs test-storybook` (run stories as browser interaction + a11y tests)
- `pnpm registry:validate` · scope anything with `--filter @elabs-ai/components-<pkg>`

## Coding standards

- `forwardRef` + spread `...props` + accept `className` merged via `cn()`.
- Variants via `class-variance-authority`; export public types.
- Semantic tokens only — **no raw hex outside `packages/tokens/src/themes.css`**.
- Radix primitives for interactive/overlay behavior; React Aria only where it
  clearly helps.

## Component creation workflow

Use `/new-component <pkg> <Name> [purpose]`. Create `tsx`, `index.ts`,
`*.stories.tsx`, `*.test.tsx`; use tokens; add the barrel export; run
`pnpm --filter @elabs-ai/components-<pkg> typecheck test`. Audit with `/review-component`.

## Storybook MCP (agent tooling)

When the Storybook dev server is running (`pnpm storybook`, MCP at
`http://localhost:6006/mcp`), prefer the `storybook` MCP tools (`mcp__storybook__*`)
over grepping source or guessing APIs: discover/dedupe components, read **real**
props, author stories, preview them, and run component + a11y tests. **Never
hallucinate a component prop — verify it via the MCP docs tools first.** When you
need to verify UI or use these tools and the server is down, **start it**
(`pnpm storybook` in the background) — that's the intended way to test — and stop
it when done. Don't start it for work unrelated to the UI. See storybook-mcp rule.

## Theming rules

Themes are `data-theme` blocks in `themes.css`, exposed via `@theme inline`. Add
one with `/new-theme`. Every theme overrides every token. See theming rule below.
**Two themes ship: `light` (default) and `dark`.** A separate **decoration dial**
(`--decoration` 0–10, orthogonal to color) adds reprographic drafting texture to
any theme/color; see `decoration.css` + the decoration rule.

## Registry rules

Stable primitives → packages; prototype compositions → registry blocks/templates.
Keep `registry/registry.json` valid (`pnpm registry:validate`). See registry rule.

## Safety rules

- Never commit secrets, `.env`, or machine-specific absolute paths.
- No destructive commands; no force pushes (hooks enforce this).
- No paid dependencies; don't build closed abstractions that block editing.

## Quality gates

Before "done": types exported, composable, semantic tokens, theme-safe,
accessible, story + smoke test, barrel export, green typecheck/lint/test. Full
list in the quality-gates rule.

## Issue workflow

Findings (from tests, finder agents, or user feedback) become **GitHub issues** —
finders report, they don't fix. Every finding goes through deep root-cause
analysis (`brand-ui-root-cause-analyst`) and is filed with `/file-issue`; the fix is done
separately from the issue. See the issue-workflow rule.

**Session self-review:** run `/session-retro` after a work session to audit the
agent's _own_ process. A fresh `brand-ui-session-reviewer` reads the on-disk transcript for
mistakes, skipped steps, needed reminders/corrections and lazy shortcuts, files
them as `meta`/`type:process` issues, then hardens governance (rules + active
hooks) so they can't recur. See `.claude/commands/session-retro.md`.

## Detailed rules (imported)

**Canonical decisions** (D1–D7 — how & when to use what): see `docs/DECISIONS.md`, the single
source; the decision rules below (`decision-routing`, `ai-sdk-vs-a2ui`, `scope-and-non-goals`)
link it. The summary below is mirrored here in a generated, stale-gated region — edit the
decisions in `docs/DECISIONS.md` and run `pnpm gen`.

<!-- brand-ui:gen:decisions:start -->
<!-- Generated from the DECISIONS:SUMMARY region of `docs/DECISIONS.md` — edit decisions there, not here. -->

| #      | Decision                             | The short answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Detail rule                                                                                                                   |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Which paradigm?                      | **Build-with** components (you/the agent write the code) — the default, ~99%. Generative-UI is rare.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [`decision-routing.md`](../.claude/rules/decision-routing.md)                                                                 |
| **D2** | Rendering agent output               | A **conversation** → AI SDK `UIMessage` + `@elabs-ai/components-ai`. An **agent-designed surface** → A2UI (WP-11).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | [`ai-sdk-vs-a2ui.md`](../.claude/rules/ai-sdk-vs-a2ui.md)                                                                     |
| **D3** | Which package                        | app UI → `@elabs-ai/components-ui` · data → `@elabs-ai/components-data` · chat → `@elabs-ai/components-ai` · canvas → `@elabs-ai/components-flow` (author-built diagrams) · in-chat agent workspace graph → `@elabs-ai/components-ai` (ADR 0018) · KPIs → `@elabs-ai/components-charts` · landing → `@elabs-ai/components-marketing` · code → `@elabs-ai/components-editor` · viewing a file the app did not write → `@elabs-ai/components-viewer` · shell/agent console → `@elabs-ai/components-terminal` · process mining / event-log analysis → `@elabs-ai/components-process` (the one layer-3 package, ADR 0034) · tokens → `@elabs-ai/components-tokens` · icons → `@elabs-ai/components-icons`. | `skills/brand-ui/SKILL.md` (generated table)                                                                                  |
| **D4** | Import vs copy-own                   | Stable shared primitives → **import** `@elabs-ai/components-*`. Prototype-specific blocks → **copy-own** (registry).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [`registry.md`](../.claude/rules/registry.md)                                                                                 |
| **D5** | Scope boundary (what brand-ui ISN'T) | brand-ui is a **presentation layer**, not an SDK/runtime. It renders models; it never owns model calls.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | [`scope-and-non-goals.md`](../.claude/rules/scope-and-non-goals.md)                                                           |
| **D6** | Dependency & import discipline       | `ai` (Vercel AI SDK) is **types-only, peer, never runtime**. Semantic tokens only; one-way dep graph.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [`ai-sdk-vs-a2ui.md`](../.claude/rules/ai-sdk-vs-a2ui.md) · [`styling-and-tokens.md`](../.claude/rules/styling-and-tokens.md) |
| **D7** | Maintainer decisions                 | New component → dedupe-gate → right package (D3) → built to rules → **auto-registered** (gate, not memory).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [`quality-gates.md`](../.claude/rules/quality-gates.md)                                                                       |

<!-- brand-ui:gen:decisions:end -->

Rules live in `.claude/rules/*.md` and are **auto-discovered by Claude Code** — they do
NOT need `@`-imports here to load. To keep the per-session context lean, rules are split
two ways (enforced by `pnpm rules:scoping:check` — `scripts/check-rule-scoping.mjs`):

- **Cross-cutting rules load on EVERY session** (no `paths:` frontmatter): `design-system`,
  `design-first`, `component-api`, `styling-and-tokens`, `theming`, `accessibility`,
  `interaction-guidelines`, `conceptual-framing`, `quality-gates`, `issue-workflow`,
  `icons`, `storybook-mcp`, `decision-routing`, `scope-and-non-goals`, `loading-states`,
  `attribution`.
- **Package/area rules are path-scoped** (`paths:` frontmatter) so Claude Code lazy-loads
  them only when a matching file is touched — `chart-components` (`packages/charts/**`),
  `editor-components` (`packages/editor/**`), `viewer-components` (`packages/viewer/**`),
  `react-flow-components` (`packages/flow/**`), `map-components` (`packages/maps/**`),
  `data-components` (`packages/data/**`), `ai-chat-components` + `ai-sdk-vs-a2ui`
  (`packages/ai/**`), `decoration` (`packages/tokens/**`),
  `terminal-components` (`packages/terminal/**`), `process-components`
  (`packages/process/**`),
  `registry` (`registry/**`), and `architecture-review` (arch-review machinery; the
  `repo-architect-*` agents Read it explicitly). Lazy-loading is acceptable for
  package-specific detail; cross-cutting rules stay always-on for this reason.

> Note: an `@`-import here would force a rule to load on every session, defeating the
> path-scoping — so scoped rules must NOT be `@`-imported (the gate enforces this).
