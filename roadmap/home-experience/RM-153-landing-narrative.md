---
id: RM-153
title: "Landing narrative: “pick your world” domain entry on `/` and `/templates`, theme-family swap on template pages"
status: planned
priority: P1
effort: M (2 days)
wave: 3
depends_on: [RM-148, RM-150, RM-151]
blocks: []
agent: brand-ui-component-builder
model: sonnet
touches:
  - apps/home/components/gallery/sections.tsx (a domain row above the showcase)
  - apps/home/app/(catalog)/templates/page.tsx (domain grouping)
  - apps/home/components/catalog/template-story.tsx (theme-family control on the screen)
  - apps/home/content/template-tours.ts (`domain` per template)
  - apps/home/e2e (theme-sweep covers a template page)
source: docs/review/2026-09-23-home-experience.md §1 g
---

# RM-153 Landing narrative

## Finding

"What are you building?" is a grid of six; a visitor from a domain has to know the product name to find their world, and cannot see a template in a brand family without leaving the page.

## Change

- Each tour entry names a `domain` (operations, revenue, support, agents, security, energy, engineering …). `/` gets a row of domains that scrolls the showcase to that world; `/templates` groups by domain.
- A template page's screen gets the theme-family control (the built-in themes + the shipped families), persisted through `ThemeProvider` like the shell's own switcher.

## Acceptance

- Every template belongs to a domain; the row on `/` links to a live anchor; the family control re-themes the native screen without reload.

## Test / gate

`pnpm --filter home build`, e2e theme-sweep + keyboard, `lhci`.

## Orchestrator notes

Last; only worth it once wave 2 gives the domains more than one product each side of business ops.
