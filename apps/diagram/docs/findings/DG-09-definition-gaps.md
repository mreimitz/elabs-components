# DG-09 — dialect v0 on the ui definition base: gaps

Built: the dialect parser, normalizer, validator and JSON Schema under `src/spec/dialect/`,
the generated `schema/arch-diagram.v0.schema.json`, 35 fixtures and the `#spec-check` route
(`src/dev/spec-check-view.tsx`). Every entity's field map sits on
`@elabs-ai/components-ui/definition` (`defineComponent`, `field`, `validateProps`,
`toJsonSchema`), so one definition feeds both the field checks and the schema. What the
definition base cannot express is written by hand in the app, each spot tagged
`// P4: library gap — …`. Evidence: `apps/diagram/.evidence/DG-09/` (repo-root-relative,
gitignored).

Every DG-04 icon name the plan §4 sample uses is in the merged `public/icons/index.json`
(the `valid-full.yaml` fixture expects no issues), so there is no icon-name section.

## 1. No recursive / `$ref` field kind (zone `children:`)

- **What:** a zone's `children:` holds zones and nodes, which hold more children. The field
  vocabulary cannot point back at a definition, so neither `validateProps` nor `toJsonSchema`
  can describe the tree.
- **Where it bit:** `apps/diagram/src/spec/dialect/definitions.ts:43` (`OPEN_ENTRY` — the
  arrays take any open object; `normalize.ts` then checks each entry with `ZONE_DEF` /
  `NODE_DEF` itself) and `apps/diagram/src/spec/dialect/schema.ts:40` (`zoneWith` writes
  `children.items.anyOf: [{ $ref: zone }, { $ref: node }]` by hand).
- **Evidence:** `packages/ui/src/lib/definition/field.ts:23-33` — `FieldKind` is a closed
  set (`string | number | integer | boolean | enum | color | responsive | object | array |
union`), no reference kind.
- **Proposed API:** `field.ref(() => ZONE_DEF)` (lazy, so a definition can reference itself),
  validated by recursing into `validateProps` and emitted by `toJsonSchema` as
  `{ $ref: "#/$defs/<def.id>" }` with the target collected into `$defs`.

## 2. No map-of field kind (`styles:`)

- **What:** `styles:` is a map from a free class name to a style (`{ tone, badge }`). The
  base has closed objects and arrays, but no "any key, every value of this shape".
- **Where it bit:** `apps/diagram/src/spec/dialect/definitions.ts:101` (`styles` is an open
  object; `normalize.ts` checks every value with `STYLE_DEF`) and
  `apps/diagram/src/spec/dialect/schema.ts:95` (`additionalProperties: { $ref: style }` by
  hand).
- **Evidence:** `packages/ui/src/lib/definition/field.ts:23-33` (no record kind);
  `object({ open: true })` only emits `additionalProperties: true`
  (`generate/json-schema.ts:59-72`), never a value schema.
- **Proposed API:** `field.record({ of: field.object({ … }) })` → validated per value with
  the entry key in the issue path (`styles.pii.tone`), emitted as
  `{ type: "object", additionalProperties: <of> }`.

## 3. No string `pattern`, no `patternProperties` (ids, the `a -> b` shorthand)

- **What:** ids follow a grammar (`ids.ts` `ID_SOURCE`), and a flow may be written as a
  one-key mapping whose key is `a -> b`. Neither can be stated on a field.
- **Where it bit:** `apps/diagram/src/spec/dialect/schema.ts:24` (`withIdPattern` adds
  `pattern` to the `id` property of the zone and node fragments),
  `apps/diagram/src/spec/dialect/schema.ts:53` (`flowItem` writes the string form and the
  `patternProperties` form by hand), and `apps/diagram/src/spec/dialect/normalize.ts:125`
  (`ID_RE.test` reports `bad-id` itself, because `validateProps` cannot).
- **Evidence:** `packages/ui/src/lib/definition/field.ts:85-88` — `StringFieldOptions` has
  `min` / `max` only.
- **Proposed API:** `field.string({ pattern: "^…$", patternMessage?: string })`, checked by
  `validateProps` (new code `pattern-mismatch`) and emitted as `pattern`; for keys,
  `field.record({ keyPattern })` (gap 2) emitted as `patternProperties`.

## 4. `appliesWhen` is sibling-only and never reaches the JSON Schema

- **What:** plan §4 (L158): `position` is only allowed under the root's `layout: manual`.
  That is a cross-entity condition (a root field decides a nested entity's field), and even
  the sibling-only `appliesWhen` the base has is not emitted into the schema.
- **Where it bit:** `apps/diagram/src/spec/dialect/schema.ts:101` (root `if` / `then` /
  `else` choosing `zone`/`node` or `zoneAuto`/`nodeAuto` `$defs`, written by hand) and
  `apps/diagram/src/spec/dialect/validate.ts:87` (`position-without-manual` in the
  validator).
- **Evidence:** `packages/ui/src/lib/definition/field.ts:50-52` — `AppliesWhen` names a
  field of the same component; `packages/ui/src/lib/definition/generate/json-schema.ts` has
  no `appliesWhen` / `if` emission (0 occurrences).
- **Proposed API:** emit `appliesWhen` as `if` / `then` (`{ if: { properties: { <field>: {
const } } }, then: … }`) for the sibling case first; a context form
  (`appliesWhen: { context: "layout", equals: "manual" }`) can follow when a second consumer
  needs it.

## 5. `toJsonSchema` has no fragment mode

- **What:** every call returns a root document (`$schema` + `title`), which is wrong inside
  `$defs`.
- **Where it bit:** `apps/diagram/src/spec/dialect/schema.ts:13` (`fragment()` strips
  `$schema` / `title` by destructuring).
- **Evidence:** `packages/ui/src/lib/definition/generate/json-schema.ts:133` (`$schema` +
  `title` on every result) and `:138` (`additionalProperties: false`).
- **Proposed API:** `toJsonSchema(def, { fragment: true })` → no `$schema` / `title`; or a
  separate `toJsonSchemaFragment(def)`. Paired with gap 1, a `toJsonSchemaBundle(root,
[defs])` that fills `$defs` would remove `schema.ts`'s hand assembly entirely.

## 6. `SpecIssueSeverity` has no `"info"`

- **What:** a flow into a zone is legal (the edge attaches to the zone's border) but worth
  telling the author — neither an error nor a warning. Monaco has an `Info` marker severity
  for exactly this (DG-12).
- **Where it bit:** `apps/diagram/src/spec/dialect/issues.ts:4` — `ArchIssueSeverity` widens
  the ui type with `"info"` for `zone-endpoint`.
- **Evidence:** `packages/ui/src/lib/definition/issues.ts:11` —
  `SpecIssueSeverity = "error" | "warning"`.
- **Proposed API:** add `"info"` to `SpecIssueSeverity` (it never makes `ok` false), and
  let `SpecPlaygroundError` carry the optional severity so the playground can show it.
