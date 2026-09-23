---
id: RM-160
title: "ui LinkPreview thumbnail, editor `ImageMd`, `ui-reuse` + `media-reuse` gates"
status: planned
priority: P1
effort: M (2 days)
wave: 3
depends_on: [RM-157, RM-158, RM-159]
blocks: [RM-161]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/ui/src/components/link-preview/link-preview.tsx (`Thumbnail` L46–62 → `Image`)
  - packages/ui/src/components/link-preview/link-preview.test.tsx (L73–86)
  - packages/editor/src/markdown-preview/markdown-preview.tsx (`ImageMd` L896–906 → ui `Image`)
  - packages/data/src/data-table/cells/markdown-cell.tsx (L44 exempt comment only)
  - scripts/check/rules/ui-reuse.mjs (new — inline `fixtures`, per `scripts/check/README.md`)
  - scripts/check/rules/media-reuse.mjs (new — inline `fixtures`)
  - scripts/check/reuse-scan.mjs (new shared helper, outside `rules/` so the runner does not load it as a rule)
  - scripts/check/rules/charts-reuse.mjs (keeps only its `@base-ui` arm; scan lifted into the helper)
  - scripts/check/baseline.json (seed `ui-reuse` with `@elabs-ai/components-data::FilterChip`)
  - docs/GATES.md (regenerated)
  - .changeset/*.md (ui patch, editor patch)
source: docs/review/2026-09-23-media-primitives-plan.md §4, §6; ADR 0041 §2 item 4, §8
---

# RM-160 Last raw media sites + the two gates

## Finding

- `packages/ui/src/components/link-preview/link-preview.tsx` `Thumbnail` (L46–62, `<img>` at L51) and `packages/editor/src/markdown-preview/markdown-preview.tsx` `ImageMd` (L896–906, `<img>` at L898) are the last raw media sites after wave 2.
- `packages/data/src/data-table/cells/markdown-cell.tsx` L44 draws a 16 px inline glyph inside a sanitised parser hot path — a skeleton or fallback is wrong at glyph scale.
- `scripts/check/rules/charts-reuse.mjs` (L14–52) already has `manifestComponentNames` + `localDeclarations`, scoped to charts; `process-reuse.mjs` has the `EXEMPT_RE` escape pattern. No rule stops a layer-2 package from re-declaring a ui component or drawing a raw `<img>` / `<video>` / `<audio>`.
- One pre-existing name collision: `packages/data/src/filter-bar/filter-chip.tsx` L65 `FilterChip` vs ui `view-toolbar.tsx` L235.

## Change

- `link-preview.tsx` → `<Image fallback={null} fit="cover" showSkeleton={false} loading="lazy" alt="" aria-hidden>` imported from `../image`; update `link-preview.test.tsx` L73–86.
- `markdown-preview.tsx` `ImageMd` → ui `Image fit="none" loading="lazy"` (no dimensions → no skeleton), existing classes kept; editor already peers on ui.
- `markdown-cell.tsx` L44: `// media-reuse-exempt: 16px inline glyph inside a sanitised parser hot path; a skeleton or fallback is wrong at glyph scale`.
- **`ui-reuse.mjs`** (`scope: "packages"`, `baseline: "keys"`): for each layer-2 package (`ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `editor`, `viewer`, `terminal`), `manifestComponentNames(ui)` + `localDeclarations(stripComments(code), names)` over `src/**/*.{ts,tsx}` minus tests / stories / `__contract__`; key `<pkg>::<Name>`; escape `// ui-reuse-exempt: <reason>`. Lift the scan from `charts-reuse.mjs` L14–52 into a shared helper; `charts-reuse` keeps only its `@base-ui` arm; `process-reuse` unchanged. Baseline seeded with `@elabs-ai/components-data::FilterChip`. Fixtures: pass `export { GeneratedImage as Image } from "./generated-image"`; fail `export const Image = () => <img />` in a non-ui package.
- **`media-reuse.mjs`** (`scope: "packages"`, `baseline: "none"`): regex `<(img|video|audio)(?=[\s/>])` on comment-stripped source in every package except `icons` / `tokens` / `cli` / `create`, excluding `packages/ui/src/components/{image,media-player}/**` and tests / stories / contracts; escape `// media-reuse-exempt: <reason>` on the same line or the line above (mirror `process-reuse.mjs`'s `EXEMPT_RE`); messages point at ui `Image` / `Audio` / `Video`. Fixtures pass / fail / exempt.
- The runner picks up every `rules/*.mjs` (`scripts/check/README.md`); fixtures live inline in each rule. `docs/GATES.md` regenerates via `pnpm gen`.

## Acceptance

- `pnpm check --rule media-reuse` reports **zero** findings on `main` + this branch.
- `pnpm check --rule ui-reuse` reports only the baselined `FilterChip`; the ai `Image` specifier alias passes.
- `charts-reuse` still catches a `@base-ui` import; its old name-collision arm is covered by `ui-reuse`.
- LinkPreview with a broken thumbnail renders nothing in place of the image (no broken-image glyph).

## Test / gate

`pnpm --filter @elabs-ai/components-ui typecheck lint test`; `pnpm --filter @elabs-ai/components-editor typecheck lint test`; `pnpm check --rule ui-reuse,media-reuse,charts-reuse,process-reuse`; `pnpm check:test`; `pnpm gen && pnpm gen:check`; Storybook `run-story-tests` on `core-linkpreviewcard--*` and the editor markdown-preview stories in light and dark.

## Orchestrator notes

Last code item so `media-reuse` ships at zero. If `ui-reuse` finds a collision other than `FilterChip`, stop and report it — do not widen the baseline silently.
