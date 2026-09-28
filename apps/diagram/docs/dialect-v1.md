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
`docs` and `status` appear in node details. Status is authored on the node; catalog references
can supply description and documentation when those fields are unwritten (§2.2). The details
reader resolves that catalog metadata without adding fields to the source YAML. Any
unrecognized top-level, zone or node key is still `unknown-prop` (a warning), as in v0.

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
  then hash, a comment start anywhere in the value, not only when leading), or a leading quote
  — is written quoted by every writer in this app (`write-back.ts`'s `yamlScalar`); a plain
  path with spaces needs no quotes of its own.
- **Not referenceable in R1:** a `.yml`-extensioned file (the tree lists it, but a `ws/` path
  always resolves to `.yaml`), a dotfile (the tree hides dotfiles), anything under the root
  `_trash` folder (a leading `_` segment is rejected). A `.` or `..` segment (a relative path)
  is rejected outright, not stripped.

### 2.2 Precedence: what a reference supplies

The node's own written key always wins. Catalog reference values follow these precedence
rules; diagram references are described in §2.4:

| Key                                       | Catalog part supplies                               | Catalog icon entry supplies                                        | Node default (no ref, or ref fills nothing) |
| ----------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| `title`                                   | the part's name, else its slug                      | the vendor file's `name`, else the icon index label, else the slug | the node's `id`                             |
| `subtitle`                                | the part's own `subtitle`                           | none                                                               | none                                        |
| `icon`                                    | the part's own `icon`                               | its own `icon`                                                     | the type's glyph, at render                 |
| `type`                                    | the part's own `kind`, else its icon entry's        | its own `kind`                                                     | `service`                                   |
| `badges`                                  | the part's own `badges`                             | none                                                               | none                                        |
| `description`, `docs`                     | the part's metadata, falling back to its icon entry | the entry's metadata, read by node details                         | none                                        |
| `tone`, `href`, `class`, `text`, `status` | never supplied                                      | never supplied                                                     | none                                        |

- `title`, `subtitle`, `icon`, `type` and `badges` (`SUPPLIED_KEYS`) are filled into the AST
  before validation — only for the keys the node's text does not already have
  (`node.unwritten`, recorded by the normalizer from the raw entry via `isSuppliedKeyWritten`,
  not from what the reference happens to supply). A key left with no value at all (`title:`,
  YAML null) counts as unwritten for reference resolution, but still produces a `wrong-type`
  diagnostic; omit the key to inherit without a diagnostic. An explicit empty value
  (`subtitle: ""`) is a written override instead: it draws nothing, the same as `badges: []` —
  neither ever falls back to the reference's value. `type: ""` is a `not-in-enum` error;
  `icon: ""` warns `unknown-icon` and uses the type glyph.
- `description` and `docs` are **not** in `SUPPLIED_KEYS`. Authored values stay in compiled
  data; node details reads the catalog fallback for unwritten values. An explicit empty
  description or documentation value suppresses that fallback. Documentation links allow
  only safe URLs. The inspector's supplied text/list fields show "From the reference: …"
  help while inherited.
  Type offers a "From the reference: …" option even after an override; choosing it removes
  the written key. **Clear subtitle**, or clearing a subtitle after editing, writes `subtitle: ""`;
  **Use reference subtitle** removes that override. Help updates while editing without
  remounting fields or closing portaled menus. Description and documentation inheritance is
  shown by node details; it is not written into the inspector form or YAML.

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

### 2.4 Diagram references

A `ws/` reference resolves the named workspace YAML before its first draw. By default it is
one collapsed `arch/composite` node. The referenced diagram supplies its title, `component.icon`,
and `component.description` (falling back to its top-level description); explicitly written
node values win, including an empty description. The compiled data includes the referenced
file path, inner node count, and the inner ids used by parent flows. Its stacked card shows
the referenced kind/product mark, node count and named endpoints. An explicit `type:` chooses
the collapsed mark's kind. Named endpoints attach to their own measured row handles.

Double-click or Enter inspects the referenced diagram in a read-only canvas; breadcrumbs
and Escape return to the parent without replacing its editor or undo history. The route
`#d/<parent-path>&into=tenant.nested` identifies nested instances. **Open diagram** opens
the source in its own Edit tab through the normal save/conflict guard. Expansion in View is
temporary; expansion of an authored instance in Edit writes `expand:`. Imported descendants
remain read-only, and manual-layout diagrams keep inline expansion disabled.

Missing files, invalid diagrams, reference cycles, and nesting deeper than eight diagrams
produce positioned errors and a destructive card with a written reason. Unloaded references
remain pending. Changes to referenced files, including creation or deletion, recompile the
parent without editing or saving its YAML or changing its undo history. A reconnect reloads
references because events may have been missed.

A dotted flow end reaches inside a diagram reference (`tenant.qtdi -> warehouse`). Every
segment must exist in the resolved diagram; another dot requires another diagram-reference
node. Missing or invalid references report their own problem without cascading unknown-id
errors. Both ends inside one collapsed reference produce an `inner-flow` warning because the
box cannot draw that loop. Once the actual endpoints are expanded, that flow draws normally.
Notes cannot reach inside references.

MCP validation and write tools use the same resolver. An invalid reference refuses the write.
`compose_set` cannot modify an inner node through its parent: edit the referenced file.
It can still edit a parent flow whose endpoint is dotted.

### 2.5 Inline expansion

Under automatic layout, `expand: true` turns a resolved reference into a zone containing its
referenced nodes, zones and flows. The wrapper keeps the instance id and its authored source
entry. Each imported id is prefixed with the instance id (`tenant.qtdi`); nested references
can expand again. Parent links and flow endpoints use the same prefix. A plain `tenant`
endpoint attaches to the wrapper boundary, while `tenant.qtdi` attaches to that inner node.
Child catalog metadata, styles and node style remain local to that source diagram. Imported
positions and notes are not copied; the surrounding automatic layout places the contents.

The imported contents are read-only. They have no source origin in the parent diagram,
cannot be dragged or deleted, and cannot receive reparented nodes. Edit the referenced file
to change them. The wrapper remains an authored reference, so deleting it removes that
reference and the parent's attached flows, not the referenced file.

`layout: manual` keeps references collapsed and retains their authored positions; requested
expansion adds the informational `expand-ignored` issue. Expansion is also bounded to eight
reference levels and 1,000 imported nodes, zones and flows per compilation. Each child
diagram reserves its whole immediate contents before import. If the remaining budget is too
small, that instance stays collapsed with a positioned `expand-limit` warning; it never
shows an incomplete subset of its own nodes or flows. Nested references may remain collapsed
inside an otherwise expanded parent.

For temporary exploration, `compileArch(ast, components, { expand, collapse })` and
`compileText(text, { files, catalog, expand, collapse })` accept sets of qualified instance
ids. `expand` reveals additional references, and `collapse` takes precedence over both
`expand` and authored `expand: true`. These options never change the source AST, YAML,
history or dirty state. Manual layout still wins. `view.inner` maps imported graph ids to
`{ component, id }` in their own source diagram; these addresses are navigation metadata,
not writable parent origins.

## 3. The version rule

`diagram:` reads `"0"` and `"1"` (`READ_VERSIONS`); this app always **writes** `"1"`
(`DIALECT_VERSION`). Any other value is `unsupported-version`. **A v0 file is never rewritten
by opening or saving it:** the normalizer (`normalize.ts`) reads a `"0"` or `"1"` file directly
and draws either the same way — `upgradeText` is never called on open or save; it runs only
from the migration script below and from `#dev/spec-check`'s own round-trip self-test. So a
file's first line can still say `"0"` after a session in the app; only a script writes to disk,
and only when it is run on purpose. Two, mutually exclusive, script modes migrate files on disk
without opening them (`scripts/upgrade-workspace.mjs`):

```sh
# 0 → 1 syntax upgrade (upgradeText): in place, on every *.yaml under the target (default:
# workspace), skipping _trash. --dry-run reports without writing.
node scripts/upgrade-workspace.mjs [--dry-run] [file-or-folder …]

# Reference-first migration (refFirstText, 1b.9): once, over every *.yaml under the target
# (default: workspace), skipping _trash — the same walk as the plain upgrade above, not just
# the files choices names. Refuses (and fails) a file the plain upgrade above has not
# touched yet — adding ref: beside diagram: "0" would leave a mixed file. choices shape:
# { "<workspace-relative path>": { "<node id>": "<catalog name>" | "catalog/<name>" |
# "custom" } } (either form of the name works). scripts/ref-first-choices.json (committed) is
# always applied first — it is exactly what migrated the seven shipped workspace files, so a
# bare --ref-first re-run is a no-op on them; --choices <file.json> merges on top of it, per
# file and then per node id. In a file with no ref nodes, a node not named in either is tried
# against its own written icon as the catalog name. Once any node writes ref, only explicitly
# named choices convert further nodes, preserving stand-ins in copied or moved diagrams;
# "custom" (or an icon that is not a catalog name) leaves the node exactly
# as written. Each file reports its own line — a bad choice, a node left custom on purpose, a
# key pinned to keep the drawing the same, or "<n> references, <n> keys dropped" — and the run
# fails (without writing anything, on any file) if any file was unreadable or named a choice
# with no matching node or catalog entry. Anchors, aliases, descriptions and docs stay written.
# Every rewritten file is compiled and compared against the original (all drawing fields,
# ignoring only catalogEntry provenance); a diagnostic error or changed drawing writes nothing.
# Never run together with a dialect upgrade.
node scripts/upgrade-workspace.mjs --ref-first [--choices <file.json>] [--dry-run] [file-or-folder …]
```

Both modes preserve every comment and the file's layout exactly except for the keys they
touch (`write-back.ts`'s source-map splice, never a YAML Document round-trip).

## 4. New issue codes

Same rules as v0 (`docs/dialect-v0.md` §10): severity decides `ok`; every code has a fixture;
position is the issue's start.

| Code                 | Severity | Message (template)                                                                                                                                                        | Fixture @ line:col                            |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `bad-ref`            | error    | One message per cause (`normalize.ts` `badRef()`) — see the list below.                                                                                                   | `issue-bad-ref.yaml` @ 5:10 through 29:10     |
| `ref-missing`        | error    | `No catalog item "<name>".` (+ `Did you mean "catalog/<near>"?` when one is close) · `"<name>" is an icon with no catalog item; write "icon: <name>" instead of the ref.` | `issue-ref-missing.yaml` @ 5:10 and 7:10      |
| `inner-flow`         | warning  | `Both ends are inside "<id>"; draw this flow in <ref> instead.`                                                                                                           | `issue-inner-flow.yaml` @ 7:5                 |
| `expand-not-diagram` | warning  | `"expand" applies only to a node whose ref names a diagram (ws/…); here it does nothing.` (on the key)                                                                    | `issue-expand-not-diagram.yaml` @ 5:5 and 8:5 |
| `expand-ignored`     | info     | Requested expansion stays collapsed under manual layout.                                                                                                                  | `compose/compose-inline-manual.yaml`          |
| `expand-limit`       | warning  | An instance stays collapsed at the depth or imported-element budget.                                                                                                      | inline expansion unit stress fixture          |

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
- `ws/…` whose first bad segment starts or ends with a space: `"<ref>" names "<segment>",
which starts or ends with a space; the workspace trims names.`
- `ws/…` whose first bad segment starts with `_` (not `_trash`): `"<ref>" names "<name>", which
starts with "_" (reserved, like _trash); a reference cannot use it.`
- `ws/…` whose first bad segment starts with `.`: `"<ref>" names "<name>", which starts with
"." (hidden); a reference cannot use it.`
- `ws/…` whose first bad segment has a character the grammar refuses (`\`, a control
  character): `"<ref>" contains a backslash; the workspace does not accept it in a name.`
  (or "a control character"). Control characters in the displayed path are escaped.

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
