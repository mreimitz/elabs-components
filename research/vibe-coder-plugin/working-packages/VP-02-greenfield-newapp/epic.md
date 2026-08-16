---
TYPE: epic (tracking issue)
TITLE: "[plugin] VP-02 — Greenfield `new-app` guided build flow"
LABELS: type:tech-debt, severity:P1, area:ai, needs-triage
---

## Summary

Build the headline experience: Claude (in Cowork) guides a vibe coder from a vague idea to a running,
best-practice brand-ui app — staged interview (high-level → detail) with **visual feedback loops**,
producing a living `app-spec.md` and a born-compliant scaffold. Design:
[`../../02-greenfield-guided-flow.md`](../../02-greenfield-guided-flow.md).

## Child issues

- **issue-01-new-app-skill** — the `new-app` skill: the 7-stage interview (`AskUserQuestion`),
  the living `app-spec.md`, and the visual feedback loop integration (VP-04). _(P1)_
- **issue-02-scaffold-from-spec** — `brand-ui scaffold` full behavior + `scaffold-builder` subagent:
  spec → template (WP-13) + playbooks (WP-09) + theme + shell + the agent-context handoff + gates,
  audited cross-theme before "done." _(P1)_

## Definition of done

- `new-app` runs the staged interview with visual previews and writes `app-spec.md`.
- `brand-ui scaffold` turns the spec into a best-practice brand-ui app (tokens/shell/templates/
  playbooks/states), with `CLAUDE.md`/`AGENTS.md` + context file + gates so the user's agent continues
  on-brand.
- A final `brand-ui-audit` pass confirms six-theme/a11y health.
- Works in Cowork (full) + Code; degrades to "spec + commands" in plain chat.

## Dependencies

VP-01 (router + scaffold function skeleton). Consumes WP-13 (templates), WP-09 (playbooks), WP-05
(widgets/charts), WP-03 (context), WP-10 (gates), WP-12 (guidance). Pairs with VP-04 (visual loop).

> **See also — interaction guidelines** ([adoption record](../../../enterprise-gap/12-interaction-guidelines-adoption.md)): **audits generated UIs against `/review-interface`** in propose→preview→refine, and ships the interaction guidelines as the end-user quality bar (plugin-defines-the-standard).

> **See also — composition patterns** ([adoption record](../../../enterprise-gap/13-composition-patterns-adoption.md)): ship the **composition patterns** as the plugin's component-authoring guidance (compound + state-lifted, not boolean-prop sprawl).

> **See also — view transitions** ([VT-01](../../../view-transitions/working-packages/VT-01-view-transitions/epic.md)): the VT lever puts **policy (when/what animates) in the plugin** — wire the route/view-swap helper to the generated app's router and choose which interactions morph. The library ships the capability (inert at rest); the plugin decides usage.
