---
TYPE: issue
TITLE: "[ai] A2UI renderer MVP in @qlik-coe-emea/qlabs-components-ai (Tier-1 adapters, data binding, actions)"
LABELS: type:tech-debt, severity:P2, area:ai, area:ui, needs-triage
WP: WP-11
---

## Summary

Add the A2UI renderer to **`@qlik-coe-emea/qlabs-components-ai`** (a `@qlik-coe-emea/qlabs-components-ai/a2ui` module, sibling to the existing
`JSXPreview`): a React renderer over `@a2ui/web_core` that maps the brand-ui A2UI catalog (issue-02) to
brand-ui components, renders themed A2UI surfaces inside `@qlik-coe-emea/qlabs-components-ai`'s `Message`/`Artifact`/`Tool`,
resolves data bindings, and forwards user actions to the agent runtime. This is the runtime half of
A2UI support — and it reuses `@qlik-coe-emea/qlabs-components-ai`'s streaming/host machinery rather than a greenfield package.

## Source

[`../../05-a2ui-concept.md`](../../05-a2ui-concept.md) §5(b)/(c). Renderer guide:
https://a2ui.org/guides/renderer-development/

## Severity & impact

**P2.** Turns the catalog contract into actual rendered, interactive, themed UI — the user-visible
payoff of A2UI support.

## Current state & why the gap exists

New. `@a2ui/web_core` provides the protocol/state/validation (~3,000 lines we don't write), so this is
bounded: the work is the adapter + theming + actions layer.

## Proposed solution

- Add a contained `@qlik-coe-emea/qlabs-components-ai/a2ui` module (sub-path export) — **not a new package**. It sits beside
  `JSXPreview` and reuses the same host pattern (streaming, last-good fallback). `@qlik-coe-emea/qlabs-components-ai` already
  deps `@qlik-coe-emea/qlabs-components-ui` + the `ai` SDK, so there's no new dep graph to register.
- Use `web_core`'s `MessageProcessor` + `SurfaceModel` + `DataModel` for the v0.9 stream, state, and
  schema validation. Export `<A2uiSurface>` / `useA2ui`.
- Implement **Tier-1 adapters** (Text, Button, Card, Badge, Avatar, Alert, Divider, Image, Icon,
  TextField, Checkbox, Switch, Slider, ChoicePicker→Select/Combobox/RadioGroup, Tabs, Modal→Dialog/
  Sheet, Row/Column/List, Progress, Skeleton, Tooltip, state primitives). Each adapter maps A2UI
  semantic props → brand-ui `cva` variants/props.
- Render inside the app's `ThemeProvider` so surfaces inherit the active theme (no agent-sent colors).
- **Data binding:** resolve `{path}` against the surface data model; support template lists.
- **Actions:** build `userAction` payloads with resolved context; expose an `onAction`/transport hook
  (transport — AG-UI/A2A/MCP — is app-owned). Provide an AG-UI example in the playground.
- **Graceful degradation:** unknown component → a safe fallback (named placeholder), never crash;
  report `VALIDATION_FAILED` back per spec. Advertise `supportedCatalogIds` (catalog negotiation).
- **Enforcement (DoD):** a gate (WP-10) fails if an `a2ui.exposed` component lacks an adapter or an
  A2UI render test. Each adapter ships a contract test rendering it from sample A2UI JSON in all six
  themes (examples-as-tests).

## Affected files

- [ ] `packages/ai/src/a2ui/**` (new module: renderer, adapters, stories, tests; `@qlik-coe-emea/qlabs-components-ai/a2ui` export)
- [ ] `apps/playground/**` (AG-UI demo surface)
- [ ] `package.json`/workspace wiring; manifest + inventories (via WP-10)
- [ ] adapter↔catalog completeness gate (WP-10)

## Acceptance criteria

- [ ] `@qlik-coe-emea/qlabs-components-ai`'s `<A2uiSurface>` renders a v0.9 surface using Tier-1 brand-ui adapters, themed across all six
      themes.
- [ ] Data binding + template lists resolve; actions forward a correct `userAction`.
- [ ] Unknown components degrade gracefully (no crash) and report a validation error.
- [ ] Every `a2ui.exposed` component has an adapter + a six-theme contract test; the completeness gate
      passes.
- [ ] An AG-UI playground demo drives a sample surface end-to-end.

## Test to add

Per-adapter contract tests (render from sample A2UI JSON; assert output + a11y across six themes via
`test-storybook`), plus a renderer test for data binding + action round-trip. These run in CI (WP-01).

## Risks / ripple effects

- v0.9 API churn in `web_core` — pin versions; isolate to this package.
- Keep the `@qlik-coe-emea/qlabs-components-ai/a2ui` module off the core's critical path; it's optional surface area within
  `@qlik-coe-emea/qlabs-components-ai`, gated behind a client boundary.
- Custom/Tier-2 components are out of scope here (issue-04).

## References

- `../../05-a2ui-concept.md` §5; https://a2ui.org/guides/renderer-development/;
  https://a2ui.org/guides/a2ui-with-any-agent-framework/; WP-10 (gates), WP-01 (CI).
