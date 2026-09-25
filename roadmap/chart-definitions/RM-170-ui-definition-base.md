---
id: RM-170
title: "ui definition base: the React-free `@elabs-ai/components-ui/definition` subpath"
status: in-progress
priority: P0
effort: L (3–4 days)
wave: A
depends_on: []
blocks: [RM-171, RM-172, RM-174]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/ui/src/lib/definition/ (new — React-free; no import of React or of any component)
  - packages/ui/src/lib/definition/field.ts (new — `field.string / number / integer / boolean / enum / color / responsive / object / array`)
  - packages/ui/src/lib/definition/prop-group.ts (new — `definePropGroup({ id, fields })` → `{ id, fields, defaults }`)
  - packages/ui/src/lib/definition/component-definition.ts (new — `ComponentDefinition<P, Ctx, Targets>`, `TargetDescriptor`; no `component`)
  - packages/ui/src/lib/definition/resolve-props.ts (new — pure, identity-preserving)
  - packages/ui/src/lib/definition/aliases.ts (new — `ALIAS_TRANSFORMS`, `applyAliases`)
  - packages/ui/src/lib/definition/warn-once.ts (new — dev-only `warnOnce`)
  - packages/ui/src/lib/definition/issues.ts (new — `SpecIssue`, `ValidationResult<T>`)
  - packages/ui/src/lib/definition/groups/header.ts, a11y.ts, status.ts (new — the three groups shared with flow)
  - packages/ui/src/lib/definition/index.ts (new — the subpath entry)
  - packages/ui/src/lib/definition/acceptance.test.ts (new — BarChart-shaped and FlowNode-shaped definitions)
  - packages/ui/src/lib/definition/definition.test-d.ts (new — type tests on defaults and fields)
  - packages/ui/package.json (`./definition` in `exports` and `publishConfig.exports`)
  - packages/ui/tsup.config.ts (the `definition` entry in the React-free pass beside `lib/cn`)
  - .changeset/*.md (minor — new `@elabs-ai/components-ui/definition` subpath)
source: docs/review/2026-09-25-charts-unification-review.md F01, F39; docs/review/2026-09-25-flow-unified-contract-and-yaml-review.md §3.2, §5, §6 (Phase A); ADR 0042
---

# RM-170 ui definition base: the React-free `@elabs-ai/components-ui/definition` subpath

## Finding

- Nothing gives chart props groups, tiers, defaults or conditions (F01, F39); flow has no base data types either (flow review §2.1). Both packages would otherwise build the same description layer twice.
- The flow review (§3.2, §5) and this track agreed one base in `ui`: charts definitions and the `./test` double, flow's React-free `/spec` core, and the cli gen step all consume it. That meets the subpath rule — a lighter dependency tree (no React) and real consumers.
- `SpecPlaygroundError` (`packages/ui/src/components/spec-playground/spec-playground.tsx:30`) already carries the issue fields the base needs.

## Change

Files in `packages/ui/src/lib/definition/`, exported as `@elabs-ai/components-ui/definition` (the `./lib/cn` precedent):

- `field.ts` — each field takes `default`, `min` / `max`, `unit`, `tier` (`essential` / `advanced`), a declarative `appliesWhen` (`{ field, equals }` or `{ field, in }`) and `deprecated`.
- `prop-group.ts` — `definePropGroup` returns `{ id, fields, defaults }`; `defaults` is typed `as const satisfies Required<P>` minus deprecated keys.
- `component-definition.ts` — `id, version, label, description?, groups, fields, codeOnly, defaults?, targets, normalize?, aliases?, migrate?`. **No `component`** (bound in a registry instead); `codeOnly` lists callback and `ReactNode` props.
- `resolve-props.ts` — `resolveProps(def, props, ctx)` in the order user > kind default > group default > theme token; returns the same object when nothing changes.
- `aliases.ts` — alias rows are data `{ from, to, transform, precedence, since, removeIn }`; transforms are the closed ids `identity | loading-to-status | boolean-to-labels | invert-boolean`; `precedence` defaults to `new-wins`. A `Record<string, string>` is shorthand for `identity` / `new-wins`.
- `warn-once.ts` — `warnOnce(key, message)`, silent in production.
- `issues.ts` — `SpecIssue { path, code, message, severity? }` and `ValidationResult<T> = { ok, value, issues }`.
- `groups/header.ts`, `a11y.ts`, `status.ts` — `status` is the **tone** group and is never applied to chart containers, whose `status` stays the loading alias.

## Acceptance

- `acceptance.test.ts` declares a BarChart-shaped definition (data roles: x as a dimension from a prop, the measure from a `Bar` part's `dataKey`) and a FlowNode-shaped definition (ports) from local type fixtures that mirror the real props; neither needs a special case.
- Type tests: `defaults` keys equal the group's optional keys minus deprecated ones; field keys match.
- `resolveProps` returns the input object when nothing changes; `applyAliases` honours each transform and both precedences, and writes a dotted `to` path (`empty.title`) into an object prop, merging per key; `warnOnce` fires once per key in dev and never in production.
- An issue's `severity` defaults to `"error"`; a `deprecated-prop` issue is `"warning"`.
- The subpath's module graph has no React (checked by a test or the built entry).
- `brand-ui-reviewer` has reviewed the new subpath.

## Test / gate

`pnpm --filter @elabs-ai/components-ui typecheck lint test`, `pnpm build` (the subpath dist exists), `pnpm gen && pnpm gen:check`, `pnpm consumer:check`, review lane `brand-ui-reviewer`.

## Orchestrator notes

When RM-170 and RM-171 merge, tell the flow track its Phase 1 may start; it needs nothing else from charts.
