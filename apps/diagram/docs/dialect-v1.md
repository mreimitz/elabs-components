# Architecture diagram dialect v1 — reference

Dialect v1 is v0 (`docs/dialect-v0.md`, which stays frozen as written) plus a handful of new
keys, all under DG-26: `component` / `story` / `visual` at the root, `docs` / `status` on a
zone or node, and `ref` / `expand` on a node. This file documents only the delta; for the
pipeline, the zones/nodes/flows/styles/notes keys, ids and positions unchanged from v0, read
`docs/dialect-v0.md` first. Code: `src/spec/dialect/` (React-free). Fixtures:
`src/spec/dialect/__fixtures__/`, checked live at `#dev/spec-check`.

## 1. What v1 adds

| Key         | Where      | Type                                        | Default | Example                                 |
| ----------- | ---------- | ------------------------------------------- | ------- | --------------------------------------- |
| `component` | root       | `{ icon?, description?, extensionPoints? }` | none    | `component: { description: A tenant. }` |
| `story`     | root       | open object (DG-31 defines it)              | none    | `story: {}`                             |
| `visual`    | root       | open object (DG-36 defines it)              | none    | `visual: {}`                            |
| `docs`      | zone, node | string (a URL)                              | none    | `docs: https://cloud.qlik.com/docs`     |
| `status`    | zone, node | enum: `ok`, `degraded`, `down`, `planned`   | none    | `status: degraded`                      |
| `ref`       | node       | string, a reference path (§2)               | none    | `ref: catalog/aws/rds`                  |
| `expand`    | node       | boolean; only on a diagram reference        | `false` | `expand: true`                          |

`component` marks and describes a diagram meant to be referenced by another one (its icon and
one-sentence description, shown where the reference collapses). `story` and `visual` are
carried but not yet read by anything in R1 — later items (DG-31, DG-36) define their shape.
`docs`/`status` are shown on the details card (DG-25); they are never supplied by a reference
(§2). Any unrecognized top-level, zone or node key is still `unknown-prop` (a warning), as
in v0.

## 2. References

`ref:` is a node key holding one path. A zone cannot carry one — writing `ref:` on an entry
that also has a zone-only key (`kind`, `owner`, `provider`, `collapsed`, `direction`,
`children`) is `ambiguous-entry`, same as any other zone/node key clash. A node without `ref:`
is a custom node and stays valid — reference-first is a convention this app writes to, not a
requirement it enforces on every node (stand-ins with no matching catalog item, and nodes with
none, are meant to stay custom).

### 2.1 The two forms

```
ref          := catalog-ref | diagram-ref
catalog-ref  := "catalog/" pack "/" entry     pack, entry: [a-z0-9][a-z0-9-]*
diagram-ref  := "ws" ("/" segment)+           segment: any characters except "/", not starting
                                              with "_" or ".", never exactly "." or "..";
                                              the LAST segment (the file name) is written
                                              without ".yaml" or ".yml" — either is stripped
                                              from what you type, never rejected
```

- The first segment decides the form: `catalog/…` names a catalog item; `ws/…` names another
  diagram in this workspace (the literal word `ws`, never `workspace`). Anything else — no
  known root, a bare file name, a name ending `.yaml`/`.yml` on a _catalog_ ref — is `bad-ref`.
- `catalog/<pack>/<entry>` names a `CatalogRefEntry` by its `name` (`catalog/aws/glue` →
  `aws/glue`): an icon entry or a part. `catalog/lucide/*` is never a valid catalog reference —
  a Lucide glyph is an icon, not a catalog item (Ruling 7); write `icon: lucide/<name>` on a
  custom node instead. `catalog_search`/`catalog_get` (MCP) and the catalog entry pages give
  the exact name to write.
- `ws/<folder>/…/<file name>` names the file `<folder>/…/<file name>.yaml` in the one local
  workspace (`ws/components/qlik-cloud-tenant` → `components/qlik-cloud-tenant.yaml`). Any
  folder and any file name the workspace tree itself accepts works here too — spaces,
  capitals, punctuation, unicode all fine (`ws/Demo Banking/landscape`). The last segment is
  the file **name**, not the diagram's `title:`.
- A value with a character YAML reads specially (`: `, a leading `#`, a leading quote) is
  written quoted by every writer in this app (`write-back.ts`'s `yamlScalar`); a plain path
  with spaces needs no quotes of its own.
- **Not referenceable in R1:** a `.yml`-extensioned file (the tree lists it, but a `ws/` path
  always resolves to `.yaml`), a dotfile (the tree hides dotfiles), anything under the root
  `_trash` folder (a leading `_` segment is rejected). A `.` or `..` segment (a relative path)
  is rejected outright, not stripped.

### 2.2 Precedence: what a reference supplies

The node's own written key always wins. Below it, only a catalog reference fills anything in
R1 (a diagram reference's title/icon land in Part 2 — see §2.4):

| Key                                               | Catalog part supplies                                                                          | Catalog icon entry supplies                                        | Node default (no ref, or ref fills nothing) |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| `title`                                           | the part's name, else its slug                                                                 | the vendor file's `name`, else the icon index label, else the slug | the node's `id`                             |
| `subtitle`                                        | the part's own `subtitle`                                                                      | none                                                               | none                                        |
| `icon`                                            | the part's own `icon`                                                                          | its own `icon`                                                     | the type's glyph, at render                 |
| `type`                                            | the part's own `kind`, else its icon entry's                                                   | its own `kind` (no vendor file sets one today)                     | `service`                                   |
| `badges`                                          | the part's own `badges`                                                                        | none                                                               | none                                        |
| `description`, `docs`                             | shown by the reader (`suppliedBy`, DG-25) when the node writes none — never copied into `data` | (same)                                                             | none                                        |
| `tone`, `href`, `class`, `text`, `docs`, `status` | never supplied                                                                                 | never supplied                                                     | none                                        |

- `title`, `subtitle`, `icon`, `type` and `badges` (`SUPPLIED_KEYS`) are filled into the AST
  before validation — only for the keys the node's text does not already have
  (`node.unwritten`, recorded by the normalizer from the raw entry, not from what the
  reference happens to supply). Writing `badges: []` on the node keeps it empty; it is not
  "unwritten".
- `description` and `docs` are **not** in `SUPPLIED_KEYS`: they never land in the compiled
  node's data even when the node writes neither. The inspector and the details card read them
  from `data.catalogEntry` through `suppliedBy()` instead, so the drawing never changes shape
  and the UI can say "From the reference: …" (§2.3, and `1b.6`).

### 2.3 Catalog references (built in Part 1b)

A node whose `ref` is a catalog path is an ordinary node once resolved: `resolveCatalogRefs`
fills its unwritten `SUPPLIED_KEYS` and sets `catalogEntry` to the entry's name, before
validation runs. A thin catalog entry supplies little — `ref: catalog/aws/rds` alone is
titled "Rds" (the icon index's label) until the catalog fill loop gives the entry a real
`name:`. A name the catalog does not have is `ref-missing`, with a "Did you mean …" suggestion
from the nearest known name when one is close enough.

The browser compiles against whatever catalog it has: the **bundled** catalog (built into the
app from `catalog/*.yaml` and `catalog/parts/*.yaml` at build time — the same merge the dev
server's `/api/catalog/all` computes) until the live catalog loads, then the live one. A live
catalog edit recompiles the open diagram without touching its text, undo history or dirty
flag. The MCP tools check against `readAll()` read fresh on every call, never a cache.

### 2.4 Diagram references (partial; Part 2 completes this)

A node whose `ref` is a `ws/` path compiles to one `arch/composite` node (an interim look;
`ServiceNode` today, DG-27 replaces it): its own written keys, `component` (the referenced
file's path), and `ports` (the inner ids this diagram's flows name into it, in first-use
order). **Known gap:** the referenced diagram's own title, icon and description are not yet
copied in when the node writes none — that fill, `count`, and a `broken`/`pending` state for a
missing or unreadable file, are Part 2. A `type` written on a diagram reference is kept in the
AST but not drawn in R1 (the composite's data carries no type) — also left until DG-27.

**Dotted flow ends (already built, 1a).** A flow end is either a plain id, or `<node>.<inner
id>` reaching inside a node whose `ref` is a diagram (`tenant.qtdi -> warehouse`). The head
before the first dot must be a node whose ref is a diagram reference, or the end is
`unknown-endpoint`. Both ends inside the same reference is `inner-flow` (a warning: it would
be a loop on the collapsed box, so it is not drawn). A note's `at:` never reaches inside a
reference — a dotted target there is `unknown-note-target`.

## 3. The version rule

`diagram:` reads `"0"` and `"1"` (`READ_VERSIONS`); this app always **writes** `"1"`
(`DIALECT_VERSION`) — opening and saving a v0 file upgrades it in place. Any other value is
`unsupported-version`. Two, mutually exclusive, script modes migrate files on disk without
opening them (`scripts/upgrade-workspace.mjs`):

```sh
# 0 → 1 syntax upgrade (upgradeText): in place, on every *.yaml under the target (default:
# workspace), skipping _trash. --dry-run reports without writing.
node scripts/upgrade-workspace.mjs [--dry-run] [file-or-folder …]

# Reference-first migration (refFirstText, 1b.9): once, over exactly the files named in
# --choices. choices shape: { "<workspace-relative path>": { "<node id>": "<catalog name>" |
# "custom" } }. A node not named in a file's choices defaults to its own written icon as the
# catalog name to try; "custom" (or no matching catalog entry) leaves the node exactly as
# written. Never run together with a dialect upgrade.
node scripts/upgrade-workspace.mjs --ref-first --choices <file.json> [--dry-run] [file-or-folder …]
```

Both modes preserve every comment and the file's layout exactly except for the keys they
touch (`write-back.ts`'s source-map splice, never a YAML Document round-trip).

## 4. New issue codes

Same rules as v0 (`docs/dialect-v0.md` §10): severity decides `ok`; every code has a fixture;
position is the issue's start.

| Code                 | Severity | Message (template)                                                                                                                                                                                                                                                                                                                          | Fixture @ line:col                            |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `bad-ref`            | error    | `"<ref>" names a file; write the path without ".yaml".` · `"<ref>" needs a root: catalog/<pack>/<entry> for a catalog item, or ws/<folder>/<file name> for another diagram.` · `"<ref>" is not a reference path: write catalog/<pack>/<entry> in lowercase (catalog/aws/rds) or ws/<folder>/<file name> (ws/components/qlik-cloud-tenant).` | `issue-bad-ref.yaml` @ 5:10 and 7:10          |
| `ref-missing`        | error    | `No catalog item "<name>".` (+ `Did you mean "catalog/<near>"?` when one is close) · `"<name>" is an icon with no catalog item; write "icon: <name>" instead of the ref.`                                                                                                                                                                   | `issue-ref-missing.yaml` @ 5:10 and 7:10      |
| `inner-flow`         | warning  | `Both ends are inside "<id>"; draw this flow in <ref> instead.`                                                                                                                                                                                                                                                                             | `issue-inner-flow.yaml` @ 7:5                 |
| `expand-not-diagram` | warning  | `"expand" applies only to a node whose ref names a diagram (ws/…); here it does nothing.` (on the key)                                                                                                                                                                                                                                      | `issue-expand-not-diagram.yaml` @ 5:5 and 8:5 |

`unsupported-version`'s message changed with v1: `Dialect <value as JSON> is not supported;
this app reads dialects "0" and "1".` A `ref` on a zone-only entry is reported as
`ambiguous-entry`, not a new code (`issue-ref-in-zones.yaml` @ 4:5): `"ref" makes this entry a
node; move it to "nodes:" or into a zone's "children".`

A value with an error is not copied into the AST, exactly as in v0 — a bad `ref` never
cascades into `ref-missing` on the same node.

## 5. Schema

`schema/arch-diagram.v1.schema.json` is generated the same way as v0's, from the same source
(never hand-edit it):

```sh
pnpm --filter @elabs-ai/diagram schema:build
```

`ref`, `expand`, `docs`, `status`, `component`, `story` and `visual` all appear as ordinary
fields of the existing zone/node/root `$defs` — no new recursion or hand-written fragment was
needed for them (`schema.ts`'s hand-added pieces are still only `children:`, the flow
shorthand, the `styles:` map, the id pattern and the `position` rule, as in v0).

## 6. Cut, for now

`phase`, `metrics`, `volume` and the top-level `phases:` list (success-plan "Cut / deferred")
are not part of v1: they belong to live-ops status drawn on the canvas, owned by DG-33
(out of R1). `phases:` was cut together with `phase` because it only labels `phase` values.
Rename refactoring — rewriting a `ref:` path when the file it names moves — is also cut for
R1; `diagram_move`/`diagram_trash` do not touch any other file's `ref:` text.
