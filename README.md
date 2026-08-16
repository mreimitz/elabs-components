# brand-ui

An internal, **source-owned, token-driven** React component system for internal
apps, prototypes, POCs, AI/chat clients, data grids, dashboards, React Flow
canvases and presales demos. Modern enterprise SaaS look by default, themeable to
any brand. Built to be fast to use and easy for coding agents to extend.

> This is a **starting foundation**, not a finished brand. Tokens are neutral
> placeholders — see `docs/TOKEN_GUIDELINES.md` for how to apply a real brand.

## Who it's for

Internal teams building many apps that should look consistent and on-brand:
product prototypes, customer POCs, internal tools, AI assistants, data apps and
flow/design surfaces — plus the occasional marketing page.

## What's inside

A pnpm + Turborepo monorepo:

- `packages/tokens` — semantic CSS-variable themes + `ThemeProvider`.
- `packages/ui` — full shadcn-equivalent set (~57): foundation (Button, Card, Input…),
  forms (Select, Checkbox, RadioGroup, Switch, Slider, Combobox, Form, Calendar,
  DatePicker, InputOTP…), overlays (Dialog, Sheet, Drawer, Popover, Alert(Dialog),
  Context/Menubar/Navigation menus, Command…), display & nav (Avatar, Progress,
  Table, Breadcrumb, Pagination, Carousel, Resizable…), plus app shells.
- `packages/icons` — branded monoline icons + `BrandLogo`.
- `packages/data` — TanStack DataTable, filters, column picker.
- `packages/ai` — chat shell, messages, tool calls, citations, context.
- `packages/flow` — branded React Flow canvas, nodes, edges, controls.
- `packages/charts` — KPI metric cards + chart container.
- `packages/marketing` — landing-page sections.
- `apps/docs` — Storybook.
- `registry/` — shadcn-compatible registry for copy-owned blocks.

## Requirements

- Node ≥ 20
- pnpm ≥ 9 (`corepack enable` or `npm i -g pnpm`)

## Install

```bash
pnpm install
```

## Run the docs (Storybook)

```bash
pnpm storybook        # http://localhost:6006
```

Storybook loads stories co-located in every package and includes a theme
switcher (Light [default], Dark).

## Use the packages (import mode)

```tsx
// once, at the app root:
import "@elabs/components-tokens/styles.css";
import { ThemeProvider } from "@elabs/components-tokens";

import { Button, Card, CardHeader, CardTitle } from "@elabs/components-ui";
import { DataTable } from "@elabs/components-data";

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
        </CardHeader>
        <Button>Click me</Button>
      </Card>
    </ThemeProvider>
  );
}
```

React Flow consumers also import its CSS once: `import "@xyflow/react/dist/style.css"`.

Consuming `@elabs/components-*` from a **separate** project (tarball install, Tailwind v4 +
token wiring, making your coding agent brand-ui-aware)? See
[`docs/CONSUMING.md`](docs/CONSUMING.md).

## Add components

```bash
# Claude Code: scaffold a component end-to-end
/new-component ui Tooltip "hover hint for icon buttons"
```

Or follow `docs/COMPONENT_GUIDELINES.md`: create `component.tsx`, `index.ts`,
`*.stories.tsx`, `*.test.tsx`, use semantic tokens, and add the barrel export.

## Create themes

```bash
/new-theme acme "deep teal primary, warm neutrals"
```

Add a `[data-theme="acme"]` block in `packages/tokens/src/themes.css` and an
entry in `theme-types.ts`. See `docs/TOKEN_GUIDELINES.md`.

## Use the registry (copy-owned mode)

> **Status / gap:** the registry isn't hosted for you — there is no public
> `/r/*.json` endpoint. Copy-own means either self-host the built JSON, or skip
> `shadcn add` entirely and copy the block source straight from the repo.

```bash
# 1. build the registry JSON
pnpm registry:validate
pnpm dlx shadcn@latest build registry/registry.json --output registry/__output

# 2. serve registry/__output from a host YOU control, then:
npx shadcn add https://<your-own-host>/ai-chat-shell.json

# — or, with no hosting at all —
# 3. copy the block source directly out of registry/blocks/<name>/ into your repo.
```

See `docs/REGISTRY_GUIDELINES.md` for package-vs-registry guidance.

## Testing

Three layers (full guide in `docs/TESTING.md`):

```bash
pnpm test                 # 1. unit/smoke (Vitest) — fast, co-located
pnpm --filter @elabs/components-docs test-storybook
                          # 2. stories as real-browser interaction + axe a11y tests
```

The Playwright E2E suite was removed on 2026-08-02 (80a12fb) together with the
Vite demo app it drove; the Storybook interaction + axe run above is the
browser-level tier today.

For exploratory and visual validation (AI-driven, via the agent-browser skill):

- `/qa-flows` — functional QA across Storybook (screenshots, console health,
  pass/fail report).
- `/visual-review` (→ `brand-ui-visual-ux-reviewer` agent) — screenshots every page/story
  in both themes and critiques hierarchy, spacing, contrast, typography and
  accessibility using the UI/UX design skills.

CI (`.github/workflows/ci.yml`) runs a **blocking gate set** on every PR —
`typecheck` · `lint` · `test` · `build` · `registry:validate` · `format:check` ·
`manifest:check` · `components:check` · `docs:check` · `inventory:check` ·
`llms:check` · `context:check` · `ai:types-only` · `lucide:check` ·
`charts:reuse:check` · `agents:check` — plus two **non-blocking**
(`continue-on-error`) layers: Playwright E2E (`pnpm test:e2e`) and Storybook
interaction + axe (`pnpm --filter @elabs/components-docs test-storybook`).

## How coding agents should work here

Read `CLAUDE.md` (Claude Code) or `AGENTS.md` (any agent), then the relevant
`.claude/rules/*`. Commands: `/new-component`, `/new-theme`, `/new-registry-item`,
`/review-component`, `/prepare-release`, `/qa-flows`, `/visual-review`,
`/file-issue`. Findings (tests, finder agents, feedback) are root-cause-analyzed
and filed as GitHub issues — finders report, they don't fix (see
`docs/ISSUE_WORKFLOW.md`). Hooks
auto-format edits, block dangerous commands, and warn on boundary/token
violations. Full workflow: `docs/AGENT_WORKFLOW.md`.

## Scripts

```bash
pnpm dev            # run all dev tasks (turbo)
pnpm build          # build all packages/apps
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit per package
pnpm test           # vitest (unit/smoke)
pnpm test:e2e       # playwright end-to-end
pnpm format         # prettier --write .
pnpm registry:validate
# scope any task: pnpm --filter @elabs/components-ui test
```

## Documentation

- `PROJECT.md` — vision, goals, roadmap, acceptance criteria.
- `docs/ADR/` — architecture decisions.
- `docs/COMPONENT_GUIDELINES.md`, `docs/TOKEN_GUIDELINES.md`,
  `docs/REGISTRY_GUIDELINES.md`, `docs/AGENT_WORKFLOW.md`, `docs/TESTING.md`,
  `docs/ISSUE_WORKFLOW.md`.
- `docs/CONSUMING.md` — use `@elabs/components-*` from another project; `docs/RELEASING.md`
  — cut a release (incl. § 7 Rollback); `docs/DEPRECATION.md` — how things are
  retired, and what support you can expect.
- `docs/ASSUMPTIONS.md` — assumptions and environment notes.
- [`ATTRIBUTION.md`](ATTRIBUTION.md) — every project whose code, design, data or
  type we use, with its licence and copyright.

## Attribution

brand-ui is built on other people's work. **[`ATTRIBUTION.md`](ATTRIBUTION.md)**
credits all of it — adapted and vendored source, runtime map data, self-hosted
fonts, and every open-source dependency — with the licence and copyright line for
each. It is generated from the repo, not hand-kept, so it cannot drift from what
is actually shipped.

If you borrow from another project, credit it in the same change:
[`.claude/rules/attribution.md`](.claude/rules/attribution.md).

## License

Internal / UNLICENSED. Not for external distribution without approval.

> This applies to brand-ui's own source. It does **not** override the licences of
> the third-party work listed in [`ATTRIBUTION.md`](ATTRIBUTION.md), several of
> which oblige their notices to travel with the code.
