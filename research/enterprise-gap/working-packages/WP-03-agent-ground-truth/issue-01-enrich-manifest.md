---
TYPE: issue
TITLE: "[ai] Enrich the manifest with resolved prop tables (incl. expanded cva variants)"
LABELS: type:tech-debt, severity:P1, area:ai, area:tokens, needs-triage
WP: WP-03
---

## Summary

`brand-ui.manifest.json` is the "ground truth, no drift" artifact the `brand-ui` skill reads — but
each entry is only `{name, kind, module}`. The richer `brand-ui docs` command regex-extracts the
`<Name>Props` interface text and the signature on demand, which means: no **resolved** prop types, no
**descriptions/defaults**, and — critically — **`cva` variant unions are never expanded** (an agent
sees `VariantProps<typeof buttonVariants>`, not `variant: default | secondary | destructive | outline
| ghost | link` and `size: sm | default | lg | icon | …`). So the agent still has to read the source
to know the actual variant values. This upgrade makes the manifest a real prop knowledge base.

## Source

Static repo analysis, 2026-06-06 (gap E1). Evidence: `packages/cli/lib/core.mjs generateManifest`
(emits name/kind/module); `bin/brand-ui.mjs extractProps` (regex over `Props` interface + signature);
`brand-ui.manifest.json` sample entry `{ "name": "Accordion", "kind": "value", "module": "..." }`.

## Severity & impact

**P1.** This is the single highest-leverage agent improvement. Resolved props (with variant values +
defaults + descriptions) let agents use components correctly without reading source — the
anti-hallucination win the whole skill layer is built around.

## Current state & why the gap exists

The CLI was built CLI-first and lightweight (225-line core) to ship the skills quickly (per
`CONCEPT-ai-skills.md`, props extraction was deliberately "read the file" for v1). The concept doc
itself lists "per-package generated docs / richer prop extraction" as a roadmap item.

## Proposed solution

- Add **`react-docgen-typescript`** (or `ts-morph`) extraction to `generateManifest`, producing per
  component: prop name, **resolved type** (with `cva` variant unions expanded to literal values),
  required/optional, **default**, and **TSDoc description**. (This is the same engine Storybook
  autodocs uses, so results align with the docs site.)
- Store the enriched prop tables in the manifest (or a sibling `*.docs.json` per package to keep the
  manifest lean) and have `brand-ui docs <Component>` print a clean table instead of raw interface
  text.
- Expand `cva` variants by reading the `*Variants` export's variant keys/values (the project already
  exports `xxxVariants` per the component-api rule — leverage that).
- Keep generation in `pnpm manifest` / `pnpm build`; add a CI check (WP-01) that the manifest is
  up-to-date (fail if `git diff` after regenerate).
- Encourage TSDoc on public props (add a lint nudge or a rule note) so descriptions are populated.

## Affected files

- [ ] `packages/cli/lib/core.mjs` (`generateManifest` — add docgen extraction)
- [ ] `packages/cli/bin/brand-ui.mjs` (`cmdDocs`/`extractProps` — print resolved tables)
- [ ] `packages/cli/package.json` (add docgen dep — confirm it's free/OSS; no paid deps)
- [ ] `brand-ui.manifest.json` (regenerated) and/or new `packages/*/*.docs.json`
- [ ] CI: manifest-freshness check (coordinate WP-01)

## Acceptance criteria

- [ ] `brand-ui docs Button` lists every prop with resolved type, default, description, and the
      **expanded** `variant`/`size` values.
- [ ] Manifest regeneration is deterministic and checked in CI (stale manifest fails).
- [ ] No paid dependency added.
- [ ] **needs-run:** confirm `pnpm manifest` currently succeeds before extending it.

## Test to add

A unit test asserting the generator emits expanded variant values + defaults for a known component
(e.g. Button → `variant` includes `destructive`, `size` includes `icon`). Add to `packages/cli`.

## Risks / ripple effects

- docgen on ~160 components adds build time — cache/scope it.
- Some complex generic props won't resolve cleanly — fall back to the raw type string, don't crash.

## References

- `docs/CONCEPT-ai-skills.md` (§6 "no drift"), `.claude/rules/component-api.md`; research doc 02 §4;
  gap E1
