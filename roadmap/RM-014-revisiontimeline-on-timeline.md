---
id: RM-014
title: RevisionTimeline rides the Timeline rail
status: planned
priority: P3
effort: S (half day to 1 day)
depends_on: []
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §3.7
---

# RM-014 RevisionTimeline on Timeline

## Finding

`Core/Timeline` (`packages/ui/src/components/timeline/timeline.tsx`) calls itself "THE rail/node/connector spine (#190)" and `AgentTimeline` is built on it. `Data/RevisionTimeline` (`packages/ui/src/components/revision-timeline/revision-timeline.tsx`) imports `cva`, `cn` and lucide only and draws its own rail, nodes and connectors. Two rails in the same package.

## Change

1. Re-implement RevisionTimeline's rail with `Timeline` / `TimelineItem` (or whatever the compound parts are named in `timeline.tsx`): day-group headers stay, each revision becomes an item whose node is the commit/branch/merge icon and whose status colour maps onto Timeline's status prop.
2. If Timeline cannot express something RevisionTimeline needs (day grouping header inside the rail, the +/- line-count badge), add that to Timeline as an opt-in prop rather than keeping a fork; that is what "the spine" is for.
3. If, after a real attempt, the fit is bad, write the reason into RevisionTimeline's docblock and story description ("does not use Timeline because ...") so the next reader does not re-investigate.

## Acceptance

- Either `revision-timeline.tsx` imports from `../timeline/timeline`, or its docblock states why not.
- `Data/RevisionTimeline` stories and tests pass; three-theme sweep unchanged.

## Test / gate

Existing tests; visual sweep.
