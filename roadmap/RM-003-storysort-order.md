---
id: RM-003
title: Deterministic sidebar order — alphabetical within groups, explicit reading order where it matters
status: planned
priority: P1
effort: S (half day)
depends_on: [RM-001]
blocks: [RM-004, RM-005, RM-008]
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §1.3, §1.4
---

# RM-003 Deterministic sidebar order

## Finding

`storySort` in `apps/docs/.storybook/preview.tsx` sets `order` but not `method`, so inside every group the order is Vite import order. Observed on the live sidebar:

- `Patterns`: Blocks, Templates and Scenarios are interleaved (`Blocks/Terminal Session (mid-turn)`, `Templates/Enterprise Admin Console`, `Templates/Terminal Agent Session`, `Scenarios/Agentic AI Workspace`, `Blocks/AI Composer`, `Templates/AI Assistant`, ..., `Blocks/Comparison Table`, `Templates/Object Detail Hub`). This is the "blocks in the middle" effect.
- `Foundations`: Colors, Elevation, Paper, Spacing & Radius, Theming, Typography, Decoration, Motion. Neither alphabetical nor the reading order the guidelines describe.
- `AI`: `ChangeReview` last, `PromptInput` after `PromptInputSlash`.

Group order: `Editor, Terminal, Viewer, Flow, Maps, Marketing` puts Terminal (the console skin of the AI family, see RM-009) three groups away from AI.

## Change

In `preview.tsx`:

```ts
storySort: {
  method: "alphabetical",
  order: [
    "Docs", ["Introduction", "Getting Started", "brand-ui MCP Server", "Storybook MCP for Agents", "AI Output Contract for Agents", "View Toolbar Contract", "Testing Charts in jsdom", "Choosing between similar components" /* RM-009 */],
    "Foundations", ["Colors", "Typography", "Spacing & Radius", "Elevation", "Motion", "Decoration", "Paper", "Theming", "Localization" /* RM-004 */],
    "Core", "Icons", "Forms", "Display", "Disclosure", "Navigation", "Overlays", "Feedback", "States", "Layout",
    "Data", "Charts",
    "AI", "Terminal",
    "Editor", "Viewer", "Flow", "Maps", "Marketing",
    "Patterns", ["Templates", "Scenarios", "Blocks"],
  ],
},
```

`Providers` is removed from the array by RM-004 (do not remove it here; RM-004 moves the stories first).

Update the group list in `docs/STORYBOOK_GUIDELINES.md` to match (RM-002 gates the two lists against each other).

## Acceptance

- Under `Patterns`, all `Templates/*` come first, then `Scenarios/*`, then `Blocks/*`, each alphabetical.
- `Foundations` reads Colors → Typography → Spacing & Radius → Elevation → Motion → Decoration → Paper → Theming.
- `Terminal` is directly after `AI`.
- No `play` test or baseline depends on sidebar order (they key on story id, not position), so nothing else should move.

## Test / gate

RM-002's gate re-run; a manual look at the live sidebar for the three groups above.
