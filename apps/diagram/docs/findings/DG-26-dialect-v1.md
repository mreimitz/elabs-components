# DG-26 Part 1a: dialect v1, reference-first nodes — findings

Built on `diagram/ref-1a` (from `origin/main` 807c4034) on 2026-09-27, against
`.evidence/dg-26-amend/draft-item.md` as amended by the maintainer's ruling of the same date
(most load-bearing: a diagram reference's root segment is the literal word `ws`, not
`workspace`, and a path segment accepts any character except `/`, no leading `_`). Scope: Part 0
(preconditions) and Part 1a (dialect v1 reads, the `ref:` grammar, diagram references, the
version migration) only. Part 1b (catalog references end to end) and Parts 2–3 are the next
items; nothing here builds them.

## What shipped

- **Dialect v1, read-write.** `READ_VERSIONS = ["0", "1"]`, `DIALECT_VERSION = "1"`: the app
  reads both, writes only v1. Opening a v0 file never writes it — no autosave, no mtime change,
  no unsaved marker — the only writer is the one-shot migration script
  (`scripts/upgrade-workspace.mjs`, wraps `spec/dialect/upgrade.ts`'s `upgradeText`, a text edit
  via `write-back.ts`'s `setEntryKeys`, never a YAML `Document` round trip).
- **Reference-first nodes.** A node's identity can now be `id` + `ref:`, a path: `ref:
catalog/<pack>/<entry>` for a catalog item, `ref: ws/<folder>/…/<file name>` for another
  diagram (the literal root `ws`, the maintainer's ruling; the last segment is the file name,
  written with or without `.yaml`/`.yml`). Any key written beside `ref:` overrides what the
  reference supplies; a custom node without `ref` stays valid. A path segment accepts any
  character the workspace tree itself accepts — spaces, capitals, dots, unicode — except no
  leading `_` (keeps `_trash` out), no leading `.` and no `.`/`..` segment, and no empty or
  whitespace-only segment (maintainer ruling 2026-09-27). A trailing `.yaml`/`.yml` (any case)
  on the last segment is **stripped, not rejected** — `refFileOf` strips it before appending
  `.yaml` back on, so `ref: ws/components/qlik-cloud-tenant.yaml` resolves the same file as
  the form without the extension; `badRef()` gives each wrong shape (a bad segment, an old
  `workspace/…` or `components/…` root, a bare vendor/name pair, an unrecognized root) its own
  reason, with a `suggestion` where the fix is unambiguous.
- **Dotted flow ends.** `tenant.qtdi` reaches inside a node whose `ref` names a diagram — grammar
  `END_SOURCE = ID(\.ID)*`. `validate.ts` allows a dotted end only through such a node, or
  through a node whose `ref` is already flagged `bad-ref` (so a broken reference does not also
  cascade `unknown-endpoint` on every dotted flow through it — round-0 finding, the old
  `workspace/…` root case); a genuine miss is still `unknown-endpoint`, with a message naming
  the reason. A dotted note that dots into a real diagram reference says so
  (`unknown-note-target`); into anything else (a plain node, or nothing) it says "No node or
  zone has the id …" instead. `inner-flow` (warning) flags a loop where both ends land inside
  the same reference. `expand-not-diagram` (warning) catches `expand:` on a node whose `ref` is
  not a diagram (or has no `ref` at all) — again skipped when the ref is already `bad-ref`.
  `ref-type-not-drawn` (info) says when a `type:` written on a diagram reference is kept (the
  maintainer's override rule) but not drawn until Part 2's composite renderer.
- **Composite nodes, interim.** A node whose `ref` is a diagram compiles to one
  `arch/composite` node (`ARCH_COMPOSITE_TYPE`, `CompiledCompositeData`: `component`, `ports`,
  `pending`/`broken`), rendered for now by the existing `ServiceNode` (DG-27 replaces this).
  `data.ports` lists the inner ids the file's flows actually touch, first-use order.
- **Vocabulary parity.** Two new compile-time `Assert<Equals<…>>` checks in `registry.ts` keep
  `COMPOSITE_TYPE_KEY`/`ARCH_COMPOSITE_TYPE` and the dialect/component unions in sync; a drift
  fails `typecheck:local`.
- **Fixtures and the dev check page.** Eleven new fixtures under `src/spec/dialect/__fixtures__/`
  cover the new grammar's edges (round-0 review added `valid-ref-segments.yaml` and
  `issue-ref-type-not-drawn.yaml`, and extended `issue-bad-ref.yaml` and
  `issue-unknown-note-target.yaml`); `issue-unsupported-version.yaml` moved to `diagram: "2"`
  now that `"1"` is real. `#dev/spec-check` gained two tables: the seven workspace files
  (dialect, shape, round trip, and — for the customer-landscape template — the collapsed
  `tenant` reference's port list and inner-flow edge counts) and the 0→1 upgrade over the
  eleven `valid-*` fixtures, plus a `# expect-suggestion:` assertion so a pinned `suggestion`
  is checked, not just the issue code. Total: **66 of 66** (46 fixture rows + 2 pairs + 7
  workspace rows + 11 upgrade rows).
- **Workspace text.** Every place the app, its docs, the MCP tools or the workspace files said
  `use:`/`workspace/…` for a reference now says `ref:`/`ws/…`; `workspace/README.md`'s rule 1 no
  longer claims `components/` is the only root a reference resolves from (it can name any
  workspace file now).

## Measurements

- **Migration dry run**, `node scripts/upgrade-workspace.mjs --dry-run workspace`: `0 of 7 files
would change` (the four examples were migrated to `diagram: "1"` in a separate commit that
  touches only the version line and the line-1 modeline; the two templates and the tenant
  component were authored at v1 directly).
- **Landscape template's `tenant` reference** (`templates/qlik-cloud-customer-landscape.yaml`):
  one `arch/composite` node, `data.component === "components/qlik-cloud-tenant.yaml"`, 9 edges
  touch it (2 carry `innerTarget`, 5 carry `innerSource`, 2 are plain edges to the node itself),
  `data.ports === ["qtdi", "answers", "qca"]` — all asserted by the spec-check page's workspace
  row and confirmed again live in the browser (`[...document.querySelectorAll('.react-flow__edge')].filter(…tenant…).length === 9`).
- **Edge/node counts** for all seven workspace files matched `WORKSPACE_SHAPE` exactly
  (components/qlik-cloud-tenant 5/2, the four examples 14/9, 19/14, 13/8, 21/13, the two
  templates 18/10 and 28/13).
- **MCP probe** (JSON-RPC over `POST /mcp`, stateless, no session id needed): `spec_validate`
  returned `ok: true` for all seven workspace files (a few `info`-severity `zone-endpoint`
  notices, no error or warning); `spec_compile` on the landscape template returned
  `diagram.sourceVersion === "1"` and the `tenant` node's `ref === "ws/components/qlik-cloud-tenant"`;
  `spec_schema` returned a schema titled "brand-ui architecture diagram (dialect v1)";
  `compose_set` on a scratch copy with `diagram: "2"` refused with "is written in a newer
  dialect than this Atlas reads … Leave the file alone: do not change its version or rewrite
  it.", and the file's `title:` line was confirmed unchanged afterward.
- **v0-still-opens**: a scratch copy of `lakehouse-aws.yaml` with `diagram: "0"` drew the same
  19 nodes, its mtime was unchanged after opening and waiting 5 s, `diagram: "0"` was still on
  disk once, no unsaved marker appeared, and `Ctrl+Z` changed nothing (mtime and content both
  confirmed unchanged again after the keystroke).
- **Newer dialect**: the same file with `diagram: "2"` showed both "This diagram uses a newer
  format" and "Atlas cannot draw format 2 yet." in the tab.

## Gates

All from `apps/diagram` in the worktree unless noted; logs under
`/Users/czq/Documents/DEV/elabs/elabs-components/apps/diagram/.evidence/ref-syntax/1a-build/`.

- `typecheck:local` — 0 errors.
- `lint:local` — 0 errors, **11 warnings** (baseline was 12; the new DG-26 tables on
  `#dev/spec-check` use the same `SPEC_CHECK_LABELS` object as their existing neighbour rather
  than adding raw strings, and folding the old "Dialect v0 fixtures" caption into that object
  removed one baseline warning along the way).
- From the worktree root: `pnpm brand-ui audit --strict apps/diagram/src` — "scanned 52 file(s):
  0 style issue(s), 0 content-slop (blocking), 0 advisory", "--strict: exiting 0".
- `#dev/spec-check` — "66 of 66 checks pass", 0 failing rows.
- `node scripts/upgrade-workspace.mjs --dry-run workspace` — "0 of 7 files would change", exit 0.
- `pnpm run schema:build && git diff --exit-code -- schema/` — the rebuild picked up the
  `ids.ts` grammar fix (see Decisions below) and needed one commit to stay idempotent; clean
  after that.
- `git diff --stat $(git merge-base HEAD origin/main) -- packages/` — empty.
- `pnpm exec prettier --check` on every file this branch touches (52 files) — clean.
- Repo-wide wave gate (root): `pnpm typecheck` and `pnpm lint` — both `FULL TURBO`, all cached,
  `apps/diagram` absent from both pipelines as expected; `pnpm check` — 98/98 (93 rules + 5
  commands), every rule at its existing baseline; `pnpm check:test` — 470/470 tests, 20/20
  self-tests.
- Every PNG named in the Steps exists under `.evidence/dg-26/` (`p0-01-…` through
  `p1a-12-node-docs-status.png`).

## Decisions and deviations

- **Round-0 review correction: a trailing `.yaml` is stripped, not rejected.** The first pass
  read the maintainer's ruling backwards — it gave the last segment its own pattern
  (`FILE_SEGMENT_SOURCE`) that rejected a trailing `.yaml`/`.yml` as a `bad-ref` mistake, and
  the findings here said so "on purpose". The maintainer's actual final wording (relayed for
  this fix) is the opposite: a trailing `.yaml`/`.yml` (any case) on a `ws/` path's last
  segment is **stripped**, not rejected — `ref: ws/components/qlik-cloud-tenant.yaml` is a
  valid path, and `refFileOf` resolves it to the same file as the form without the extension.
  `FILE_SEGMENT_SOURCE` is gone; one `SEGMENT_SOURCE` now covers every segment (dots are legal
  anywhere in a name, so the last segment needs no special case), and `refFileOf` strips a
  trailing extension before appending `.yaml` back on. `badRef()` was rewritten at the same
  time to give each wrong shape (a bad segment, the old `workspace/…`/`components/…` roots, a
  bare `<vendor>/<name>` pair, an unrecognized root) its own message and, where the fix is
  unambiguous, a `suggestion`. This changed the generated JSON Schema pattern (`schema:build`),
  committed separately so the schema-build gate stays idempotent.
- **The `workspace/README.md` "two rules" section** used to say `components/` is the only root a
  reference resolves from; that stopped being true once a `ref:` can point at any workspace file
  (reference-first nodes, this item). Rule 1 now says a reference resolves from the workspace
  root, and that `components/` is just where a reusable diagram naturally lives (and the one
  folder that cannot be moved or trashed) — `server/workspace-fs.mjs`'s `COMPONENTS` constant
  keeps that one guarantee unchanged; nothing in the resolution code itself was ever restricted
  to `components/`, so no functional change was needed there.
- **`issue-unsupported-version.yaml`** moved from `diagram: "1"` to `diagram: "2"` — `"1"` is a
  real, accepted dialect now, so the fixture needed a version genuinely past what the app reads.

## Round-0 review fixes (this pass)

Two review lanes (`brand-ui-reviewer`, `verify-1a-r0`) ran against the first pass and failed it;
`.evidence/ref-syntax/1a-r0-findings.json` has both lanes in full. Every in-scope must-fix and
should-fix is fixed here except **F2** (four commits' trailer text) — the branch's existing
commits are not rewritten (no rebase, no amend), by this task's own hard rule; new commits use
the correct trailer.

- **F1 / yaml-not-stripped / yaml-uppercase / yml-message** — the grammar, `refFileOf` and the
  v1 schema pattern now strip a trailing `.yaml`/`.yml` (any case) instead of rejecting it; see
  "Round-0 review correction" above.
- **F3 / old-root-no-hint / old-use-generic** — `badRef()` gives the diagram form, the catalog
  form, the old `workspace/…` and `components/…` roots, and a bare `<vendor>/<name>` pair each
  their own message, with a `suggestion` for the unambiguous rewrites (`workspace/x` →
  `ws/x`, `components/x` → `ws/components/x`, `aws/rds` → `catalog/aws/rds`). A leftover `use:`
  key gets a message naming `ref:` directly, with the same rewrite as its `suggestion`.
- **F4 / migration-script-edges** — `upgrade-workspace.mjs` now fails (`cannot read (<reason>)`,
  exit 1) for any `reason` `upgradeText` returns (not only `from === null`), including
  `no-exact-edit`, and for a target path that does not exist; it prints
  `${from} → ${DIALECT_VERSION}` (imported through the same `runnerImport`), not a hard-coded
  `→ 1`.
- **F5 / docs-wrong-part / findings-standin-name** — this findings doc and the changelog now say
  **Part 2** for the referenced diagram's title/icon, and name the lakehouse stand-in `nat`
  (not `nia`); the changelog no longer says the app "still" writes only v1 (it wrote v0 before
  this item).
- **F6 / odd-segments** — `valid-ref-segments.yaml` pins the maintainer's permissive grammar
  (spaces, capitals, dots, unicode); `issue-bad-ref.yaml` gained rows for a leading `_`, a `..`
  segment, a leading `.` segment, a whitespace-only segment, the old `workspace/…` root, the old
  `components/…` root, a bare `ws`, an unrooted `<vendor>/<name>` pair and an uppercase catalog
  pack; three of those rows assert `suggestion` via a new `# expect-suggestion:` fixture
  comment `spec-check-view.tsx` checks.
- **F7** — a `type:` written on a diagram reference is kept (`overrideType` on
  `CompiledCompositeData`) and flagged at info severity (`ref-type-not-drawn`) rather than
  silently dropped; still not drawn until Part 2 (`issue-ref-type-not-drawn.yaml`).
- **write-overwrites-newer-dialect** — `diagram_write` (`server/mcp/tools/workspace.mjs`) now
  reads the file's current dialect before writing and refuses with the same message
  `compose.mjs`'s `editFile` uses when it is newer than this app reads; confirmed live over MCP
  (a `diagram: "2"` scratch file, `diagram_write` with valid v1 text over it, `isError: true`,
  file confirmed unchanged byte-for-byte).
- **F9** — the dotted-note wording ("… is inside a referenced diagram") is used only when the
  head really is a diagram reference (`diagramRefOf.has(head)`); otherwise "No node or zone has
  the id …" (`issue-unknown-note-target.yaml` pins both).
- **F10** — `COMPOSITE_ARIA.kind` is now `"Component"` (was `"component"`), matching
  `ARCH_KIND_LABEL`'s capitalization; the inner `ServiceNode`'s own "Service" text stays interim
  until DG-27's composite renderer (unchanged, noted here).
- **F8** — `ref` moved to directly after `id` in `NODE_DEF.fields`, so it leads the inspector's
  essential group (confirmed live: Id, Title, **Ref**, Type, Icon, Tone, …).
- **Nits** — `readme-extra-lines`: `workspace/README.md` rule 1 is back to 3 lines.
  `index-comment-use-component`: `server/mcp/tools/index.mjs`'s header comment no longer names
  the never-built `compose_use_component`.

## The interim look, and what is deferred to later parts

A diagram reference still draws as a plain `ServiceNode`-shaped box titled by its id (`tenant`),
with no component icon and no drill-down — **Part 2** gives it the referenced diagram's real
title, icon and description; DG-27 gives it its own composite renderer with drill-down. A
`type:` written on a diagram reference is kept (`overrideType` on the compiled composite data,
`ref-type-not-drawn` says so at info severity) but not drawn until Part 2 either. `expand: true`
is accepted by the grammar and read from YAML, but nothing draws an expanded reference inline
yet (Part 3). Editor completion for either path form (`ref: catalog/…` or `ref: ws/…`) is
DG-28's recorded requirement, not built here. Migrating the seven workspace files themselves to
be reference-first (dropping the duplicated `title`/`icon`/`description` that a catalog entry
would supply) is Part 1b's job — the stand-in custom nodes the maintainer named (lakehouse
`nat`, pipeline `replicate`, on-prem `licensing`) are explicitly out of this Part's scope.

## Demo script (`docs/demo-script.md`)

Run in the browser against the customer-landscape template, opened directly at
`#d/templates/qlik-cloud-customer-landscape.yaml` (step 2's own note: "New from template" is
DG-23's, not built yet).

| #    | Step                              | Result                                                                                                                                                                                                                                                                                                                                    |
| ---- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Open Home                         | Pass — tree, components and the seven files list.                                                                                                                                                                                                                                                                                         |
| 2    | Open the template                 | Partial — opens on-brand (Qlik theme), technical lens, correct node count; no particles (DG-30 not built).                                                                                                                                                                                                                                |
| 3    | Hover a node                      | Pass — the details card shows name, kind and description; this file's `gateway` node has no `docs:` set, so no "Open docs" link on this particular node (a fixture gap, not a Part 1a regression).                                                                                                                                        |
| 4    | Double-click the tenant composite | Fails, as the plan expects — no drill-down; DG-27's job.                                                                                                                                                                                                                                                                                  |
| 5    | `E`                               | Pass — editor and inspector slide in, canvas stays.                                                                                                                                                                                                                                                                                       |
| 6    | Rename + re-icon in the inspector | Not exercised — the template has no node named "Postgres" to rename (a demo-script/fixture mismatch, not scoped here).                                                                                                                                                                                                                    |
| 7    | Type a flow, use completion       | Not built — DG-28's job, as the plan expects.                                                                                                                                                                                                                                                                                             |
| 8    | `L` (marketecture lens)           | **Bug found, out of this item's scope**: the lens switches but the boxes stay on their loading skeleton indefinitely, reproduced in a fresh session, `L` again returns cleanly to the technical lens. DG-36/37/38 territory; nothing in this Part touches lens rendering, and `ast.visual` is passed through unchanged as an open object. |
| 9–12 | Story, present, export, reopen    | Not exercised this run — DG-31/DG-43/DG-23 territory, unrelated to this Part's scope.                                                                                                                                                                                                                                                     |

## Problems

- The `L` lens bug above should be filed against whichever DG-36/37/38 item owns the visual
  lens renderer; it predates this branch (confirmed on an untouched dev-server session) and this
  Part's diff never touches that code path.
- `lint:local`'s baseline is a pre-existing pile of hardcoded UI text in `spec-check-view.tsx`
  (an internal dev-only diagnostics page) and one string in `editor-pane.tsx`; this Part added
  two new tables to that same page without adding to the pile, but did not clean up the
  pre-existing 11.
- **F2 (commit trailer wording) is deliberately not fixed.** Four already-pushed commits end
  with the wrong "Claude Sonnet 5" trailer instead of "Claude Opus 5.5 (1M context)"; fixing it
  would need rewording those commits (rebase or filter-branch), which this round's hard rule
  forbids ("Do NOT rewrite history — no rebase, no amend of existing commits"). Every new commit
  in this round uses the correct trailer.
- The branch was behind `origin/main` (`stale-base`); `git fetch && git merge --no-edit
origin/main` brought in the chart-spec-version work with no conflicts before any of the above
  fixes, so `git diff --stat origin/main -- packages/` is empty again.

## Part 1b: catalog references end to end — findings

Built on `diagram/ref-1b` (from Part 1a `50c36fb0`) on 2026-09-28, against
`.evidence/dg-26-amend/final-item.md`'s Part 1b steps, adjusted by the maintainer's
2026-09-27 ruling (gateway nodes use the general `catalog/qlik/data-gateway` entry, not a
specific part; stand-ins `nat`, `replicate` and onprem `licensing` stay custom).

### What shipped

- **`resolveCatalogRefs`** fills a node's unwritten `SUPPLIED_KEYS` from its catalog entry and
  sets `catalogEntry`, wired into `checkArchYaml`/`compileText` behind an explicit
  `{ catalog }` source (never a hidden global) so a fixture or workspace check can pin which
  catalog it compiles against.
- **The bundled catalog** (`src/catalog/catalog-bundle.ts`): the same merge the dev server's
  `/api/catalog/all` computes, built into the app at build time via `import.meta.glob`, so
  first paint, `vite preview` and static builds resolve references before any network call
  lands; the live catalog (`catalog-service.ts`) replaces it once loaded, with an
  overlapping-load guard (`loadSeq`) so a slow first fetch cannot stomp a faster second one.
- **`refFirstText(text, catalog, choices?)`** (`upgrade.ts`): a text-splice migration, one node
  at a time — `choices[id]` names a catalog entry or `"custom"`; a node not named tries its own
  written `icon:` as the catalog name; a hit becomes `ref: catalog/<name>` (renaming `icon:` to
  `ref:` when the icon already equals the entry, else adding `ref:` and keeping the icon
  override) and drops any written key that already equals what the reference supplies, unless
  a comment guards it.
- **The inspector shows what a reference supplies** (1b.6): a field the node does not write and
  the reference does gets no default value (an enum shows "Not set", a text field is empty)
  and its help text becomes "From the reference: `<value>`"; the form remounts on a live
  catalog change (`catalogVersion()`/`onCatalogChange`).
- **`refHints`**: advisory-only, for the MCP tools — a custom node (no `ref`) whose `icon:`
  names a catalog item gets a hint string in `compose_set`/`compose_add_nodes`'s result, never
  an issue; a human author sees nothing.
- **The seven workspace files** migrated reference-first, drawings unchanged.

### The choices file (1b.9's `--choices`)

```json
{
  "examples/lakehouse-aws.yaml": {
    "nat": "custom",
    "dbx-jobs": "databricks/jobs",
    "snow-db": "snowflake/database"
  },
  "examples/qlik-cloud-data-gateway.yaml": { "users": "generic/users" },
  "examples/qlik-sense-enterprise-onprem.yaml": { "users": "generic/users", "licensing": "custom" },
  "templates/qlik-cloud-customer-landscape.yaml": {
    "users": "generic/users",
    "answers-users": "generic/users"
  },
  "templates/qlik-talend-cloud-pipeline.yaml": { "replicate": "custom" }
}
```

Every other node in the seven files defaults from its own written `icon:` (no entry needed);
`components/qlik-cloud-tenant.yaml` and `examples/clickhouse-cloud-stack.yaml` needed no
overrides at all. The gateway boxes in `qlik-cloud-data-gateway.yaml` and the two
`gateway`/`tenant`-adjacent nodes elsewhere default to the general `catalog/qlik/data-gateway`
entry (the maintainer's ruling), keeping each box's own distinct title since it differs from
the entry's label "Qlik Data Gateway".

### The dry-run output

`node scripts/upgrade-workspace.mjs --ref-first --choices <file> --dry-run workspace` matched
the plan's independently modeled prediction exactly, file for file, down to the final line:

```
55 references and 22 dropped keys in 7 of 7 files (dry run)
```

Applied for real (no `--dry-run`): the same 55/22/7-of-7, `git diff --stat` "7 files changed,
60 insertions(+), 82 deletions(-)" (the extra +5/-5 over the plan's 55/77 is four manual
comment edits this build made by hand — two rewritten Oracle/PostgreSQL/Databricks comment
lines in the landscape template and one added line each on the `nat` and `licensing`
stand-ins, explaining in words why they stay custom). A second `--ref-first --dry-run` over
the already-migrated tree reports 0 changes (idempotent); a plain (non-`--ref-first`) dry run
still reports "0 of 7 files would change" (no dialect-0 files remain).

### The drawn-same verification

A scratch script (`runnerImport` on `src/server-surface.ts`, compiling `git show
HEAD:apps/diagram/workspace/<rel>` against the migrated working file through the same
`checkDiagram`) compared each file's compiled nodes and edges as JSON, stripping only
`catalogEntry`, `description` and `docs` (fields the migration is allowed to add or drop by
design). All seven files: **same**. `#dev/spec-check`'s workspace-row shape assertions (node
and edge counts unchanged from Part 1a's numbers) and the new `data.catalogEntry` count per
file (tenant 4, clickhouse 5, lakehouse 12, gateway 7, onprem 6, landscape 8, pipeline 13 — 55
total, matching the dry run) back this from the running app, not just the scratch script.

### What this build did not measure

The live-catalog-edit delay (1b.13's `MutationObserver` timing probe on a hand-edited
`catalog/aws.yaml`), the full MCP probe suite (`catalog_get`, `compose_add_nodes` with `ref`,
`spec_compile`/`spec_validate` against a scratch copy, the hints probe, `diagram_create`
refusing bad text), the inspector's live screenshots for `glue`/`people`, the catalog entry
page's snippet screenshot, and the "bundle equals live" `eval` were not run this session — see
the branch report's Problems. What _was_ checked directly against the running dev server
(port 5272): `#dev/spec-check` reads "72 of 72 checks pass"; `#d/examples/lakehouse-aws.yaml`
renders unchanged (icons, titles, layout); a scratch file with `ref: catalog/aws/rdss` lists
`1 error` — "No catalog item aws/rdss. Did you mean catalog/aws/rds?" at its exact line:col,
then was removed (`git status --porcelain workspace/ catalog/` prints nothing after).
