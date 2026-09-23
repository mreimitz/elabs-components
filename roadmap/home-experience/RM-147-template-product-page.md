---
id: RM-147
title: "Template product page: scenario, hand-off above the fold, tour of views, generated “made of”, no repeated examples"
status: done
priority: P0
effort: M (2 days)
wave: 1
depends_on: []
blocks: [RM-148, RM-149, RM-150, RM-151, RM-152, RM-153]
agent: brand-ui-component-builder
model: opus
touches:
  - apps/home/content/template-tours.ts (new — one authored entry per template: scenario, views, interaction)
  - apps/home/components/catalog/template-story.tsx (new — the scenario / hand-off / tour / made-of sections)
  - apps/home/components/catalog/doc-page.tsx (examples exclude the story the native hero rendered; `hero` slot order)
  - apps/home/app/(catalog)/templates/[slug]/page.tsx (composition)
  - apps/home/content/copy.ts (section labels)
  - apps/home/e2e (a template page spec: sections present, hand-off above the fold, links resolve)
source: docs/review/2026-09-23-home-experience.md §1 a, b, d
---

# RM-147 Template product page

## Finding

A template page is a screenshot with chips: the native render, a package badge row, the scaffold chip, a prompt card at the bottom, then an "Examples" section that repeats the same screen as a Storybook iframe (blank when Storybook is unreachable). There is no scenario, no tour of the views the nav rail names, and the "made of" data the registry already generates (`page.block.registryDependencies`, `dependencies`) is not shown.

## Change

- `content/template-tours.ts`: per template slug, `{ scenario: string; views: { label: string; shows: string }[]; interaction: string }` — authored prose, two sentences of scenario, one line per nav view, one line on what the visitor can do. Templates without an entry fall back to today's lead.
- `TemplateStory` component: **Scenario** (lead) → **Hand-off** (scaffold/copy `CommandChip` + `PromptCard`, first thing under the screen) → **Views** (a list, one row per view, the nav label bold) → **Made of** (blocks: `registryDependencies` resolved to catalogue entries with links and their thumbnails; packages: `dependencies` filtered to `@elabs-ai/*`, linked to `/components/<pkg>`) — the last two generated, never typed.
- `DocPage`: when a native block rendered the hero, the examples section lists only stories the hero did not render (for a one-story template: none, and the section is omitted).
- Section labels in `catalogCopy.detail` (visitor copy gate).

## Acceptance

- `/templates/market-desk` shows, in order: the screen, the scenario, the hand-off, four "Desk" views + three "Book" views, made of `command-center-market-tape-01` + `workspace-shell` (linked) and five packages (linked); no iframe on the page.
- Every one of the 22 template pages builds; those without a tour entry still render their lead.
- Hand-off is within the first viewport below the screen at 1440 × 900.

## Test / gate

`pnpm --filter home build`, `pnpm gen:check`, `pnpm check --rule catalog-visitor-copy,home-imports,home-tokens`, e2e template spec, Chromium screenshots light + dark.

## Orchestrator notes

The layer every later item lands in. Land it first; wave 2 templates each add one `template-tours.ts` entry.
