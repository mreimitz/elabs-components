---
id: RM-148
title: "Home showcase leads with a native template; parts row generated from the tour; template prompt names the blocks"
status: done
priority: P0
effort: S (0.5 day)
wave: 1
depends_on: [RM-147]
blocks: [RM-153]
agent: brand-ui-component-builder
model: sonnet
touches:
  - apps/home/components/gallery/sections.tsx (FEATURED_TEMPLATE → a native `-page` template)
  - apps/home/components/gallery/template-showcase.tsx (parts from the tour's views)
  - apps/home/content/copy.ts (drop the hard-coded `featuredTemplateCopy.parts`)
  - apps/home/content/prompts.ts (`newProjectPrompt` / template prompt take `blocks[]`)
source: docs/review/2026-09-23-home-experience.md §1 b, c
---

# RM-148 Native featured template

## Finding

The home page's featured tile is "Agentic AI Workspace", the one template without a registry item; it renders through a Storybook iframe and was blank in the local run while the five crops beside it rendered natively. Its parts row is hard-coded. The template prompt never names the blocks a template is made of.

## Change

- Feature a `-page` template (agent-ops-center-page keeps the agent story on the front page while rendering natively); parts row = the template's tour views.
- The template prompt lists the blocks (`registryDependencies`) and the copy command, so an agent gets the recipe, not only the intent.

## Acceptance

- The featured tile renders with Storybook unreachable; its parts match the template's tour.
- The prompt on `/templates/<slug>` names every block the item depends on.

## Test / gate

`pnpm --filter home build`, e2e smoke, `home-bundle` within budget.

## Orchestrator notes

Small; run right after RM-147 merges.
