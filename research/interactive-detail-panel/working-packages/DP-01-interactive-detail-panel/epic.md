---
TYPE: epic (tracking issue)
TITLE: "[ui] DP-01 — UI defaults: Card detail panel + Lucide as the default icon library"
LABELS: type:feature, severity:P2, area:ui, area:icons, needs-triage
---

## Summary

A small working package bundling **two independent UI/system-default decisions** you asked to co-locate:

1. **Card detail panel** — an optional side/bottom detail region on `@qlik-coe-emea/qlabs-components-ui` `Card`, either always
   shown (`fixed`) or revealed on hover/focus (`hover`, content shrinks within a fixed footprint).
   **Empty detail → today's `Card`, unchanged.**
2. **Lucide as the default icon library** — formalize `lucide-react` (already the de-facto default,
   imported by 74 files) as the documented standard, define the `@qlik-coe-emea/qlabs-components-icons` boundary, align the
   version drift, gate it, and have the plugin set it as the end-user default.

Design + API: [`../../README.md`](../../README.md).

**Scope:** (1) additive `Card` props (`detail`, `detailPlacement`, `detailReveal`, `detailSize`) + two
internal regions + tokened motion + a11y (hover **and** focus-within, keyboard/touch parity) +
stories/tests/registration; (2) the Lucide decision-of-record + boundary docs + version alignment + an
import/drift gate + plugin wiring.

**Out of scope:** a separate `DetailCard`/primitive (decision: enhance `Card` directly); a click-to-toggle
disclosure (future `detailReveal="toggle"`); deprecating `@qlik-coe-emea/qlabs-components-icons` (it stays first-class for brand
icons); refactoring `ChartFrame` to consume the panel (tracked in chart-components, not here).

## Why P2

Both are reusable system-level improvements (the panel benefits every card; the icon default removes
ambiguity for every consumer + agent), but neither is blocking — the panel is additive with an unchanged
default, and Lucide is already in use so its formalization is low-risk.

## Decisions taken (don't re-litigate)

1. **Enhance `Card` directly** — not a new component/primitive; `ChartFrame` reuses it.
2. **Hover = fixed footprint, content shrinks** — outer size constant, no surrounding reflow.
3. **Lucide is the default icon library** — `@qlik-coe-emea/qlabs-components-icons` is for brand/product icons + `BrandLogo`; no
   third icon library.

## Child issues

- **issue-01-card-detail-api** — the feature: `detail` slot + `detailPlacement`/`detailReveal`/`detailSize`
  variants; the grid mechanics (fixed + hover/focus reveal at fixed footprint); backwards-compat
  (empty → unchanged `Card`); tokened motion + `motion-reduce:`; a11y (hover+focus-within, keyboard/touch
  parity, no essential info behind hover). _(P2)_
- **issue-02-stories-tests-register** — stories (empty / side×{fixed,hover} / bottom×{fixed,hover} /
  interactive+detail) across six themes + axe; smoke tests (empty=normal card, reveal toggles); register
  (manifest/registry/storySort) + docs. _(P2)_
- **issue-03-lucide-default-icons** — formalize Lucide as the default (it already is — 74 files); define
  the `@qlik-coe-emea/qlabs-components-icons` boundary in a new `.claude/rules/icons.md` + CLAUDE/AGENTS/skill + the icons barrel
  comment; align the `lucide-react` version drift (`0.469` vs `0.577`); add an import-allowlist + drift
  gate; have the plugin scaffold it for end-users. _(P2)_

## Definition of done

**Detail panel (issue-01/02):**

- `Card` with no `detail` renders identically to today (verified by a smoke test + the existing Card
  stories still passing).
- `detail` set: side/bottom placement works; `fixed` always shows; `hover` reveals on hover **and**
  focus-within with the content shrinking inside a constant outer footprint.
- Motion is tokened and snaps under `prefers-reduced-motion`; AA contrast on panel + divider in all six
  themes (observed via per-theme story screenshots).
- New props exported on `CardProps`; `forwardRef`/`className`/`...props` preserved.
- Registered everywhere a component must be (born-compliant under the WP-10 gates); stories + smoke tests
  green.

**Default icons (issue-03):**

- Lucide documented as the default (rule + CLAUDE/AGENTS/skill + the fixed `@qlik-coe-emea/qlabs-components-icons` barrel comment);
  one `lucide-react` version across all packages; a gate fails on non-Lucide/non-`@qlik-coe-emea/qlabs-components-icons` imports or
  version drift; the plugin scaffolds the default for end-users.

## Dependencies

Enhances `@qlik-coe-emea/qlabs-components-ui` `Card` (`packages/ui/src/components/card/`) and `@qlik-coe-emea/qlabs-components-icons` /the icon convention.
Rides the enterprise-gap **WP-10** gates (registration + the icon gate) and **WP-02** (story/test/six-theme
bar); the icon guidance feeds **WP-12** (guidance consistency) and the **vibe-coder-plugin** (scaffolded
default). Natural consumer of the panel: chart-components **CH-01 issue-07** (`ChartFrame`) — independent.

> **See also — view transitions** ([VT-01](../../../view-transitions/working-packages/VT-01-view-transitions/epic.md)): the detail-panel morph is the **first-class proof consumer** of the VT lever (a `viewTransition` prop, VT-01 issue-03) — it falls back to this pack's tokened grid transition under reduced-motion / unsupported.
