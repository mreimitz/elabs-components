---
TYPE: issue
TITLE: "[ui] Add net-new widgets: number/tag/file-upload/rating/color/stepper/descriptions (+ Gantt, heavy)"
LABELS: type:tech-debt, severity:P1, area:ui, needs-triage
WP: WP-13
---

## Summary

Add the common enterprise widgets the library lacks **that aren't already owned by WP-05** (which has
charts, virtualized/server data grid, tree, transfer, date-range picker). These are the everyday
form/data components missing from `@qlik-coe-emea/qlabs-components-ui`.

## Source

Component audit ([`../../07-component-audit.md`](../../07-component-audit.md) Tier A/B/C), benchmarked
on the enterprise taxonomy (doc 01).

## Severity & impact

**P1** for the form-completion widgets (number, tag, file upload) — they block common enterprise forms;
**P2** for the rest. Interactive Gantt is **P2 + heavy** and should be split out.

## Current state & why the gap exists

`@qlik-coe-emea/qlabs-components-ui` covers the shadcn-class set but stops short of several enterprise inputs; the project grew
breadth-first on the core set.

## Proposed solution

Add, each token-driven + Radix/React-Aria-backed where applicable, accessible, storied (six themes) +
smoke-tested, auto-registered (WP-10):

- **Number input / stepper** (min/max/step, keyboard).
- **Tag / token / chips input** (create/remove, max, validation).
- **File upload / dropzone** (drag-drop, progress, accept/multiple) — presentational; app owns upload.
- **Rating** (configurable max, half-steps, readonly).
- **Color picker** (swatches + custom; emits a token-safe value where possible).
- **Stepper / multi-step wizard** (steps, progress, validation gating).
- **Descriptions / definition list** (label↔value pairs, responsive).

**Interactive Gantt — flag and split out (heavy).** You named it; it's genuinely missing (the
`@qlik-coe-emea/qlabs-components-editor` `timeline` is a content timeline, not a project Gantt with dependencies/drag-resize).
A real Gantt is a large build — recommend **wrapping a maintained library or building on a virtualized
grid**, scoped as its **own issue** when scheduled, not bundled with the quick adds. Decide build-vs-wrap
explicitly (respect "no paid deps").

## Affected files

- [ ] `packages/ui/src/components/{number-input,tag-input,file-upload,rating,color-picker,stepper,descriptions}/**`
- [ ] barrel exports; stories + tests; manifest (auto via WP-10)
- [ ] (later) `packages/<pkg>/src/components/gantt/**` — separate scoped issue

## Acceptance criteria

- [ ] The seven Tier-A/B widgets exist, accessible, storied across six themes, smoke-tested, gates green.
- [ ] Each carries an `a2ui.exposed` decision (WP-11) and a family/"when to use" note where relevant (WP-12).
- [ ] Gantt is tracked as its own scoped issue with an explicit build-vs-wrap decision (not delivered here).

## Test to add

Per-widget smoke tests (key behavior: number clamps, tag add/remove, upload accepts, rating sets,
stepper advances/validates).

## Risks / ripple effects

- Don't reinvent what WP-05 owns (grid/tree/transfer/range-picker/charts) — coordinate scope.
- Color picker must stay token-safe (don't encourage raw hex in app code — see styling rules).
- Gantt scope creep — keep it a separate, explicitly-scoped effort.

## References

- `../../07-component-audit.md` Tier A/B/C; doc 01 (enterprise taxonomy); WP-05 (hard widgets), WP-10
  (gates), WP-11 (a2ui), WP-12 (guidance).
