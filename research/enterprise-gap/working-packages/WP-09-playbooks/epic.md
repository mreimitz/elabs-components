---
TYPE: epic (tracking issue)
TITLE: "[ai] WP-09 — Playbooks: composition recipes as invokable agent skills"
LABELS: type:tech-debt, severity:P1, area:ai, area:docs, needs-triage
---

## Summary

Agents reliably get the `Button` API right and still mis-assemble whole screens. The fix (proven by
AgnosticUI's Playbooks, and matching doc 02's thesis) is to package brand-ui's **composition patterns**
as **prompt-ready, intent-mapped playbooks** — "build a dashboard" → the exact
`MetricGrid`+`DataTable`+`AppShell` assembly, with a runnable example that doubles as its test.
brand-ui already _has_ these patterns, but only as prose in
`skills/brand-ui/reference/composition.md`. This package turns them into invokable recipes an agent
(or human) can follow to first-try-correct a full pattern. _(Closes gap E8.)_

## Why this matters

doc 02: _"agents rarely fail on the component API — they fail on the whole-screen composition."_ A
playbook is "the full recipe, not just a component reference." This is the highest-leverage agent
upgrade after the enriched manifest (WP-03), and it compounds with it: the manifest tells the agent
what a component _is_; the playbook tells it how components _go together_ for a known intent.

## Candidate playbooks (start with brand-ui's real use cases)

The named audiences in `PROJECT.md`: internal apps, dashboards, AI/chat clients, data grids, React
Flow canvases, presales demos. So:

1. **App shell** — `SidebarProvider` + `Sidebar` + `SidebarInset` + `top-nav` + breadcrumb.
2. **Dashboard** — app shell + `MetricGrid` + `DataTable` + `ChartCard`.
3. **AI chat app** — `ChatShell` + `Conversation` + `Message` + `PromptInput` + `Reasoning`/`Tool`/`Sources`.
4. **Data app** — `DataTable` + `SearchInput`/`FacetFilter`/`ColumnPicker` + states (empty/loading/error).
5. **Flow canvas** — `CanvasShell` + `FlowNode`/`FlowEdge` + `ZoomControls` + `InspectorPanel`.
6. (later) **Auth/login**, **marketing landing** (using `@qlik-coe-emea/qlabs-components-marketing`).

## Child issues

- **issue-01-playbook-format-and-first-set** — define the playbook schema (intent, components used,
  assembly steps, a runnable example/story, anti-patterns) and author the first 3–5 playbooks. _(P1)_
- **issue-02-playbook-registration-and-surfacing** — auto-register playbooks into the manifest +
  context file (WP-03) + skill, with an intent map, and **stale-gate** them (WP-10) so a new playbook
  is discoverable without manual bookkeeping. _(P1)_

## Definition of done

- 3–5 playbooks exist, each with an intent, a component list, assembly steps, a runnable example that
  doubles as its test, and anti-patterns.
- Playbooks are surfaced to agents via the context file / `brand-ui docs`/MCP and to humans via the
  index — **generated and stale-gated (WP-10)**, never hand-listed.
- An agent given "build a dashboard with brand-ui" assembles the right components on the first try
  (validate on a real task).
- Closes **E8**.

## Dependencies

Depends on **WP-03** (uses the enriched manifest + context surface) and the **WP-02** coverage bar
(the playbook example/story is itself gated). Registration/stale-gating built by **WP-10**.

> **See also — composition patterns** ([adoption record](../../13-composition-patterns-adoption.md)): the compound-component + `state/actions/meta` provider-injection shape is the **canonical structure playbooks teach** — make a 'stateful compound component' the exemplar playbook.
