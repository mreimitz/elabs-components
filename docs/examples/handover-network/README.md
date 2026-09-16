# Handover-network example

How to draw a resource-handover (social) network from a raw event log using
`@elabs-ai/components-flow` alone — no `@elabs-ai/components-process` import anywhere.
`handover-network.tsx` is the worked file; this README explains the aggregation it runs
and why it is a recipe, not a new component.

## Why this is "reuse", not a new component

A handover network answers "who hands the case to whom" — a general resource × resource
graph, not a process-specific shape. `@elabs-ai/components-flow` already draws exactly
this: `layoutGraph({ algorithm: "force" })` positions an arbitrary graph with a seeded,
deterministic force simulation, and `FlowWeightedEdge` draws a weighted edge with its
count as stroke width AND a printed label pill. Both already ship — reusing them, per the
roadmap finding's own instruction, means this example intentionally adds nothing to
`packages/process` or `packages/flow`.

## The aggregation

`computeHandoverPairs` groups an event log's rows by `caseId`, sorts each case's own
events by timestamp, then counts one handover for every CONSECUTIVE pair of events whose
`resource` differs. Counts are **case-weighted**: summed across every case, so a case that
hands off A→B→A twice contributes 2 to the A→B count and 1 to the B→A count — never
deduplicated down to "did this pair ever occur".

The row shape this file needs (`HandoverEventRow`: `caseId`/`activity`/`resource`/
`timestamp`) is declared locally, deliberately NOT imported from
`@elabs-ai/components-process`'s `EventRow`/`EventLog` — that is what keeps this example
usable in an app that never installs the process package at all.

## Drawing it

`HandoverNetwork` turns the pair counts into nodes (one `FlowNode` per resource) and edges
(one `FlowWeightedEdge` per ordered pair with a count), runs `layoutGraph`'s `"force"`
algorithm over them, and renders the result inside `CanvasShell`. The count reaches the
edge through three channels, in this priority order — width, then the printed pill, then a
redundant colour tint (`value`/`valueDomain`) — so the reading survives greyscale (WCAG
1.4.1), the same rule `@elabs-ai/components-process`'s own `ProcessTransitionEdge` follows
for a directly-follows edge.

## Resource-role colouring (optional)

Nothing here paints a resource by role/team — this recipe only counts and lays out. An app
that already groups resources (e.g. by team or role) can layer that on top with
`@elabs-ai/components-flow`'s own `useFlowGroups` (cluster nodes into a collapsible
`FlowGroupNode` per role) and `Legend` (a categorical key naming each role's tone), both
already exported from `@elabs-ai/components-flow` — no new primitive needed for that
either.

## What this package never does

Nothing in `@elabs-ai/components-flow` (or, transitively, this example) reads a raw event
log, discovers a graph, or knows what a "case" or a "resource" is — `computeHandoverPairs`
is the one place that understands the log shape, and it lives in your application, not in
brand-ui (D5 — brand-ui is a presentation layer, not a runtime; see `docs/DECISIONS.md`).

## Related

- `docs/examples/process-explorer-external-selection/` — the sibling recipe for driving
  `ProcessMap` from a host's own selection engine.
- `.claude/rules/data.md` ("Process mining" section) — the primitive-home table this
  recipe follows (edges/layout live in `flow`).
