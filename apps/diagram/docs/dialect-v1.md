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
`docs`/`status` will be shown on the details card once DG-25 builds it (not yet); they are
never supplied by a reference (§2). Any unrecognized top-level, zone or node key is still
`unknown-prop` (a warning), as in v0.

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
diagram-ref  := "ws" ("/" segment)+           segment: any character except "/", "\", or a
                                              control character; never leading or trailing
                                              whitespace (the tree trims a name on create);
                                              not starting with "_" or "."; never exactly "."
                                              or ".."; the LAST segment (the file name) is
                                              written without ".yaml" or ".yml" — either is
                                              stripped from what you type, never rejected
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
- A value with a sequence YAML would misread — `: ` (colon-space, key syntax), ` #` (space
  then hash, a comment start — anywhere in the value, not only when leading; review round 1
  F4), or a leading quote — is written quoted by every writer in this app (`write-back.ts`'s
  `yamlScalar`); a plain path with spaces needs no quotes of its own.
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
  reference happens to supply). A scalar key left blank (`title:` with no value, or
  `title: ""`) counts as unwritten too (review round 1 N4) — the reference's value shows,
  same as when the key is absent. Writing `badges: []` on the node keeps it empty; an array is
  never "blank" the same way, so it is not "unwritten".
- `description` and `docs` are **not** in `SUPPLIED_KEYS`: they never land in the compiled
  node's data even when the node writes neither, so the drawing never changes shape. Review
  round 0 F2 — narrowed from an earlier draft of this section: today only the inspector's
  `SUPPLIED_KEYS` fields (title, subtitle, icon, type, badges) get the "From the reference: …"
  help text (§2.3, `1b.6`); `description` and `docs` are not filled into that form at all yet,
  and the details card does not read a reference's `description`/`docs` either — that is
  DG-25's own work, not yet built.

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
(`DIALECT_VERSION`). Any other value is `unsupported-version`. **A v0 file is never rewritten
by opening or saving it** (review round 0 F1, correcting an earlier draft of this section, and
review round 1 F4, correcting it again): the normalizer (`normalize.ts`) reads a `"0"` or `"1"`
file directly and draws either the same way — `upgradeText` is never called on open or save; it
runs only from the migration script below and from `#dev/spec-check`'s own round-trip
self-test. So a file's first line can still say `"0"` after a session in the app; only a script
writes to disk, and only when it is run on purpose. Two, mutually exclusive, script modes
migrate files on disk without opening them (`scripts/upgrade-workspace.mjs`):

```sh
# 0 → 1 syntax upgrade (upgradeText): in place, on every *.yaml under the target (default:
# workspace), skipping _trash. --dry-run reports without writing.
node scripts/upgrade-workspace.mjs [--dry-run] [file-or-folder …]

# Reference-first migration (refFirstText, 1b.9): once, over every *.yaml under the target
# (default: workspace), skipping _trash — the same walk as the plain upgrade above, not just
# the files choices names. choices shape: { "<workspace-relative path>": { "<node id>":
# "<catalog name>" | "catalog/<name>" | "custom" } } (either form of the name works). A node
# not named in a file's choices falls back to its own written icon as the catalog name to try,
# so a file with no entry in choices at all is still processed; "custom" (or an icon that is
# not a catalog name) leaves the node exactly as written. Never run together with a dialect
# upgrade.
node scripts/upgrade-workspace.mjs --ref-first --choices <file.json> [--dry-run] [file-or-folder …]
```

Both modes preserve every comment and the file's layout exactly except for the keys they
touch (`write-back.ts`'s source-map splice, never a YAML Document round-trip).

## 4. New issue codes

Same rules as v0 (`docs/dialect-v0.md` §10): severity decides `ok`; every code has a fixture;
position is the issue's start.

| Code                 | Severity | Message (template)                                                                                                                                                        | Fixture @ line:col                            |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `bad-ref`            | error    | One message per cause (`normalize.ts` `badRef()`, review round 0 F4) — see the list below.                                                                                | `issue-bad-ref.yaml` @ 5:10 through 25:10     |
| `ref-missing`        | error    | `No catalog item "<name>".` (+ `Did you mean "catalog/<near>"?` when one is close) · `"<name>" is an icon with no catalog item; write "icon: <name>" instead of the ref.` | `issue-ref-missing.yaml` @ 5:10 and 7:10      |
| `inner-flow`         | warning  | `Both ends are inside "<id>"; draw this flow in <ref> instead.`                                                                                                           | `issue-inner-flow.yaml` @ 7:5                 |
| `expand-not-diagram` | warning  | `"expand" applies only to a node whose ref names a diagram (ws/…); here it does nothing.` (on the key)                                                                    | `issue-expand-not-diagram.yaml` @ 5:5 and 8:5 |
| `ref-type-not-drawn` | info     | `"type: <value>" is kept, but a diagram reference always draws as one box for now.`                                                                                       | `issue-ref-type-not-drawn.yaml` @ 9:5         |

`bad-ref`'s exact message depends on why the path is not one of the two forms (§2.1); a
`suggestion` is set where the fix is unambiguous:

- No known root, but the shape of a bare `<pack>/<name>` pair: `"<ref>" needs a root: write
"catalog/<pack>/<name>" for a catalog item, or "ws/<pack>/<name>" for a diagram.` (suggests
  the catalog form.)
- The old `workspace/…` root: `"workspace" is not a reference root; the diagram form starts
with "ws": write "<suggestion>".` (suggests the `ws/` form.)
- The pre-amendment `components/…` root: `"<ref>" needs a root: write "<suggestion>" for a
diagram, or "catalog/<pack>/<entry>" for a catalog item.` (suggests the `ws/` form.)
- No root at all and no other shape matches: `"<ref>" needs a root: catalog/<pack>/<entry> for
a catalog item, or ws/<folder>/…/<file name> for another diagram.`
- `catalog/…` with the wrong shape: `"<ref>" is not a valid catalog reference: write
catalog/<pack>/<entry>, lowercase (catalog/aws/rds).` — when only the case is wrong, this
  suggests the lowercased form.
- `ws` with nothing after it: `"ws" needs at least one folder or file after "ws":
ws/<folder>/…/<file name>.`
- `ws/…` whose first bad segment is `_trash`: `"<ref>" is in the trash; restore the diagram
before referencing it.`
- `ws/…` whose first bad segment is empty or blank: `"<ref>" has an empty or blank folder/file
name; a reference cannot skip a segment.`
- `ws/…` whose first bad segment is exactly `.` or `..`: `"<ref>" has a "<segment>" segment; a
reference names an exact path, never "." or "..".`
- `ws/…` whose first bad segment starts with `_` (not `_trash`): `"<ref>" names "<name>", which
starts with "_" (reserved, like _trash); a reference cannot use it.`
- `ws/…` whose first bad segment starts with `.`: `"<ref>" names "<name>", which starts with
"." (hidden); a reference cannot use it.`
- `ws/…` whose first bad segment has a character the grammar refuses (`\`, a control
  character): `"<ref>" names "<name>", which has a character the workspace does not accept in
a name.`

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
