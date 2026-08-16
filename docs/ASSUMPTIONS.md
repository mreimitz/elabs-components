# Assumptions & decisions

Research-backed choices and assumptions made while building this foundation.
Web access was available; key facts were verified against official docs
(see Sources at the end).

## Tooling versions (pinned in package.json files)

- **pnpm 9.15.x**, Node ≥ 20. `packageManager` is set on the root per Turborepo v2.
- **Turborepo 2.x** — `turbo.json` uses the v2 `tasks` key (not the legacy
  `pipeline`). A `topo` task models the package graph for lint/typecheck/test.
- **React 19** + **TypeScript 5.7**.
- **Tailwind CSS v4** — CSS-first config: `@import "tailwindcss"`, `:root` +
  `[data-theme]` token blocks, and `@theme inline` to expose tokens as utilities.
  `tw-animate-css` replaces the deprecated `tailwindcss-animate` for v4.
- **Storybook 8.4.x** with `@storybook/react-vite` and `@storybook/addon-themes`
  (`withThemeByDataAttribute`). Storybook 9 exists but 8.x is chosen for a
  well-documented, low-risk baseline; upgrading is a follow-up.
- **React Flow = `@xyflow/react` v12** (the current package name; `reactflow` is
  the v11 legacy name).
- **TanStack Table v8**, **Radix UI** individual primitives, **Vitest 3** +
  Testing Library, **tsup 8**, **ESLint 9** flat config + Prettier 3.

## Architectural assumptions

- **Internal "just-in-time" packages:** package `exports` point at TypeScript
  source (`./src/index.ts`), so Vite/Storybook transpile packages directly with
  no pre-build. `publishConfig.exports` points at `dist/` for external
  distribution, and every package has a `tsup` `build` script. This is the
  Turborepo-recommended pattern for internal packages and keeps DX instant.
- **Tailwind content scanning:** Tailwind v4 does not scan workspace packages
  resolved through `node_modules`, so each app's CSS lists the package sources
  via `@source` directives. Add new packages there.
- **Theme switching via `data-theme`** (not a `.dark` class) to generalize to N
  brands/modes. `ThemeProvider` persists the choice in `localStorage`.
- **Status tokens** (`--success`, `--warning`, `--info`) were added beyond the
  base token list because data/status UIs need them; they follow the same
  semantic-token rules.
- **Charts are library-agnostic:** `@elabs/components-charts` ships `MetricCard`/`MetricGrid`
  and a presentational `ChartCard` container (no heavy chart dependency). Series
  should use the `--chart-1..5` tokens. Bring Recharts/visx/Chart.js per app.
- **SplitPanel is static** (no drag-to-resize) for predictable SSR/tests; wrap
  with a resize library at the app level if needed.
- **`lucide-react` is NOT a dependency of `@elabs/components-icons`** — that package's
  only peer is `react`; its branded sample icons (`createIcon`) have no runtime
  dependency on Lucide. `lucide-react` is the **default** library for generic UI
  glyphs and is declared directly by the packages that use it
  (`@elabs/components-ui`, `@elabs/components-ai`, `@elabs/components-editor`) — see
  @.claude/rules/icons.md.

## Placeholder brand (replace these)

- Colors: token values in `packages/tokens/src/themes.css`.
- Logo: `packages/icons/src/brand-logo.tsx` (keep the `currentColor` + variant API).
- Icons: add to `packages/icons/src/sample-icons/` via `createIcon`.
- Themes are token-driven; adding a new theme is a single CSS block + `THEMES` entry.

## Test/story coverage

- Smoke tests are provided for representative components (Button, Badge, Card,
  Input, EmptyState, DataTable, PromptInput). Storybook stories exist for all
  `@elabs/components-ui` components and the headline component of each domain package.
  Expanding coverage to every component is an intended contributor task (the
  quality gates require a story + smoke test per component going forward).

## Sources

- Tailwind v4 + shadcn theming — https://ui.shadcn.com/docs/tailwind-v4 ,
  https://ui.shadcn.com/docs/theming , https://tailwindcss.com/blog/tailwindcss-v4
- shadcn registry schema — https://ui.shadcn.com/docs/registry/registry-item-json ,
  https://ui.shadcn.com/docs/registry/getting-started
- Claude Code hooks & settings — https://code.claude.com/docs/en/hooks
- Turborepo structure — https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository

## Validation results (build environment)

This foundation was authored in a sandbox with two hard limits: the sandbox
home filesystem was full (0 bytes free, forcing caches onto the mounted repo
volume) and shell commands are capped at ~45s each with no background-process
persistence. Network access to the npm registry and ~357 GB of space on the
repo volume were both confirmed working.

A full `pnpm install` for this monorepo (Storybook + Vite + React Flow + TanStack

- Radix + ESLint + Vitest) resolves ~1,200–1,800 packages and takes several
  minutes — longer than a single capped command — so `install`, `typecheck`,
  `lint`, `test` and `build` could **not be run to completion in this
  environment**. A bounded attempt confirmed it works and progresses normally
  (412 resolved / 294 downloaded in 44s) before the time cap; the partial
  install caches were then removed so nothing extra is left in the repo.

**Dependency-free validation that WAS run and passed:**

- All JSON parses: every `package.json` (11), `turbo.json`, `tsconfig*.json`,
  `registry/registry.json`, `.claude/settings.json`.
- `pnpm registry:validate` → ✓ 8 items, all referenced files exist on disk.
- Import resolution audit: 175 source files scanned; all 187 relative + 46
  `@elabs/components-*` imports resolve to real files (no broken paths/typos).
- Token consistency: 48 semantic tokens; every `@theme inline` `var()` maps to a
  defined token; blueprint covers the full set (blueprint intentionally inherits
  `--radius` from `:root`).
- No raw hex colors in any component package (only `themes.css` defines colors).
- Shell hooks pass `bash -n` and behave correctly on sample inputs (blocks
  `rm -rf /` and force-push; allows safe commands; boundary warnings fire only on
  real cross-package/raw-color violations).
- No leaked machine/sandbox absolute paths in committed files.

**To finish validation on a normal machine, run:**

```bash
corepack enable          # or npm i -g pnpm   (pnpm >= 9, Node >= 20)
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm registry:validate
```

If `pnpm install` reports peer-dependency warnings, they are non-fatal
(`strict-peer-dependencies=false` is set in `.npmrc`). If Tailwind utilities
from a package don't appear in an app, confirm that package's source is listed
in the app CSS `@source` directives.
