---
id: RM-149
title: "`/llms/templates`: every template as text — scenario, views, blocks, packages, commands"
status: done
priority: P1
effort: S (0.5 day)
wave: 1
depends_on: [RM-147]
blocks: []
agent: brand-ui-component-builder
model: sonnet
touches:
  - apps/home/app/llms/templates/route.ts (new)
  - apps/home/app/llms.txt/route.ts (link the new file)
  - apps/home/e2e (smoke: the route answers, lists every template slug)
source: docs/review/2026-09-23-home-experience.md §1 e
---

# RM-149 `/llms/templates`

## Finding

`/llms.txt` and `/llms/<pkg>` describe packages. An agent asked to build a support desk has no text route to learn that `support-desk-page` exists, what it composes, and the one command that copies it in.

## Change

One markdown route: per template — name, url, scenario, views, interaction, blocks (names), packages, the copy command (`npx shadcn@latest add <registry>/<name>.json`) or the scaffold command for a starter. Built from the same generated catalogue + `template-tours.ts` as the pages.

## Acceptance

`curl /llms/templates` lists all 22 templates; `/llms.txt` links it; content matches the site's pages.

## Test / gate

`pnpm --filter home build`, e2e smoke.

## Orchestrator notes

Pairs with RM-148; both read RM-147's data.
