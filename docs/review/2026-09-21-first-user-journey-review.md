# First-user journey review — from the "Foresight" new-user test (2026-09-21)

Input: the new-user test of brand-ui 5.0.0 (an agent with no repo knowledge, entering at
`elabs-ai.com/start?theme=qlik&mode=light`, building a three-screen forecasting app in the Qlik
theme). Two passes, 30 findings. This review checks each journey-relevant finding against the
code on `main` (d140b54c), names the root cause, and turns them into an ordered enhancement
plan for the **first user journey**: `/start` → CLI `create` → theme → `docs`/`search`/
`chart-for` → build → `audit --strict`.

Component-level defects (Meter/NumberInput min-width, ScatterChart legend, Heatmap margins …)
are listed at the end for the charts/ui backlog; they are not journey work.

## What the test says about the journey

The good news is the shape of the route works: scaffold → install → first `tsc` clean, ~600
lines across five packages written from `docs --brief` alone, strict audit green, Qlik theme
looking like Qlik Cloud without a single app-side style. **The route is right; the hand-offs
between its steps leak.** Every A-finding was invisible to typecheck, lint and the strict
audit — the gates say "done" while the page is broken. And the tester spent most of their
detour time on three hand-offs the site promised and the CLI could not keep:

1. The URL said `theme=qlik`; nothing downstream can apply a theme family.
2. `docs` promised "real props"; for the first component every dashboard uses it says
   "read a path that does not exist in your project".
3. The site's chart pages describe editorial examples in prose; there is no code to copy.

## Findings verified against the code

| #   | Test finding                                                                        | Verified root cause (file)                                                                                                                                                                                                                                                                                                                                                               | Journey stage            |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | `cn()` strips `text-chart-source` / `-label` / `-value`                             | `packages/ui/src/lib/cn.ts` `TEXT_ROLES` registers 12 roles; the three chart roles added in RM-019 (`packages/tokens/src/themes.css` ~L2059) were never added, so tailwind-merge treats them as text colours                                                                                                                                                                             | build                    |
| 2   | FunnelChart overflows on non-monotonic data                                         | `funnel-chart.tsx` L927 `const max = first.value` — scales against the first stage, not the largest                                                                                                                                                                                                                                                                                      | build                    |
| 3   | ChartCard 260 px body vs chart `plotHeight`                                         | `chart-card.tsx` L108–161: fixed `height = 260`, no relation to the child's `plotHeight`; `ChartFrame` already solves this (`plotHeight`, L611)                                                                                                                                                                                                                                          | build                    |
| 4   | Scaffolded shell overflows horizontally                                             | `sidebar.tsx` L533 `SidebarInset` = `relative flex w-full flex-1 flex-col` — no `min-w-0`; `templates/dashboard.tsx` `<main>` inherits the same                                                                                                                                                                                                                                          | scaffold                 |
| 6   | `theme=qlik` cannot be applied                                                      | `bin/brand-ui.mjs` L977–1010 `create --theme light\|dark` only; manifest `themes: [dark, light]`; `search "qlik theme"` hits only ThemeProvider/useTheme; `/start/page.tsx` never reads `searchParams`; `themes/README.md` is a 4-step manual copy; no `theme add` verb; generated CLAUDE.md (`engine.mjs` L1180, L1220) says "Two shipped themes" and "Don't touch the theme mechanism" | start → scaffold → theme |
| 7   | `docs Text` resolves to editor/markdown                                             | search scores `Text` from `@elabs-ai/components-editor` (prose) above `@elabs-ai/components-ui` typography; the ui `Text`/`Heading` have no recorded props either, so nothing breaks the tie toward the one CLAUDE.md recommends                                                                                                                                                         | docs                     |
| 8   | `docs MetricCard` (+ ChartTooltip, ToggleGroup, FunnelStage, Toaster) is a dead end | Manifest: ui `MetricCard` HAS props; the charts re-export (`packages/charts/src/metric-card/index.ts`) has none and wins resolution. Overall the CLI manifest records props for 77 of 231 charts exports and 153 of 406 ui exports; `docs-brief.mjs` L91 / `bin` L736 then print `read <monorepo path> … never guess props` — a path that only exists in this repo                       | docs                     |
| 9   | No usage snippet anywhere in the CLI                                                | `docs-brief.mjs` has no example field; the playbooks `search` points to (`docs/playbooks/dashboard.md`, `templates/dashboard.tsx`) are repo paths not shipped in the CLI package                                                                                                                                                                                                         | docs                     |
| 10  | `chart-for` ranks Choropleth/LiveLine first                                         | `chart-for "pipeline amount by stage"` → 1. ChoroplethChart, 2. TreemapChart (score 1 each); the intent parser reads "measure" and never sees "stage" as a category axis                                                                                                                                                                                                                 | docs                     |
| 11  | `create --title` not used in the app                                                | `engine.mjs` L464/L859/L1161: title reaches `<title>`, CLAUDE.md, AGENTS.md — but `templates/dashboard.tsx` hard-codes "Analytics" (L35, L136) and the nav                                                                                                                                                                                                                               | scaffold                 |
| 13  | Peer deps pinned exactly                                                            | `packages/*/package.json` use `"workspace:*"`; pnpm publishes that as the exact version. `workspace:^` publishes `^5.0.0`                                                                                                                                                                                                                                                                | install                  |
| 21  | `docs HeatmapChart --brief` prints no props; `ChartAnnotations` dead end            | Manifest `props.HeatmapChart` = null; `ChartAnnotations` is in the 154 charts exports without recorded API                                                                                                                                                                                                                                                                               | docs                     |
| 22  | Nothing leads to `ChartFrame`                                                       | `templates/dashboard.tsx` uses ChartCard ×5, ChartFrame ×0; generated CLAUDE.md and the dashboard playbook do the same                                                                                                                                                                                                                                                                   | scaffold                 |

Not re-verified (taken from the report as observed): 5, 12, 14–20, 23–30.

## The enhancement plan, by journey stage

### Stage 0 — the gates must catch what the tester saw (do first)

The single most damaging pattern: five A-findings, zero caught by `typecheck`, `lint`,
`audit --strict`. A new user believes the gates. Three cheap additions:

- **`audit --strict` static checks** (the report suggests two; a third follows from #4):
  - a chart with `plotHeight` > its enclosing `ChartCard height` (or > 260 when unset);
  - a `Meter` inside `DescriptionsItem`;
  - a `Table`/`DataTable`/chart directly inside a CSS grid item without `min-w-0`
    (or simply: recommend `ChartFrame`, which sizes itself).
- **A rendered gate in the scaffold**: `create` already writes a Playwright-driven
  "render it in light and dark" step into the routine (`engine.mjs` L1554). Add one
  assertion to it: `document.documentElement.scrollWidth <= innerWidth` at 390/820/1440.
  That catches #4 and every future horizontal overflow, in every scaffolded app.
- **A first-user journey test in CI** (`scripts/journey-smoke.mjs`, run with
  `release:smoke`): `create` → `theme add qlik` → `docs` for the 15 components the
  dashboard template imports must print ≥1 prop and no monorepo path → `chart-for` on
  eight golden shapes must rank the expected chart first → build → the scrollWidth check.
  This is the regression fence for everything below.

### Stage 1 — `/start`: keep the promise the URL makes

- **Read `?theme=` and `?mode=` on `/start`** and show the family's commands: the scaffold
  line becomes `create … --theme qlik-light`, the CSS block shows the family's imports, the
  prompt card names the family. Today the parameter is silently dropped (page.tsx has no
  `searchParams`).
- **A "Theme" selector on the New-project tab** listing the eight families, defaulting to
  what the URL carried. The home page shows themes as "the same small real interface per
  theme" — the /start page should let the user keep the one they clicked.
- Mention theme families once under "The one-time wiring" (today the wiring block is
  Tailwind `@source` only).

### Stage 2 — `create`: one command, the app the user asked for

- **`brand-ui theme add <family>`** (new verb) and **`create --theme <family>[-light|-dark]`**:
  copy `themes/<family>/` into `src/themes/<family>/`, append the font + scheme imports to
  `styles.css` after the engine import, patch `<ThemeProvider themes={…}>` in `main.tsx`,
  set `data-theme` on `<html>`. The theme families are not in the npm packages today
  ("copy its folder into your app") — ship them in the CLI package (they are CSS + one
  `theme.ts`, a few hundred KB with fonts) or fetch from the tagged GitHub release. Shipping
  is simpler and works offline.
- **Regenerate CLAUDE.md/AGENTS.md from the chosen theme**: replace "Two shipped themes:
  light and dark" with the real active list, and rewrite "Don't touch the theme mechanism"
  so that `theme add` is the sanctioned way to change look-and-feel (today the text argues
  against what the README requires).
- **Use `--title`**: the template's brand slot, sidebar title, `<title>` and the first nav
  label should come from the title; the nav should come from the archetype (a dashboard
  gets Overview/Reports/Settings, not Overview/Analytics/Users/Settings with the library's
  own "Brand" mark).
- **Scaffold on `ChartFrame`, not `ChartCard`**: the dashboard template, the dashboard
  playbook and the generated CLAUDE.md all point at ChartCard; ChartFrame is the editorial
  surface, sizes the plot itself (removes #3) and is what the site's chart pages show.
  Keep ChartCard for the KPI-tile grid only.
- **`min-w-0` on `SidebarInset`** (library) and on the template's `<main>`/grid items — the
  one-line fix with app-wide effect.
- **`workspace:^`** in every package's peerDependencies so 5.0.1 of one package does not
  peer-conflict every consumer.

### Stage 3 — `docs` / `search` / `chart-for`: the agent's only eyes

This is where the tester lost the most time, and it is where the library's pitch
("query the CLI rather than guessing props") lives or dies.

- **No dead ends.** Rule: `docs <X>` never prints a monorepo path to a consumer.
  - Re-exports resolve to their owner: `MetricCard` (charts → ui), `Toaster` (sonner),
    `ChartTooltip`, `ToggleGroup`. The manifest already knows ownership (ADR 0012 text is
    in the anti-pattern line); use it in resolution.
  - Close the docgen gap for the exports a first user will hit: HeatmapChart,
    ChartAnnotations, ChartFrame, LineChart's `annotations`, Text/Heading, FunnelStage,
    Meter, NumberInput. Add a manifest gate: every exported PascalCase component in
    ui/charts/data must have ≥1 recorded prop or an explicit `extends`, else `gen:check`
    fails.
  - When a path fallback is unavoidable, print the consumer path
    (`node_modules/@elabs-ai/components-charts/dist/index.d.ts`) and the `.d.ts` symbol.
- **One snippet per component.** Add an `example` field to the manifest, sourced from the
  first story's `args`/render (the stories already exist and are typed) or from a
  `@example` TSDoc block. `docs --brief` prints it under "minimal use". This is the same
  content the site's chart detail pages need (finding 20) — one source, two surfaces.
- **Disambiguate by CLAUDE.md's recommendation.** When a name exists in several packages,
  prefer ui > charts > data > editor unless the query names the package
  (`docs editor/Text`). Print the alternatives in one line.
- **Ship the playbooks in the CLI package** (`docs/playbooks/*.md`, `templates/*.tsx` are
  what `search "dashboard"` returns; today they are repo-only paths). `brand-ui playbook
dashboard` prints it; `docs` links to it by verb, not by path.
- **`chart-for` intent parser**: recognise a categorical axis word ("by stage", "by
  region", "per rep", "by category") → BarChart family first; "over a quarter/period"
  with "vs quota" → LineChart with annotations, `LiveLineChart` only when the query says
  live/streaming; ChoroplethChart only when a geography word is present. Add the eight
  golden shapes from the tester's queries as a test.

### Stage 4 — build: the library defects a first user cannot route around

Library fixes in the order of the report, all small:

1. `cn.ts`: add `chart-value`, `chart-source`, `chart-label` to `TEXT_ROLES` (+ a test that
   every `--text-<role>` in themes.css is registered, so RM-0xx cannot drift again).
2. `SidebarInset` `min-w-0` (also `ChartCard`/`ChartFrame` as grid items).
3. `FunnelChart`: scale against `Math.max(...values)`, clamp; dev-warn on non-monotonic
   data instead of painting outside the box.
4. `ChartCard`: grow with the chart when the child declares `plotHeight`, or dev-warn.
5. `Meter` and `NumberInput` intrinsic min-width.
6. `LineChart` `legend` should label by `Line name` like `seriesLabel` does; collision
   avoidance for converging end labels.

### Stage 5 — the site's chart pages (second pass, finding 20)

Every example on `/charts/*` gets a copyable snippet — generated from the same `example`
field as `docs --brief`, so the site and the CLI never disagree. "No code example" on a
prop table is the wrong default for a library whose users are agents.

## Suggested order

| Wave        | Items                                                                                                                                                                   | Why first                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1 (hours)   | cn roles · `min-w-0` · `workspace:^` · docs re-export resolution · `docs` never prints monorepo paths · `--title` used                                                  | one-line fixes, app-wide effect, restore trust in `docs` |
| 2 (days)    | `theme add` + `create --theme <family>` + `/start` reads `?theme=` + CLAUDE.md theme text · scaffold on ChartFrame · playbooks shipped in the CLI · manifest props gate | closes the three broken hand-offs                        |
| 3 (days)    | `example` field → `docs --brief` snippet + site chart pages · `chart-for` intent fixes + golden tests · audit static checks · journey smoke test in `release:smoke`     | makes the next new-user test boring                      |
| 4 (backlog) | FunnelChart/ChartCard/Meter/NumberInput/legend · findings 12, 14–19, 23–30                                                                                              | component polish                                         |

## Component backlog (not journey work)

5 Meter/NumberInput min-width · 12 legend vs Line name · 14 bundle size (`sideEffects`,
`manualChunks` doc) · 15 currency abbreviation default in record tables · 16 waterfall
label rotation · 17 BulletChart comparative marker · 18 FacetFilter popover offset ·
19 blank charts in `fullPage` screenshots (affects the audit flow — verify) · 23 Scatter
legend layout ignored when narrow · 24 scatter label collision · 25 `Grid vertical` tick
count · 26 Heatmap margins / value halo / dark-mode ramp inversion · 27 Distribution
`valueKey` row label · 28 categorical palette by row order (`colorBy`) · 29 LineChart drops
y ticks at 390 px · 30 ChartFrame toolbar wrap at one-third width.

## What the test confirms is right

Keep these as the spine of the journey and do not "improve" them: the scaffold-first route,
`docs --brief` as the agent's first read, the anti-pattern lines (they changed two decisions),
`audit --strict` as definition of done, the accessibility defaults, and the theme families'
fidelity. The tester wrote a credible business app in one session; the plan above removes the
detours, not the route.
