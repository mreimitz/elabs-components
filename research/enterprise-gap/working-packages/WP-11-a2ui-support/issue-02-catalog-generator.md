---
TYPE: issue
TITLE: "[ai] Generate the brand-ui A2UI catalog from the manifest (+ stale-gate)"
LABELS: type:tech-debt, severity:P2, area:ai, area:tokens, needs-triage
WP: WP-11
---

## Summary

Produce the brand-ui **A2UI catalog** — a versioned `catalog.json` (JSON Schema conforming to the
A2UI Catalog schema) that declares which brand-ui components agents may use, with their props (as JSON
Schema), semantic-hint enums (from `cva` variants), and a theme schema. **Generate it from the
enriched manifest** (WP-03) plus a per-component `a2ui` opt-in, and **stale-gate it** so it never
drifts — the catalog must be derived, not hand-maintained.

## Source

[`../../05-a2ui-concept.md`](../../05-a2ui-concept.md) §5(a)/§6. A2UI catalog spec:
https://a2ui.org/concepts/catalogs/

## Severity & impact

**P2.** The catalog is the agent-facing contract and the curation point. Generating it from the
manifest makes "expose a component to A2UI" a one-line flag and guarantees the catalog matches the
real component surface.

## Current state & why the gap exists

New. The data needed (component props/variants) lives in the WP-03 enriched manifest; this issue adds
the A2UI-specific projection + opt-in + gate. Depends on WP-03 (resolved props) and WP-10 (stale-gate
machinery).

## Proposed solution

- Add a per-component `a2ui` field to the component `meta` (WP-03 issue-02), e.g.:

  ```jsonc
  "a2ui": { "exposed": true, "a2uiType": "Button",
            "propsMap": { "variant": "variant", "child": "children", "action": "onClick" } }
  ```

- Add a generator (`brand-ui a2ui-catalog --write`, in `@qlik-coe-emea/qlabs-components-cli`) that walks the manifest, selects
  `a2ui.exposed` components, and emits a v0.9 `catalog.json`: component definitions (props → JSON
  Schema from the manifest's resolved types), semantic-hint enums from `cva` variants, a `theme`
  block, and a versioned `catalogId` URI (`.../brand-ui/v1/catalog.json`).
- Validate the output against the A2UI Catalog JSON Schema in the generator.
- **Stale-gate (WP-10):** CI regenerates and `git diff --exit-code`s `catalog.json`; fail with "run
  `brand-ui a2ui-catalog`". This is the enforcement that keeps the catalog honest.
- Follow A2UI catalog **versioning** rules (additive = same major; container/required-prop changes =
  major bump in the URI).

## Affected files

- [ ] `packages/cli/lib/core.mjs` + `bin/brand-ui.mjs` (`a2ui-catalog` command)
- [ ] `packages/ai/a2ui/catalog.json` (generated; under `@qlik-coe-emea/qlabs-components-ai`)
- [ ] component `meta` files gain `a2ui` (incrementally, Tier-1 first)
- [ ] CI stale-check (WP-10)

## Acceptance criteria

- [ ] `brand-ui a2ui-catalog --write` emits a valid v0.9 `catalog.json` for all `a2ui.exposed`
      components, with props + variant enums + theme + versioned `catalogId`.
- [ ] Output passes A2UI Catalog JSON-Schema validation.
- [ ] CI fails on a stale catalog.
- [ ] Adding `a2ui.exposed` to a component adds it to the catalog with **no other manual edits**.

## Test to add

CLI test: a fixture component flagged `a2ui.exposed` appears in the generated catalog with expanded
variant enums; the stale-check fails when the manifest changes without regeneration.

## Risks / ripple effects

- Mapping brand-ui prop types → A2UI JSON Schema needs care for complex props (fall back / exclude
  rather than emit invalid schema). Depends on WP-03 quality of resolved types.

## References

- `../../05-a2ui-concept.md` §5/§6; https://a2ui.org/concepts/catalogs/; WP-03 (manifest), WP-10
  (stale-gate).
