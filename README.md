# brand-ui

[![npm](https://img.shields.io/npm/v/@elabs-ai/components-ui?label=npm&color=CB3837)](https://www.npmjs.com/package/@elabs-ai/components-ui)
[![license](https://img.shields.io/npm/l/@elabs-ai/components-ui?color=0A7EA4)](LICENSE)
[![CI](https://github.com/mreimitz/elabs-components/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mreimitz/elabs-components/actions/workflows/ci.yml)

**A source-owned, token-driven React component system for building real applications —
dashboards, data grids, AI chat clients, node canvases, maps, code editors and the
marketing page in front of them.**

React 19 · TypeScript · Tailwind CSS v4 · Radix UI · Storybook 10 · Vitest · pnpm + Turborepo

Most component libraries give you buttons and inputs, then leave you to invent the
hard parts. brand-ui ships the hard parts: a virtualized data table, a streaming chat
transcript with tool calls and citations, a themed Monaco editor, a React Flow canvas,
token-driven MapLibre maps, and a chart layer that picks the right chart from a spec.
All of it renders through **one semantic token system**, so re-branding the entire
surface is a stylesheet change — never a component change.

It is also built to be **read and edited**. Nothing is hidden behind a clever
abstraction, every component is plain TypeScript you can open and change, and the whole
system is legible to coding agents through a CLI, an MCP server and a generated manifest.

## Docs & hosted MCP

- **Website:** **[elabs-ai.com](https://elabs-ai.com)** — the packages, the blocks, the
  templates and the charts, built from nothing but brand-ui itself.
- **Storybook:** **[elabs-ai.com/storybook](https://elabs-ai.com/storybook)** — every
  component, every variant, live, in every theme, with a props table per component.
- **Hosted MCP (nothing to install):** point any MCP host at
  `https://elabs-ai.com/mcp` and it can look up real props, variants, intent, tokens and
  chart choices instead of guessing.

  ```bash
  claude mcp add --transport http brand-ui https://elabs-ai.com/mcp
  ```

  Same tools over stdio, offline or in CI: `npx -y @elabs-ai/components-cli mcp`
  (the local server adds `audit`, which needs your source tree).

- **For agents without MCP:** **[elabs-ai.com/llms.txt](https://elabs-ai.com/llms.txt)** —
  a generated hub with the package routing map, the rules of the road and per-package
  spokes at `/llms/<package>.txt`.
- **Copy-own blocks:** the shadcn-compatible registry is served from the same host at
  `/r/registry.json`.

Everything above answers identically on
**[elabs-components.vercel.app](https://elabs-components.vercel.app)**, the same
deployment under its provider address.

## Scope

brand-ui is a **presentation layer**, not an SDK or a runtime. It renders messages,
surfaces and components; it never owns model calls, streaming, transport or providers —
that stays in the consuming app. It is also not a finished, single-brand visual identity
or a locked component library: components are source you're meant to read and edit. Full
statement: decision **D5** in [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Highlights

- **Thirteen packages, one design language.** App UI, data, AI, flow, maps, charts,
  editor, viewer, terminal, process, marketing, icons and tokens — all built on the same
  semantic tokens, the same variant conventions and the same accessibility baseline.
- **Open theming.** A theme is not a member of a list this project controls. Write a
  stylesheet, register it, done — no fork required. The two themes we ship are worked
  examples, not the menu.
- **Accessibility is enforced, not aspirational.** Every story runs `axe` in a real
  browser as a blocking check, on a ratchet that can only tighten.
- **Agent-native.** A `brand-ui` CLI and an MCP server expose real props, real tokens
  and a static design-system linter, so an AI assistant extends the system from ground
  truth instead of guessing.
- **Self-maintaining.** Automated gates keep conventions true — token discipline,
  contrast ratios, one-way package dependencies, focus-ring contracts, motion tokens,
  microcopy, bundle weight and documentation accuracy. Catalogue: `docs/GATES.md`.
- **Two ways to consume.** Import stable primitives from the packages, or copy-own
  prototype compositions from the shadcn-compatible registry and edit them freely.

---

## Packages

All fourteen publish to the public npm registry under the `@elabs-ai` scope. Package
names below link to their npm page.

| Package                                                                                          | What it gives you                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [`@elabs-ai/components-tokens`](https://www.npmjs.com/package/@elabs-ai/components-tokens)       | The semantic token system, reference themes, `ThemeProvider`, and the density / motion / decoration dials                          |
| [`@elabs-ai/components-ui`](https://www.npmjs.com/package/@elabs-ai/components-ui)               | Application components — buttons, forms, overlays, navigation, tables, app shells, wizards, editors-of-lists                       |
| [`@elabs-ai/components-icons`](https://www.npmjs.com/package/@elabs-ai/components-icons)         | Icon primitives, `BrandLogo`, and a replaceable sample vocabulary (generic glyphs come from Lucide)                                |
| [`@elabs-ai/components-data`](https://www.npmjs.com/package/@elabs-ai/components-data)           | TanStack-powered `DataTable` with filtering, faceting, column picking and virtualization                                           |
| [`@elabs-ai/components-ai`](https://www.npmjs.com/package/@elabs-ai/components-ai)               | Chat and agent surfaces — conversation, streaming messages, tool calls, reasoning, sources, artifacts, terminals, agent canvas     |
| [`@elabs-ai/components-flow`](https://www.npmjs.com/package/@elabs-ai/components-flow)           | A branded React Flow canvas: nodes, edges, controls, minimap, inspector                                                            |
| [`@elabs-ai/components-maps`](https://www.npmjs.com/package/@elabs-ai/components-maps)           | Token-driven MapLibre GL maps — theme-aware basemaps, markers, popups, routes, arcs, GeoJSON, clustering                           |
| [`@elabs-ai/components-charts`](https://www.npmjs.com/package/@elabs-ai/components-charts)       | Metric cards, chart frames with expand/flip/download, and `AutoChart` — the right chart from a serializable spec                   |
| [`@elabs-ai/components-editor`](https://www.npmjs.com/package/@elabs-ai/components-editor)       | A token-themed Monaco editor: code, diff, multi-file workspace, brand context menu                                                 |
| [`@elabs-ai/components-viewer`](https://www.npmjs.com/package/@elabs-ai/components-viewer)       | `FileViewer` — render a file your app did not write (upload, signed URL, agent output) through a pluggable adapter registry        |
| [`@elabs-ai/components-terminal`](https://www.npmjs.com/package/@elabs-ai/components-terminal)   | Terminal surfaces — shell and agent output, and coding-agent CLI look-alikes                                                       |
| [`@elabs-ai/components-process`](https://www.npmjs.com/package/@elabs-ai/components-process)     | Process mining and event-log analysis — process map, variant explorer, case list, conformance (composes flow, charts and data)     |
| [`@elabs-ai/components-marketing`](https://www.npmjs.com/package/@elabs-ai/components-marketing) | Hero, feature grid, stats band, CTA, logo strip — for the page in front of the product                                             |
| [`@elabs-ai/components-cli`](https://www.npmjs.com/package/@elabs-ai/components-cli)             | The `brand-ui` CLI and MCP server: project context, component search, real props, static audit, app scaffolding, migration tooling |

<!-- brand-ui:gen:counts:start -->
<!-- Generated by `pnpm gen` from brand-ui.manifest.json, the token contract and docs/ADR — edit those, not this. -->

**By the numbers:** 469 components across 13 packages — tokens 2 · icons 32 · ui 139 · data 16 · ai 75 · flow 19 · maps 18 · charts 105 · marketing 8 · editor 7 · viewer 5 · terminal 17 · process 26. A component counts once per component module; its sub-parts (`CardHeader`) and exported constants are not counted separately. The theme token contract (`THEME_TOKEN_NAMES`) has 241 tokens, and 44 architecture decision records explain the _why_.

<!-- brand-ui:gen:counts:end -->

Dependencies flow one way — `tokens` → `ui`/`icons` → everything else — and a rule
(`pnpm check --rule dep-direction`) fails any change that points an edge sideways or upward.

> The **Packages** panel on this repository's GitHub sidebar stays empty by design. It
> only lists GitHub Packages (`npm.pkg.github.com`), a different registry that would
> require every consumer to authenticate with a GitHub token before installing. These
> packages ship to npmjs.org instead, where `pnpm add` needs no credentials at all.

---

## Quick start

### Install into your app

```bash
pnpm add @elabs-ai/components-tokens @elabs-ai/components-ui
# then add only what that screen needs
pnpm add @elabs-ai/components-data @elabs-ai/components-charts
```

React 19 and `react-dom` are peer dependencies you provide. Every package carries its
own extras — the map, editor, flow and chart engines are peers of their package, so you
only install the ones you render.

### Or work on the system itself

**Requirements:** Node ≥ 20, pnpm ≥ 9 (`corepack enable`).

```bash
git clone https://github.com/mreimitz/elabs-components.git
cd elabs-components
pnpm install
pnpm storybook        # http://localhost:6006
```

Storybook is the reference implementation: every component, every variant, every
state, in both themes, with interaction and accessibility tests attached.

### Using the components

```tsx
// once, at the app root
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { Button, Card, CardHeader, CardTitle, CardContent } from "@elabs-ai/components-ui";
import { DataTable } from "@elabs-ai/components-data";

export function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <Card>
        <CardHeader>
          <CardTitle>Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={rows} />
          <Button>Export</Button>
        </CardContent>
      </Card>
    </ThemeProvider>
  );
}
```

```css
/* your CSS entry */
@import "@elabs-ai/components-tokens/styles.css"; /* Tailwind bridge + neutral base + fonts */
@import "@elabs-ai/components-tokens/themes/light.css"; /* opt-in reference themes */
@import "@elabs-ai/components-tokens/themes/dark.css";

@source "../node_modules/@elabs-ai/components-ui/dist"; /* one per package you render */
```

> The `@source` line is required. Tailwind does not scan `node_modules` unless you
> tell it to, and skipping it renders every component unstyled.

Consuming from a separate project — peer dependencies, Next.js wiring, per-package
extras, troubleshooting — is documented in [`docs/CONSUMING.md`](docs/CONSUMING.md).

---

## Theming

A theme is a `[data-theme]` block that covers the semantic token contract, registered
on a provider. That is the whole definition — it does not have to come from this
repository.

```tsx
import {
  BUILT_IN_THEME_DEFINITIONS,
  defineTheme,
  ThemeProvider,
} from "@elabs-ai/components-tokens";

const acme = defineTheme({ value: "acme", label: "Acme", dark: false });

<ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, acme]} defaultTheme="acme">
  {children}
</ThemeProvider>;
```

The token contract ships as data (`THEME_TOKEN_NAMES`), so you can assert
in your own test suite that your stylesheet covers it. Every switcher and every
darkness-dependent surface — the code editor's base theme, the map's basemap, toast
styling — reads the active theme at runtime rather than looking a name up in a list,
so a theme you wrote resolves correctly without registering anything anywhere.

Two reference themes ship: `light` (default) and `dark`. Beyond colour, three
orthogonal dials adjust the same components without touching them:

| Dial           | Values                           | Effect                                                      |
| -------------- | -------------------------------- | ----------------------------------------------------------- |
| **density**    | compact · comfortable · spacious | Scales spacing _and_ type together, with a legibility floor |
| **motion**     | system · reduced · full          | Honours the OS preference; `full` is the user's own consent |
| **decoration** | 0–10                             | Adds hue-independent drafting texture to any theme          |

Design rationale: [`docs/ADR/0029-open-theme-registry.md`](docs/ADR/0029-open-theme-registry.md)
and [`docs/TOKEN_GUIDELINES.md`](docs/TOKEN_GUIDELINES.md).

---

## Built for coding agents

The system is designed so an AI assistant can extend it correctly without reading
every file — and without inventing props that do not exist.

```bash
brand-ui info                 # packages, themes, tokens, registry, active taste profile
brand-ui search "data table"  # find components, hooks, blocks, whole-screen playbooks
brand-ui docs Button          # real props, read from source — not from a doc that drifted
brand-ui audit src/Page.tsx   # static token, style and content lint (--strict to gate)
brand-ui scaffold spec.md     # plan or emit a runnable, born-compliant app
brand-ui scan . --out ./m     # profile an existing repo for migration
brand-ui a2ui catalog         # generative UI: the types an agent may emit as data
```

When the agent has to **design a screen at runtime** — not write it ahead of time — it
emits an A2UI surface: JSON naming catalog types, validated against the catalog and
rendered by `<A2uiSurface>` from `@elabs-ai/components-ai`, with actions routed back to
your app. `brand-ui a2ui catalog | schema | validate | example` and the hosted MCP's `a2ui`
tool are its tooling; the page is
[Generative UI (A2UI)](https://elabs-ai.com/?path=/docs/docs-generative-ui-a2ui--docs).

`scaffold` auto-detects whether it is running **inside** this monorepo (a
`packages/ui` sibling) and defaults its app-spec's `"standalone"` key accordingly —
real semver `@elabs-ai/components-*` ranges (+ the full install handoff) everywhere
else, `workspace:*` + the shared eslint config only when it really is this repo. Set
`"standalone"` explicitly in the spec to override the detection; see
[`docs/CONSUMING.md`](docs/CONSUMING.md).

Two MCP servers are wired in [`.mcp.json`](.mcp.json): a persistent **`brand-ui`**
server that answers from the committed manifest (works with Storybook down), and a
**`storybook`** server that exposes live previews and browser-based test runs while the
dev server is up.

The repository also carries its own operating manual — a small set of rules
(`.claude/rules/`), architecture decision records, slash commands, review agents and
edit-time hooks. Start at [`CLAUDE.md`](CLAUDE.md) or [`AGENTS.md`](AGENTS.md).

---

## Quality bar

| Layer                 | What runs                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------- |
| **Unit**              | Vitest + Testing Library — 294 co-located test files, 3,293 assertions                      |
| **Browser**           | Stories run as real browser interaction tests — 254 files, ~1,050 runs, each `axe`-asserted |
| **Accessibility**     | `axe` violations are **blocking**, on a ratchet baseline that can only shrink               |
| **Contrast & colour** | WCAG AA body text and 3:1 non-text contrast asserted per theme, in OKLab, per token role    |
| **Architecture**      | One-way package dependency graph, subpath export discipline, no eager heavy engines         |
| **Documentation**     | Generated regions, component manifest, inventory and agent context are all freshness-gated  |

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm --filter @elabs-ai/components-docs test-storybook   # interaction + axe, in a real browser
```

Gate scripts (`pnpm <name>:check`, catalogued in `docs/GATES.md`) enforce the conventions
above, most shipping a self-test that plants a broken fixture and asserts the gate
fails — because a gate that silently stops firing is worse than no gate at all.

**Browser floor:** Chrome/Edge 119, Safari 16.4, Firefox 128 (set by CSS relative
colour syntax). Below it the colour system still works and the decoration dial
degrades to off. Details: [`docs/BROWSER-SUPPORT.md`](docs/BROWSER-SUPPORT.md).

---

## Repository layout

```
packages/     tokens · ui · icons · data · ai · flow · maps · charts
              editor · viewer · marketing · cli
apps/docs/    Storybook — the reference implementation
registry/     shadcn-compatible blocks and templates for copy-own mode
docs/         guidelines, ADRs, playbooks, consuming and releasing guides
.claude/      rules, commands, agents and hooks that govern contributions
```

### Common tasks

```bash
pnpm dev                  # all dev tasks (turbo)
pnpm build                # build every package
pnpm test                 # unit + smoke
pnpm storybook            # docs and reference implementation
pnpm format               # prettier
pnpm check --rule registry-validate   # validate the copy-own registry
pnpm --filter @elabs-ai/components-ui test   # scope any task to one package
```

---

## Documentation

| Document                                                       | Covers                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                       | The seven decisions that govern how and when to use what |
| [`docs/CONSUMING.md`](docs/CONSUMING.md)                       | Using the packages from another project, end to end      |
| [`docs/I18N.md`](docs/I18N.md)                                 | Plurals and bridging LocaleProvider to your i18n runtime |
| [`docs/COMPONENT_GUIDELINES.md`](docs/COMPONENT_GUIDELINES.md) | Component API conventions and the definition of done     |
| [`docs/TOKEN_GUIDELINES.md`](docs/TOKEN_GUIDELINES.md)         | The token system and how to brand it                     |
| [`docs/REGISTRY_GUIDELINES.md`](docs/REGISTRY_GUIDELINES.md)   | Package versus registry — import or copy-own             |
| [`docs/TESTING.md`](docs/TESTING.md)                           | The testing layers and what each one proves              |
| [`docs/MOTION_GUIDELINES.md`](docs/MOTION_GUIDELINES.md)       | Motion tokens and reduced-motion behaviour               |
| [`docs/BROWSER-SUPPORT.md`](docs/BROWSER-SUPPORT.md)           | The support floor and what degrades below it             |
| [`docs/CSP-AND-NETWORK.md`](docs/CSP-AND-NETWORK.md)           | Content Security Policy and every remote origin used     |
| [`docs/ADR/`](docs/ADR/)                                       | Architecture decision records — the durable _why_        |
| [`PROJECT.md`](PROJECT.md)                                     | Vision, goals, scope and non-goals                       |

---

## Contributing

Setup, branch style, the component workflow, testing expectations and the pull-request
checklist are in [`CONTRIBUTING.md`](CONTRIBUTING.md). In short: components use semantic
tokens, compose with `forwardRef` + `className` + `cva`, lean on Radix for interactive
behaviour, ship a co-located story and test, export their types, work in both themes,
and pass `pnpm check` before they are considered done.

## Attribution

brand-ui is built on other people's work. [`ATTRIBUTION.md`](ATTRIBUTION.md) credits all
of it — adapted and vendored source, runtime map data, self-hosted fonts and every
dependency — with the licence and copyright line for each. It is generated from the
repository, so it cannot drift from what actually ships. If you borrow from another
project, credit it in the same change.

## Status

Published and public, and still actively developed:

- **Released to npm.** All fourteen packages ship to the public registry under the
  `@elabs-ai` scope, versioned in lockstep. Release procedure:
  [`docs/RELEASING.md`](docs/RELEASING.md).
- **MIT licensed** ([`LICENSE`](LICENSE)). Several dependencies listed in
  [`ATTRIBUTION.md`](ATTRIBUTION.md) oblige their own notices to travel with the code —
  that file is generated from the repository, so it cannot drift from what ships.
- **CI runs on every push and pull request.** One workflow runs typecheck, lint,
  format, the `pnpm check` rules and their self-tests, tests, build, generated-file
  freshness, a consumer install check and the Storybook tests in both themes; releases go
  through Changesets.
- **The API is not frozen.** Breaking changes go out as majors and are recorded in
  [`CHANGELOG.md`](CHANGELOG.md).
