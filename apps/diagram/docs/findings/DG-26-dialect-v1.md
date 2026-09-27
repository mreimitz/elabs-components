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
  diagram (the literal root `ws`, the maintainer's ruling; the last segment is the file name
  without `.yaml`). Any key written beside `ref:` overrides what the reference supplies; a
  custom node without `ref` stays valid. `ids.ts`'s `REF_RE` rejects a last segment ending in
  `.yaml`/`.yml` on purpose — `badRef()` catches that specific mistake and suggests the path
  with the extension stripped, rather than silently accepting a typed-out filename.
- **Dotted flow ends.** `tenant.qtdi` reaches inside a node whose `ref` names a diagram — grammar
  `END_SOURCE = ID(\.ID)*`. `validate.ts` allows a dotted end only through such a node
  (`unknown-endpoint` otherwise, with a message naming the reason), flags a note that dots into
  one (`unknown-note-target`, dotted notes are not resolved yet), and flags a loop where both
  ends land inside the same reference (`inner-flow`, warning).
  `expand-not-diagram` (warning) catches `expand:` on a node whose `ref` is not a diagram, or
  with no `ref` at all.
- **Composite nodes, interim.** A node whose `ref` is a diagram compiles to one
  `arch/composite` node (`ARCH_COMPOSITE_TYPE`, `CompiledCompositeData`: `component`, `ports`,
  `pending`/`broken`), rendered for now by the existing `ServiceNode` (DG-27 replaces this).
  `data.ports` lists the inner ids the file's flows actually touch, first-use order.
- **Vocabulary parity.** Two new compile-time `Assert<Equals<…>>` checks in `registry.ts` keep
  `COMPOSITE_TYPE_KEY`/`ARCH_COMPOSITE_TYPE` and the dialect/component unions in sync; a drift
  fails `typecheck:local`.
- **Fixtures and the dev check page.** Nine new fixtures under `src/spec/dialect/__fixtures__/`
  cover the new grammar's edges; `issue-unsupported-version.yaml` moved to `diagram: "2"` now
  that `"1"` is real. `#dev/spec-check` gained two tables: the seven workspace files (dialect,
  shape, round trip, and — for the customer-landscape template — the collapsed `tenant`
  reference's port list and inner-flow edge counts) and the 0→1 upgrade over the ten `valid-*`
  fixtures. Total: **63 of 63** (44 fixture rows + 2 pairs + 7 workspace rows + 10 upgrade rows).
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
- `#dev/spec-check` — "63 of 63 checks pass", 0 failing rows.
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

- **The `ref:` grammar had a real gap, found while writing the `issue-bad-ref` fixture.** The
  first draft's segment regex (`[^/]+` minus a leading `_` and minus a bare `.`/`..`) let a last
  segment end in `.yaml` — so `ref: ws/components/tenant.yaml` parsed as a VALID path instead of
  triggering `badRef`'s "write the path without .yaml" message. Fixed by giving the last segment
  its own pattern (`FILE_SEGMENT_SOURCE`) that also excludes a trailing `.yaml`/`.yml`; folder
  segments in between keep the fully permissive grammar. This changed the generated JSON Schema
  pattern too (`schema:build`), committed separately so the schema-build gate stays idempotent.
- **The `workspace/README.md` "two rules" section** used to say `components/` is the only root a
  reference resolves from; that stopped being true once a `ref:` can point at any workspace file
  (reference-first nodes, this item). Rule 1 now says a reference resolves from the workspace
  root, and that `components/` is just where a reusable diagram naturally lives (and the one
  folder that cannot be moved or trashed) — `server/workspace-fs.mjs`'s `COMPONENTS` constant
  keeps that one guarantee unchanged; nothing in the resolution code itself was ever restricted
  to `components/`, so no functional change was needed there.
- **`issue-unsupported-version.yaml`** moved from `diagram: "1"` to `diagram: "2"` — `"1"` is a
  real, accepted dialect now, so the fixture needed a version genuinely past what the app reads.

## The interim look, and what is deferred to later parts

A diagram reference still draws as a plain `ServiceNode`-shaped box titled by its id (`tenant`),
with no component icon and no drill-down — Part 1b gives it the referenced diagram's real title,
icon and description; DG-27 gives it its own composite renderer with drill-down. `expand: true`
is accepted by the grammar and read from YAML, but nothing draws an expanded reference inline
yet (Part 3). Editor completion for either path form (`ref: catalog/…` or `ref: ws/…`) is
DG-28's recorded requirement, not built here. Migrating the seven workspace files themselves to
be reference-first (dropping the duplicated `title`/`icon`/`description` that a catalog entry
would supply) is Part 1b's job — the stand-in custom nodes the earlier draft named (lakehouse
`nia`, `replicate`, on-prem `licensing`) are explicitly out of this Part's scope.

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
