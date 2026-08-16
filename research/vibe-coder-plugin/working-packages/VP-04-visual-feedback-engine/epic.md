---
TYPE: epic (tracking issue)
TITLE: "[plugin] VP-04 — Visual feedback-loop engine (propose → preview → pick → refine)"
LABELS: type:tech-debt, severity:P1, area:ai, needs-triage
---

## Summary

Build the reusable **visual interaction feedback loop** both flows depend on: at any visual decision,
**propose** 2–4 options, **preview** them as _real rendered brand-ui in the chosen theme_, let the user
**pick**, and **refine** until happy. brand-ui's edge: the **Storybook MCP renders real components in
all six themes** — so previews are actual UI, not mockups. Design:
[`../../02-greenfield-guided-flow.md`](../../02-greenfield-guided-flow.md) (the loop).

## Why a shared package

Both `new-app` (archetype/nav/theme/surface choices) and `migrate` (recomposed surfaces, before/after)
need the same loop. Build it once as a reference + helper, not twice.

## Issues (inline — split when filing)

- **issue-01 — the loop reference + fidelity ladder.** A `reference/visual-loop.md` the skills follow:
  propose → preview → pick (`AskUserQuestion`) → refine; with the fidelity ladder **real Storybook
  render > generated artifact preview > option thumbnail/snippet > text**. Never advance a visual
  choice on text alone if a render is available. _(P1)_
- **issue-02 — Storybook-MCP preview helper.** A helper that, given a component/playbook + theme slug,
  starts/uses the Storybook dev server and returns a `preview-stories` render (or falls back to a static
  screenshot if the server is unavailable). Surface the URL/preview to the user. _(P1)_
- **issue-03 — artifact preview for composed surfaces.** Generate a self-contained preview (artifact/
  HTML file) of an assembled multi-component screen for stages where a single story isn't enough; the
  user opens it and reacts. _(P2)_

## Definition of done

- A documented, reusable loop both flows call; the highest-fidelity preview available is always used.
- Storybook-MCP real renders work in the chosen theme; graceful fallback when the server is down.
- Composed-surface previews available as artifacts.

## Dependencies

VP-01 (plugin/MCP wiring). Uses the Storybook MCP (already in the repo) + `AskUserQuestion`. **Flagged:**
plugin-owned inline widgets are not a documented API — rely on Storybook renders + artifacts + question
previews.

> **See also — interaction guidelines** ([adoption record](../../../enterprise-gap/12-interaction-guidelines-adoption.md)): this WP runs **`/review-interface`** as part of the visual feedback loop on each generated surface.

> **See also — view transitions** ([VT-01](../../../view-transitions/working-packages/VT-01-view-transitions/epic.md)): the VT lever puts **policy (when/what animates) in the plugin** — wire the route/view-swap helper to the generated app's router and choose which interactions morph. The library ships the capability (inert at rest); the plugin decides usage.
