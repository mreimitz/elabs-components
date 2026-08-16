---
TYPE: epic (tracking issue)
TITLE: "[ai] WP-11 — A2UI support: build the A2UI baseline into @qlik-coe-emea/qlabs-components-ai (catalog + renderer)"
LABELS: type:tech-debt, severity:P2, area:ai, area:registry, needs-triage
---

## Summary

Support **A2UI** (Google's open, Apache-2.0 streaming protocol for agent-driven UIs) so an agent can
emit declarative UI that renders natively with **brand-ui** components. A2UI is "UI as data, not
code": agents reference a **client-controlled catalog** of components, and a **renderer** maps each to
native widgets. brand-ui is unusually well-suited to be that catalog/renderer — it's token-driven,
themeable, accessible, and React — and A2UI's "agents describe _what_, renderers decide _how_ (via
tokens)" philosophy is brand-ui's exact model. Full analysis:
[`../../05-a2ui-concept.md`](../../05-a2ui-concept.md).

**`@qlik-coe-emea/qlabs-components-ai` is already the baseline** — its `JSXPreview` component renders agent-emitted UI today (a
`components` allow-list + `bindings` + streaming), so A2UI is its safe, declarative successor. Build
the renderer **inside `@qlik-coe-emea/qlabs-components-ai`** (a contained `@qlik-coe-emea/qlabs-components-ai/a2ui` module, sibling to `JSXPreview`) and
**enhance existing blocks** (`Artifact`/`Tool`/`Message`) to host A2UI surfaces — not a greenfield
package. This is **LATER / phase-gated R&D**: A2UI is young (v0.8 stable, v0.9 draft), adoption is
unproven, and most brand-ui components are deliberately **out of scope** (the catalog is a curated
allow-list). Sequence after the foundation (WP-01/02) and the agent ground-truth layer (WP-03),
reusing the self-maintaining machinery (WP-10).

## Why P2 / LATER (and why on @qlik-coe-emea/qlabs-components-ai)

- Depends on **WP-03** (the enriched manifest generates the catalog) and **WP-10** (keeps the catalog
  from drifting). Shouldn't compete with CI/coverage/tokens for priority.
- A2UI is **moving** (v0.9 draft; the `theme` field is still `z.any()`). Keep it in a contained
  `@qlik-coe-emea/qlabs-components-ai/a2ui` module, pin to `@a2ui/web_core` v0.9, keep it off the core's critical path.
- `@qlik-coe-emea/qlabs-components-ai` already owns the agent↔UI boundary (`JSXPreview`, `Artifact`, `Tool`, streaming), so
  building here reuses real machinery instead of duplicating it. Note the runtime seam: `@qlik-coe-emea/qlabs-components-ai` is
  AI-SDK/AI-Elements-based; A2UI's reference path is `web_core` + AG-UI (they coexist — validate in
  the spike).
- Library support is **necessary but not sufficient** — it pays off only with an agent runtime that
  emits A2UI (app-owned, via AG-UI/A2A/MCP).

## Scope guardrail (the curation)

A component is exposed to A2UI only if it is presentational/declarative, prop-driven with serializable
props, safe for an agent to assemble, and token-themed. **Tier 1** (direct adapters): Text, Button,
Card, Badge, Avatar, Alert, Divider, Image, Icon, TextField, Checkbox, Switch, Slider, Select/
Combobox/RadioGroup (→ ChoicePicker), Tabs, Dialog/Sheet (→ Modal), Row/Column/List, Progress,
Skeleton, Tooltip, state primitives. **Tier 2** (custom components): DataTable, charts, MetricGrid,
DateTimeInput. **Tier 3 (excluded):** `@qlik-coe-emea/qlabs-components-editor`, `@qlik-coe-emea/qlabs-components-flow`, Command, Carousel, Resizable,
context menus, Sonner, `@qlik-coe-emea/qlabs-components-marketing`. **`@qlik-coe-emea/qlabs-components-ai` is the baseline, not Tier-3** — it hosts the
renderer and contributes some catalog components (`Tool`, `Artifact`, `Plan`, `Confirmation`, `Task`).
See the mapping table in [`../../05-a2ui-concept.md`](../../05-a2ui-concept.md#4-the-component-mapping--whats-usable-what-isnt).

## Child issues

- **issue-01-a2ui-spike** — Phase 0: throwaway POC rendering the A2UI Basic Catalog with ~6 brand-ui
  components via `@a2ui/web_core` + the official React renderer, themed, in the playground (next to
  `@qlik-coe-emea/qlabs-components-ai`'s `JSXPreview`; validates the AI-SDK ↔ web*core streaming seam). De-risks the moving
  target before committing. *(P2)\_
- **issue-02-catalog-generator** — generate the brand-ui A2UI `catalog.json` from the enriched
  manifest + a per-component `a2ui` opt-in in `meta`; stale-gate it in CI. _(P2; depends WP-03/WP-10)_
- **issue-03-react-renderer-mvp** — add the `<A2uiSurface>` renderer to **`@qlik-coe-emea/qlabs-components-ai`** (sibling to
  `JSXPreview`) over `web_core`: Tier-1 adapters, data binding, actions, graceful degradation, catalog
  negotiation, six-theme stories/tests + an AG-UI demo. _(P2)_
- **issue-04-custom-components** — Phase 2: DataTable, charts, MetricGrid, DateTimeInput as custom
  A2UI catalog components. _(P2)_
- **issue-05-enhance-ai-components** — enhance existing `@qlik-coe-emea/qlabs-components-ai` blocks to host/render A2UI:
  `Artifact` as a surface container, `Tool` output as a surface, `Message`/`MessageResponse` rendering
  A2UI inline, and `JSXPreview` repositioned as the legacy (markup-string) sibling. _(P2)_

## Definition of done

- `@qlik-coe-emea/qlabs-components-ai` (via a contained `@qlik-coe-emea/qlabs-components-ai/a2ui` module) renders A2UI v0.9 surfaces with brand-ui
  components, themed across all six themes, with data binding + actions wired and graceful degradation;
  existing `Artifact`/`Tool`/`Message` blocks can host them.
- The catalog is **generated from the manifest** and **stale-gated** (never hand-authored).
- Every `a2ui.exposed` component has an adapter + a contract test (examples-as-tests) — **enforced by
  a gate**, not remembered.
- Closes the A2UI portion of the generative-UI frontier (doc 02 §C); realizes
  [`../../05-a2ui-concept.md`](../../05-a2ui-concept.md).

## Dependencies

**WP-03** (manifest → catalog) and **WP-10** (generation + stale-gate machinery). Sequence after the
NOW/NEXT phases. Independent of WP-05–WP-08 (though Tier-2 custom components benefit from WP-05's real
charts/grid).

> **See also — composition patterns** ([adoption record](../../13-composition-patterns-adoption.md)): shape the A2UI catalog components + surfaces as the **`state/actions/meta`** interface.
