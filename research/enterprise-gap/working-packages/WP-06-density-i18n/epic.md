---
TYPE: epic (tracking issue)
TITLE: "[tokens] WP-06 — Density axis + i18n/RTL foundation"
LABELS: type:tech-debt, severity:P1, area:tokens, area:ui, area:a11y, needs-triage
---

## Summary

Two enterprise table-stakes that brand-ui currently lacks entirely: a **density axis**
(comfortable/compact) and an **i18n/RTL foundation**. Both are hallmarks of enterprise systems (Ant
compact algorithm, Carbon/Fluent sizing scales; MUI/React-Aria RTL + locale formatting) and both are
absent today (verified: no density mode beyond per-component `size`; no `dir`/RTL handling, no locale
formatting, hardcoded English component microcopy).

## Issues (split when filing)

### issue-01 — System-wide density axis _(P1, area:tokens/ui)_

- **What:** Add a density dimension (e.g. `data-density="compact|comfortable"` or a token set) that
  scales control heights, paddings, and row heights from tokens — not per-component overrides. Wire it
  through `ThemeProvider` (alongside theme + the existing motion preference). Apply first to the
  data-dense surfaces (DataTable rows, form controls, menus).
- **Why:** data-dense internal tools (the audience) need to tighten the UI globally; doc 01, dim 3.
- **Acceptance:** toggling density rescales the app from tokens; DataTable + inputs respond; storied
  in both densities × six themes; smoke-tested; gap B1.
- **Approach note:** model it like the existing theme mechanism (a data-attribute + token overrides)
  to stay consistent with the system's "everything is a token" philosophy.

### issue-02 — i18n / RTL foundation _(P1 — P0 if non-English/EU products are in scope, area:a11y/ui)_

- **What:** (a) **RTL/bidi:** adopt logical CSS properties (Tailwind v4 makes this tractable) and an
  app-level `dir` switch; verify overlays/portals (Dialog/Sheet/Popover) inherit direction (the known
  MUI gotcha). (b) **Locale formatting:** route dates/numbers through `Intl`; ensure `Calendar`/
  `DatePicker` are locale-aware. (c) **Externalized strings:** extract built-in component microcopy
  (aria-labels, "no rows", pagination text) into an overridable locale provider so apps can translate
  component copy, not just their own.
- **Why:** blocks Arabic/Hebrew and proper localization; under the EAA, RTL/locale failures are also
  an accessibility exposure for EU-facing products; doc 01, dim 5.
- **Acceptance:** a documented RTL example renders correctly (incl. overlays) in all six themes;
  component strings are overridable via a provider; date/number formatting respects locale; gap B2.
- **Scope note:** this is a _foundation_, not full translation — ship the mechanism + English default
  - one RTL/locale proof, then expand. Confirm with the maintainer whether non-English/EU is in scope
    (sets P0 vs P1).

## Definition of done

- A token-driven density axis and an i18n/RTL foundation (logical properties, locale formatting,
  externalized strings) both exist, storied and verified across themes. Closes **B1, B2**.

## Dependencies

Depends on **WP-01/02** (enforcement + bar). Density pairs naturally with **WP-04** (express density
as DTCG tokens). i18n strings work touches many components — sequence after coverage (WP-02) so each
change is story/test-guarded.

> **See also — interaction guidelines** ([adoption record](../../12-interaction-guidelines-adoption.md)): this WP absorbs **`Intl.DateTimeFormat`/`Intl.NumberFormat` + `translate="no"`** (brand/code tokens) into i18n scope.
