# Architecture diagram dialect v0 — reference

The YAML an author (or an LLM) writes to describe an architecture diagram. Source of the rules:
plan §4 (`2026-09-26-plan.md`), decisions D1, D11, D12 and §11. Code: `src/spec/dialect/`
(React-free). Fixtures: `src/spec/dialect/__fixtures__/`, checked live at `#spec-check`.

## 1. Overview

**Two layers (plan D1).** This dialect is the architecture layer: it knows zones, owners,
providers, icon names and the `a -> b: label` sugar. A later step (DG-10) compiles it into the
generic FlowSpec v1, which then becomes React Flow nodes and edges. The dialect never carries
code: every value is data.

**Pipeline.** `checkArchYaml(text, iconNames)` (`index.ts`) runs three stages and returns
`{ ast, issues, ok }`:

1. `parseArchYaml` (`parse.ts`) — the `yaml` package parses the text, keeping every value's
   and key's source offsets (the source map). YAML errors stop here.
2. `normalizeArch` (`normalize.ts`) — field checks against the entity definitions (ui
   definition base), sugar expansion (flow shorthand, `children:` → `parent`), defaults.
3. `validateArch` (`validate.ts`) — cross-reference checks (ids, parents, endpoints, classes,
   icons, providers, notes).

Every issue has a `path` (`zones[0].children[1].id`), a `code`, a `message`, a `severity`
(`error`, `warning`, `info`) and a 1-based `range` (Monaco-ready). `ok` is `false` when any
issue is an `error`. `ast` is `null` only when the text is not a diagram at all (YAML error,
no `diagram:` key, wrong version).

**The file.** Line 1 is the schema modeline, so any editor with the YAML language server gets
autocomplete and structural checks; then `diagram: "0"`:

```yaml
# yaml-language-server: $schema=./schema/arch-diagram.v0.schema.json
diagram: "0"
title: Qlik Cloud with a customer-hosted Data Gateway
zones:
  - id: customer
    owner: customer
    children:
      - id: gateway
        icon: qlik/data-gateway
nodes:
  - id: users
    type: actor
flows:
  - users -> gateway: SSO
```

The modeline path is relative to the YAML file (the fixtures use
`../../../../schema/arch-diagram.v0.schema.json`).

## 2. Top level

| Key         | Type                             | Allowed values                                              | Default                  | Example                                 |
| ----------- | -------------------------------- | ----------------------------------------------------------- | ------------------------ | --------------------------------------- |
| `diagram`   | string (the number `0` accepted) | `"0"`                                                       | required                 | `diagram: "0"`                          |
| `title`     | string                           | any                                                         | none                     | `title: Lakehouse on AWS`               |
| `direction` | enum                             | `LR`, `TB` (the ELK direction)                              | `LR`                     | `direction: TB`                         |
| `nodeStyle` | enum                             | `icon`, `card` — the default node `variant` (D5)            | `icon`                   | `nodeStyle: card`                       |
| `theme`     | string                           | a brand theme family, e.g. `qlik`, `snowflake`              | none (the default theme) | `theme: qlik`                           |
| `legend`    | enum or list                     | `auto`, `none`, or a list of `owners`, `providers`, `edges` | `auto`                   | `legend: [owners, edges]`               |
| `layout`    | enum                             | `auto`, `manual` (see §9)                                   | `auto`                   | `layout: manual`                        |
| `zones`     | list of zones (§3)               | nested with `children:`                                     | empty                    | `zones: [{ id: vpc, owner: customer }]` |
| `nodes`     | list of nodes (§4)               | items outside every zone (external systems, end users)      | empty                    | `nodes: [{ id: users, type: actor }]`   |
| `flows`     | list of flows (§5)               | three written forms                                         | empty                    | `flows: [a -> b]`                       |
| `styles`    | map: class name → style (§6)     | any class name                                              | empty                    | `styles: { pii: { tone: warning } }`    |
| `notes`     | list of notes (§7)               | `{ at, text }`                                              | empty                    | `notes: [{ at: gateway, text: Hi }]`    |

Any other top-level key is an `unknown-prop` warning.

## 3. Zones

A zone is a boundary: an account, a region, a network, a cluster, a trust boundary. Zones are
typed on three independent axes (plan D3): topology `kind` × `owner` × `provider`.

| Key           | Type            | Allowed values                                                                                               | Default                           | Example                           |
| ------------- | --------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------- | --------------------------------- |
| `id`          | string (§8)     | the id grammar                                                                                               | required                          | `id: vpc`                         |
| `kind`        | enum            | `cloud-account`, `region`, `vnet`, `subnet`, `cluster`, `on-prem`, `datacenter`, `trust-boundary`, `generic` | `generic`                         | `kind: vnet`                      |
| `owner`       | enum            | `customer`, `saas`, `hosted`, `partner`                                                                      | nested: inherited; top: see below | `owner: saas`                     |
| `provider`    | string          | an icon pack prefix (`aws`, `azure`, `qlik`, …)                                                              | none                              | `provider: azure`                 |
| `title`       | string          | any                                                                                                          | the `id`                          | `title: Azure subscription`       |
| `subtitle`    | string          | any                                                                                                          | none                              | `subtitle: West Europe`           |
| `description` | string          | any (hover and inspector only)                                                                               | none                              | `description: Prod only`          |
| `icon`        | string          | an icon name `vendor/name`                                                                                   | none                              | `icon: aws/virtual-private-cloud` |
| `class`       | list of strings | names under `styles:`                                                                                        | none                              | `class: [pii]`                    |
| `collapsed`   | boolean         | `true`, `false`                                                                                              | `false`                           | `collapsed: true`                 |
| `direction`   | enum            | `LR`, `TB` — this zone's own layout direction                                                                | the diagram's `direction`         | `direction: TB`                   |
| `parent`      | string          | the id of a zone (alternative to nesting)                                                                    | none                              | `parent: acct`                    |
| `position`    | `{ x, y }`      | numbers; only under `layout: manual` (§9)                                                                    | none                              | `position: { x: 0, y: 0 }`        |
| `children`    | list            | zones and nodes                                                                                              | empty                             | see below                         |

**Owner.** A nested zone without `owner:` inherits its enclosing zone's owner (resolved when
the diagram is compiled, DG-10; the AST leaves it absent). A **top-level** zone — one with no
parent, by nesting or by `parent:` — without an owner gets a `missing-owner` warning and is
drawn as `customer`.

**Nesting (plan D11).** `children:` is the primary form; `parent:` is accepted. Both give the
same AST (the fixtures `valid-nesting-children.yaml` and `valid-nesting-parent.yaml` are
compared at `#spec-check`):

`children:` (nested)

```yaml
zones:
  - id: vpc
    kind: vnet
    children:
      - id: subnet
        kind: subnet
        children:
          - id: api
            title: API
```

`parent:` (flat)

```yaml
zones:
  - id: vpc
    kind: vnet
  - id: subnet
    kind: subnet
    parent: vpc
nodes:
  - id: api
    title: API
    parent: subnet
```

**Zone or node inside `children:`.** Top-level `zones:` entries are always zones, top-level
`nodes:` entries are always nodes. Inside `children:` an entry is a **zone** if it has any
zone-only key (`kind`, `owner`, `provider`, `collapsed`, `direction`, `children`), otherwise
a **node**. An entry with both zone-only and node-only keys (`type`, `variant`, `badges`,
`tone`, `href`, `text`) is an `ambiguous-entry` error. Writing both `children:` nesting and a
different `parent:` on the same entry is a `parent-conflict` error.

## 4. Nodes

| Key           | Type            | Allowed values                                               | Default                   | Example                      |
| ------------- | --------------- | ------------------------------------------------------------ | ------------------------- | ---------------------------- |
| `id`          | string (§8)     | the id grammar                                               | required                  | `id: api`                    |
| `type`        | enum            | `service`, `actor`, `datastore`, `queue`, `external`, `note` | `service`                 | `type: datastore`            |
| `variant`     | enum            | `icon`, `card`                                               | the diagram's `nodeStyle` | `variant: card`              |
| `title`       | string          | any                                                          | the `id`                  | `title: SAP S/4HANA`         |
| `subtitle`    | string          | any                                                          | none                      | `subtitle: ERP`              |
| `description` | string          | any (hover and inspector only)                               | none                      | `description: Primary ERP`   |
| `icon`        | string          | an icon name `vendor/name`, or `lucide/<name>`               | the type's icon           | `icon: sap/s4hana`           |
| `badges`      | list of strings | any                                                          | none                      | `badges: [pii]`              |
| `class`       | list of strings | names under `styles:`                                        | none                      | `class: [pii]`               |
| `tone`        | enum            | `neutral`, `info`, `success`, `warning`, `destructive`       | none                      | `tone: warning`              |
| `href`        | string          | a URL                                                        | none                      | `href: https://example.com`  |
| `text`        | string          | the body text of a `note` node                               | none                      | `text: Outbound only`        |
| `parent`      | string          | the id of a zone (alternative to nesting)                    | none                      | `parent: subnet`             |
| `position`    | `{ x, y }`      | numbers; only under `layout: manual` (§9)                    | none                      | `position: { x: 40, y: 60 }` |

An `external` node usually lives outside every zone; inside one it gets an `external-in-zone`
warning. An icon name the app cannot draw is an `unknown-icon` warning (the node falls back to
its type icon).

## 5. Flows

A flow is a directed edge between two nodes or zones (a zone endpoint attaches to the zone's
border, reported as `zone-endpoint`, info).

| Key         | Type            | Allowed values                                       | Default                                | Example            |
| ----------- | --------------- | ---------------------------------------------------- | -------------------------------------- | ------------------ |
| `from`      | string          | a node or zone id                                    | required (or in the arrow)             | `from: erp`        |
| `to`        | string          | a node or zone id                                    | required (or in the arrow)             | `to: gateway`      |
| `direction` | enum            | `forward`, `back`, `both` — where the arrowhead sits | `forward`                              | `direction: both`  |
| `label`     | string          | any                                                  | none                                   | `label: CDC`       |
| `kind`      | enum            | `data`, `request`, `access`, `control`, `network`    | `data`                                 | `kind: access`     |
| `style`     | enum            | `solid`, `dashed`, `dotted`                          | `solid` (`dotted` for `kind: control`) | `style: dashed`    |
| `animated`  | boolean         | `true`, `false`                                      | `false`                                | `animated: true`   |
| `secure`    | enum            | `tls`, `vpn`, `private-link`, `sso`, `none`          | none                                   | `secure: tls`      |
| `protocol`  | string          | a mono badge, e.g. `HTTPS 443`, `JDBC`, `Kafka`      | none                                   | `protocol: JDBC`   |
| `schedule`  | string          | e.g. `real-time`, `hourly`, `nightly batch`          | none                                   | `schedule: hourly` |
| `step`      | integer         | 1 or more — numbers a walkthrough                    | none                                   | `step: 3`          |
| `class`     | list of strings | names under `styles:`                                | none                                   | `class: [pii]`     |

**Three written forms**, side by side with the object each expands to (the AST records which
form was used, so a write-back keeps it):

| Written                                       | Form        | Expands to                                                       |
| --------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `- erp -> gateway`                            | `string`    | `{ from: erp, to: gateway, direction: forward }`                 |
| `- qca <- users`                              | `string`    | `{ from: qca, to: users, direction: back }`                      |
| `- qca <-> qtdi`                              | `string`    | `{ from: qca, to: qtdi, direction: both }`                       |
| `- erp -> gateway: CDC`                       | `shorthand` | `{ from: erp, to: gateway, direction: forward, label: CDC }`     |
| `- a <- b: { kind: access, secure: sso }`     | `shorthand` | `{ from: a, to: b, direction: back, kind: access, secure: sso }` |
| `- { from: a, to: b, label: Nightly export }` | `object`    | itself                                                           |

- `a <- b` keeps the written order (`from: a`, `to: b`) and only flips the arrowhead
  (`direction: back`); layout follows the text order (plan §11).
- The shorthand's value is a label (a string, number or boolean), a mapping of flow keys, or
  empty. The mapping must not repeat `from`, `to` or `direction` — the arrow already names
  them (`bad-flow`).
- Spaces around the arrow are optional; both ends follow the id grammar (§8). Anything else
  (`a => b`) is `bad-flow`.

## 6. Styles and classes

`styles:` defines reusable classes; `class:` on a zone, node or flow applies them.

| Key     | Type   | Allowed values                                         | Default | Example         |
| ------- | ------ | ------------------------------------------------------ | ------- | --------------- |
| `tone`  | enum   | `neutral`, `info`, `success`, `warning`, `destructive` | none    | `tone: warning` |
| `badge` | string | a short badge text                                     | none    | `badge: PII`    |

```yaml
styles:
  pii: { tone: warning, badge: PII }
nodes:
  - id: mssql
    class: [pii]
```

A class name with no entry under `styles:` is an `unknown-class` warning.

## 7. Notes

| Key    | Type   | Allowed values    | Default  | Example                   |
| ------ | ------ | ----------------- | -------- | ------------------------- |
| `at`   | string | a node or zone id | required | `at: gateway`             |
| `text` | string | the note's text   | required | `text: No inbound ports.` |

A note whose `at` names no node or zone is an `unknown-note-target` error.

## 8. Ids

- Grammar (`ids.ts` `ID_SOURCE`): `[A-Za-z_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?` — a letter or
  `_` first, then letters, digits, `_` and `-`; never ends in `-`. `my api` or `-x` is a
  `bad-id` error.
- **One id space** for zones and nodes: the same id twice (a zone and a node included) is a
  `duplicate-id` error. Flow endpoints, `parent:` and note targets all refer to this space.

## 9. Positions

`position: { x, y }` (top-left, numbers) exists only under `layout: manual` (plan L158): with
`layout: auto` (the default) the validator reports `position-without-manual` (an error, on the
`position` key) and the JSON Schema rejects the file, so auto and manual layout never mix
silently. Under `layout: manual` both zones and nodes may carry a position; a zone's size still
comes from its children (DG-06 auto-fit).

## 10. Issue codes

Severity decides `ok` (`false` if any `error`). Every code has a fixture under
`src/spec/dialect/__fixtures__/`; the position is the issue's start (1-based line:col).

| Code                      | Severity | Message (template)                                                                                                                                                                                                                      | Fixture @ line:col                         |
| ------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `yaml-syntax`             | error    | yaml's first message line without "at line …", plus "." — e.g. `Missing closing "quote.`                                                                                                                                                | `issue-yaml-syntax.yaml.txt` @ 5:1         |
| `yaml-duplicate-key`      | error    | `Map keys must be unique.`                                                                                                                                                                                                              | `issue-yaml-duplicate-key.yaml.txt` @ 4:1  |
| `yaml-warning`            | warning  | yaml's message — e.g. `Unresolved tag: !shout.`                                                                                                                                                                                         | `issue-yaml-warning.yaml` @ 3:8            |
| `not-a-diagram`           | error    | `This is not an architecture diagram: the file needs a top-level mapping that starts with diagram: "0".`                                                                                                                                | `issue-not-a-diagram.yaml` @ 2:1           |
| `unsupported-version`     | error    | `diagram: <value as JSON> is not supported; this app reads dialect "0".`                                                                                                                                                                | `issue-unsupported-version.yaml` @ 2:10    |
| `unknown-prop`            | warning  | `"<key>" is not a prop of <Diagram \| Zone \| Node \| Flow \| Style>.` (on the key)                                                                                                                                                     | `issue-unknown-prop.yaml` @ 3:1            |
| `wrong-type`              | error    | `"<path>" must be <a string \| a number \| true or false \| …>.`                                                                                                                                                                        | `issue-wrong-type.yaml` @ 5:12             |
| `not-in-enum`             | error    | `"<path>" must be one of "LR", "TB".` (the field's values)                                                                                                                                                                              | `issue-not-in-enum.yaml` @ 3:12            |
| `missing-prop`            | error    | `"<path>" is required.`                                                                                                                                                                                                                 | `issue-missing-prop.yaml` @ 4:5            |
| `out-of-range`            | error    | `"<path>" must have a value at least 1.`                                                                                                                                                                                                | `issue-out-of-range.yaml` @ 7:29           |
| `bad-id`                  | error    | `"<id>" is not a valid id: use letters, digits, _ and -, starting with a letter or _.`                                                                                                                                                  | `issue-bad-id.yaml` @ 4:9                  |
| `ambiguous-entry`         | error    | `This entry mixes zone keys (<keys>) and node keys (<keys>); split it into a zone and a node.`                                                                                                                                          | `issue-ambiguous-entry.yaml` @ 6:9         |
| `parent-conflict`         | error    | `"<id>" is nested in "<zone>" but says parent: <other>; remove one of the two.`                                                                                                                                                         | `issue-parent-conflict.yaml` @ 7:17        |
| `bad-flow`                | error    | `Flow "<text>" is not "a -> b"; ids use letters, digits, _ and -.` · `The shorthand "<key>" already names both ends; remove from, to and direction from its value.` · `The value of "<key>" must be a label or a mapping of flow keys.` | `issue-bad-flow.yaml` @ 7:5                |
| `duplicate-id`            | error    | `The id "<id>" is used twice; ids must be unique.`                                                                                                                                                                                      | `issue-duplicate-id.yaml` @ 6:9            |
| `unknown-parent`          | error    | `No zone has the id "<id>".`                                                                                                                                                                                                            | `issue-unknown-parent.yaml` @ 5:13         |
| `parent-not-zone`         | error    | `"<id>" is a node; parent must name a zone.`                                                                                                                                                                                            | `issue-parent-not-zone.yaml` @ 6:13        |
| `parent-cycle`            | error    | `Zone "<id>" ends up inside itself through parent:.` (one per zone on the cycle)                                                                                                                                                        | `issue-parent-cycle.yaml` @ 5:13 and 7:13  |
| `external-in-zone`        | warning  | `"<id>" is external but sits inside zone "<zone>"; external nodes usually live outside every zone.`                                                                                                                                     | `issue-external-in-zone.yaml` @ 6:9        |
| `missing-owner`           | warning  | `Zone "<id>" has no owner; it is drawn as customer.` (top-level zones only)                                                                                                                                                             | `issue-missing-owner.yaml` @ 4:9           |
| `position-without-manual` | error    | `position: is only read under layout: manual; remove it or set layout: manual.` (on the key)                                                                                                                                            | `issue-position-without-manual.yaml` @ 5:5 |
| `unknown-endpoint`        | error    | `No node or zone has the id "<id>".` (on the id, inside `a -> b` too)                                                                                                                                                                   | `issue-unknown-endpoint.yaml` @ 6:10       |
| `zone-endpoint`           | info     | `"<id>" is a zone; the edge attaches to the zone's border.`                                                                                                                                                                             | `issue-zone-endpoint.yaml` @ 11:14         |
| `duplicate-step`          | warning  | `step: <n> is also used by <from> -> <to>; steps number a walkthrough and should be unique.`                                                                                                                                            | `issue-duplicate-step.yaml` @ 8:21         |
| `unknown-class`           | warning  | `No style named "<name>" under styles:.`                                                                                                                                                                                                | `issue-unknown-class.yaml` @ 5:13          |
| `unknown-icon`            | warning  | `No icon named "<name>"; the node falls back to its type icon.`                                                                                                                                                                         | `issue-unknown-icon.yaml` @ 5:11           |
| `unknown-provider`        | warning  | `No icon pack named "<name>"; the zone shows no provider logo.`                                                                                                                                                                         | `issue-unknown-provider.yaml` @ 5:15       |
| `unknown-note-target`     | error    | `No node or zone has the id "<id>".`                                                                                                                                                                                                    | `issue-unknown-note-target.yaml` @ 6:9     |

A value with an error is not copied into the AST, so one bad value never cascades into
`unknown-endpoint` and friends.

## 11. Schema

`schema/arch-diagram.v0.schema.json` (JSON Schema draft 2020-12) describes the **authoring**
form. It is generated — never edit it by hand. Regenerate after changing
`src/spec/dialect/definitions.ts`, `ids.ts` or `schema.ts`:

```sh
pnpm --filter @elabs-ai/diagram schema:build
# → arch-diagram.v0.schema.json: 8 $defs (then Prettier formats the file)
```

Entity fragments come from the ui definition base (`toJsonSchema`); recursion (`children:`),
the flow shorthand, the `styles:` map, the id pattern and the `position` rule are added by hand
in `schema.ts` (library gaps, `docs/findings/DG-09-definition-gaps.md`).

Check it with an external validator (no app dependency; `pnpm dlx` fetches ajv-cli), from
`apps/diagram`:

```sh
pnpm dlx ajv-cli@5 validate --spec=draft2020 --strict=true -s schema/arch-diagram.v0.schema.json -d "src/spec/dialect/__fixtures__/valid-*.yaml"
```

Every `valid-*.yaml` prints `… valid`. The schema checks structure only: the structural
`issue-*` fixtures (for example `issue-position-without-manual.yaml`, `issue-bad-flow.yaml`,
`issue-unknown-prop.yaml`) are schema-invalid, while cross-reference fixtures such as
`issue-unknown-endpoint.yaml` are schema-valid by design — those are the validator's job.
