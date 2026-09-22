# Reviving the dashboard pack

Parked **2026-09-22**, from `main` at 5.2.0. The surface (ADR 0037) shipped publicly in
5.0.0, 5.1.0 and 5.2.0, and is withdrawn from 5.3.0 on. ADR 0037 is **parked, not reversed** —
its reasoning still stands; the maintainer rejected the authoring experience, not the design.

Read `../README.md` first for what "parked" means mechanically. Everything below is the exact
inverse of the parking commit, in the order to do it.

## 0. Before anything

The pack is **frozen source**: it has not been typechecked, linted, tested or rendered since
2026-09-22. Expect it to fail against whatever moved in `charts`, `ui`, `data`, `ai`, `process`
and `editor` since then. Budget for that before starting; do not park half of it back.

`docs/2026-09-22-dashboard-pack-rebuild.md` (moved here with the pack) is the Playwright-driven
fix pass that improved the UX without making it shippable. Read it before rebuilding the
authoring experience — it is the record of what was already tried.

## 1. Move the source back

```
parked/dashboard-pack/charts-dashboard/                 → packages/charts/src/dashboard/
parked/dashboard-pack/templates-dashboard-sheet.stories.tsx
                                                        → packages/charts/src/templates-dashboard-sheet.stories.tsx
parked/dashboard-pack/schemas/dashboard-spec.v1.schema.json
                                                        → packages/charts/schemas/dashboard-spec.v1.schema.json
parked/dashboard-pack/registry-blocks/dashboard-*/      → registry/blocks/dashboard-*/
parked/dashboard-pack/docs-stories/dashboard-*.stories.tsx
                                                        → apps/docs/stories/blocks/dashboard-*.stories.tsx
parked/dashboard-pack/home-tour-surface.tsx             → apps/home/components/tour/surfaces/dashboard.tsx
parked/dashboard-pack/home-blocks/dashboard-tile-table/ → apps/home/components/blocks/dashboard-tile-table/
parked/dashboard-pack/cli/dashboard-spec.mjs            → packages/cli/lib/dashboard-spec.mjs
parked/dashboard-pack/cli/dashboard-spec.generated.mjs  → packages/cli/lib/dashboard-spec.generated.mjs
parked/dashboard-pack/cli/gen-dashboard-spec.mjs        → packages/cli/scripts/gen-dashboard-spec.mjs
parked/dashboard-pack/cli/dashboard-spec.test.mjs       → packages/cli/test/dashboard-spec.test.mjs
parked/dashboard-pack/docs/sheet-for.md                 → skills/brand-ui/reference/sheet-for.md
parked/dashboard-pack/docs/dashboard.md                 → .claude/rules/dashboard.md
parked/dashboard-pack/docs/2026-09-22-dashboard-pack-rebuild.md
                                                        → docs/review/2026-09-22-dashboard-pack-rebuild.md
parked/dashboard-pack/docs-templates-dashboard-sheet.tsx
                                                        → docs/playbooks/templates/dashboard-sheet.tsx (GENERATED — `pnpm gen` rewrites it)
parked/dashboard-pack/gates/dashboard-reuse.mjs         → scripts/check/rules/dashboard-reuse.mjs
parked/dashboard-pack/gates/dashboard-test-double.mjs   → scripts/check/rules/dashboard-test-double.mjs
```

Use `git mv` so `git log --follow` keeps working in both directions.

**`gates/dashboard-test-double.mjs` imports `./charts-test-double.mjs`** — a sibling that never
left `scripts/check/rules/`. The import only resolves once the file is back beside it. Rules are
auto-discovered from that directory (`scripts/check/registry.mjs`), so moving the two files back
is the whole re-registration; the gate count goes 89 → 91.

## 2. Put the public surface back

- **`packages/charts/package.json`** — re-add `"./dashboard"`, `"./dashboard/test"` and
  `"./dashboard/schema.json"` to BOTH `exports` and `publishConfig.exports`; re-add `"schemas"`
  to `files`; re-add the runtime dependencies `@dnd-kit/core` and `zustand`, and the `ajv`
  devDependency. (`@dnd-kit/core` is still in `packages/data`, which declares its own copy —
  keep the versions in step.)
- **`packages/charts/tsup.config.ts`** — re-add `"dashboard/index"` to `PUBLIC` and
  `"dashboard/test/index"` as a third entry in the second pass.
- **`packages/cli`** — restore the `dashboard-spec` verb group: `cmdDashboardSpec` in
  `bin/brand-ui.mjs` (the command, the dispatch entry, the header line, the help block and the
  usage map) and the `DASHBOARD_SPEC_VERB_DOCS` entry in `loadCliVerbs()`'s `GROUPS`
  (`lib/core.mjs`). Re-add the `dashboard-spec` step to `scripts/gen.mjs` and the `sheet-for.md`
  doc-region target to `packages/cli/lib/gen.mjs`.
- **`packages/cli/README.md`** — the "CLI verb groups" section was rewritten around `a2ui`;
  re-add `dashboard-spec`. This one matters: `scripts/release-smoke.mjs` scrapes code spans in
  `FRONT_DOOR_FILES` for advertised verbs, so the README is what tells the post-publish smoke
  the verb exists.
- **`packages/cli/test/search-cli-verbs.test.mjs`** and **`test/mcp-http.test.mjs`** were
  retargeted (at `a2ui` and at `Form`/`@elabs-ai/components-ui/form`). Both carry a header
  comment saying so. Add the dashboard assertions back beside the new ones rather than
  reverting — a second verb group is what the `manifest.cliVerbs` arm exists for.
- **`fixtures/consumer-smoke/src/main.tsx`** — re-add the two subpath imports and the
  `DashboardSheetDouble` surface.
- **`apps/home`** — the `dashboard` tour tab (`components/tour/tabs.ts`, `tour.tsx`, and
  `defaultTab`, which was moved to `"ai-assistant"`), the `dashboard-sheet` surface in
  `components/agent-loop/renders.tsx` + `prompt-map.ts`, the `dashboard` prompt in
  `content/agent-loop.json`, and the DashboardSpec editor in `components/agent-loop/emit-ui.tsx`
  (which was collapsed from a two-tab `Tabs` to a single format — the `Format` type and the
  `format`-keyed copy/example maps were kept as maps so the second tab is a data entry again).
  `content/copy.ts` needs `tourCopy.tabs.dashboard`, `dashboardSurfaceCopy`, the
  `dashboard-sheet` surface title, `emitUiCopy.tabsLabel`, `tabs.dashboardSpec`,
  `examples.dashboardSpec`, `playground.dashboardSpec` and `kpiSheet` back; the tab-count
  comments say six and go back to seven.
- **`scripts/gen-home.mjs`** — restore the `validateSpec` import, `DASHBOARD_GOLDEN_MINIMAL`
  and the `dashboardSpec` arm of `buildEmitUiExamples`.
- **`registry/registry.items.json`** — the 5 `dashboard-*` block entries (`registry.json` and
  `apps/home/public/r/*.json` are generated; `pnpm gen` follows).
- **`scripts/lib/home-catalog-layout.json`** — the `Dashboard/Recipes/` move and
  `families.charts["Dashboard"]`, plus `blockFamilyCopy["Dashboard Recipes"]` and the charts
  `Dashboard` family line in `apps/home/content/copy.ts`.
- **`apps/docs/.storybook/preview.tsx`** — `"Dashboard"` in `storySort.order`, between
  `"Charts"` and `"AI"`, and the matching numbered entry in `docs/STORYBOOK_GUIDELINES.md`
  (the list below it was renumbered down by one).
- **Docs** — `docs/playbooks/dashboard.md` §2 and its frontmatter keywords/intent;
  `docs/CONSUMING.md` § 6 (the section was replaced by a withdrawal note);
  `.claude/rules/charts.md`'s "Dashboard subpath" section; the D3 row in `docs/DECISIONS.md`
  (`CLAUDE.md`, `AGENTS.md` and `skills/brand-ui/SKILL.md` are generated from it);
  `apps/docs/stories/Introduction.mdx`'s starter link; the parked note in `.github/labels.md`;
  the three `dashboard` rewrites in `scripts/build-agent-kit.mjs`'s `SANITIZE`.
- **`docs/ADR/0037-dashboard-surface-in-charts-subpath.md`** — remove the parked banner.

Every one of these carries a dated comment naming `parked/README.md`, so
`grep -rn "parked/README.md"` finds the full set without this list.

## 3. Regenerate and re-pin

```
pnpm install && pnpm gen
```

Then move the pinned counts in `scripts/gen-home.test.mjs` to whatever `pnpm gen` produced —
read `apps/home/content/generated/counts.json`, do not predict. Parking moved `registryBlocks`
166 → 161 and `templates` 10 → 9.

## 4. Verify

`pnpm gen:check` · `pnpm check` (expect 91, not 89) · `pnpm check:test` · `pnpm typecheck` ·
`pnpm lint` · `pnpm build` + `pnpm consumer:check` · `pnpm format:check` · Storybook in both
themes · the homepage by hand.

## 5. Release

Returning the subpath is a **minor**: it adds exports. Say plainly in the changeset that
`@elabs-ai/components-charts/dashboard` is back after being withdrawn in 5.3.0, and which
version withdrew it.
