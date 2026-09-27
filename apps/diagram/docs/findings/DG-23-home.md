# DG-23: Home findings

Built 2026-09-28, on `diagram/home` (from current `origin/main`, not the roadmap item's own
reference branch — see "Re-hardening" below). Checked in the app's dev server, in Chromium
through `agent-browser`, at 1440×900 and 390×844, in light and dark.

No `@elabs-ai/components-ui` gaps were found while building this — no `// P4: library gap`
comments in `src/home/`. This item is only decisions and deviations.

## What was built (R1 scope box)

- **Recent** — up to 8 recents (DG-21's list, filtered to paths that still resolve in the tree;
  falls back to the 8 most-recently-edited diagrams when there are none yet), each a
  `RecentCard`: the saved 480×270 thumbnail (16:9, `fit="contain"`, lazy), title, folder, "Edited
  …". The whole card is one stretched link — one Tab stop, Enter opens it.
- **Folders** — a new read-only `FolderList` (`src/home/folder-list.tsx`), not the sidebar's
  `WorkspaceTree`. It reuses the sidebar's own `buildTree`/`TreeEntry` so the two views can never
  disagree, but not the row chrome: `WorkspaceTree`'s rows are `SidebarMenuSub*`, styled in the
  `--sidebar-*` token set, and carry rename/move/trash actions that belong to the rail, not to a
  launch surface that only opens a file.
- **Components** — every file under `workspace/components/`: thumbnail, name (opens it),
  `component.description` when the file has one, "Used in N diagrams" (a `Popover` listing the
  diagrams) or "Not used yet". Usage comes from a text scan for a `ref:` line naming
  `ws/components/<file>` across every diagram file — dialect v1's form. The retired `use:` key is
  not scanned for.
- **Start from** — "New diagram" (`workspaceActions.create("", "Untitled diagram")`, root,
  `createUniqueFile` under the hood so it never overwrites) and "New from template" (a dialog of
  DG-67's two templates; picking one copies the template's text into `workspace/customers/`
  under a unique name and opens it). Both open the result in edit mode; both toast on failure and
  leave Home as it was.
- **Connect an LLM** — a dialog built from `mcp/README.md` and `mcp/prompts/*.md`: the endpoint,
  the Claude Code command, the Claude Desktop `mcp-remote` bridge config, and the two prompts the
  server actually serves (`author-diagram`, `fill-catalog`).

Cut, per the R1 scope box: health tiles, and the search index/search trigger/search palette
group. A filter on the sidebar's own tree (a parallel slice) replaces search; Home has none of
its own.

Layout: the top bar already renders "Home" (`shell/top-bar.tsx`'s breadcrumb), so Home's own
`<h1>` is `sr-only` — there is no second visible "Home" title. Section headings ("Recent",
"Folders", "Components") are plain `<Heading level={2}>` in `<section aria-labelledby>`; no
marketing copy anywhere on the page.

## Re-hardening (roadmap item vs. real `origin/main`)

The roadmap item's own body carries reference code from a branch that was never merged
(`diagram/harden-w1-ui`, `534755b9`). None of it was copied verbatim; every import and API was
re-checked against the current tree. Concretely, real `origin/main` was **better** than the
roadmap assumed in two places:

- `openDoc(path, options)` (`shell/mode-store.ts:307`) already takes a `{ mode?: DocMode }`
  option — the roadmap's plan called for adding one. Home just passes `{ mode: "edit" }`.
- `src/catalog/catalog-service.ts` already exists (DG-24 merged after the roadmap item was
  written) — nothing to stub.

And these are this item's own decisions, not in the roadmap body:

- **`FolderList`, not `WorkspaceTree`.** See "Folders" above — the sidebar's tree is styled and
  actioned for management, not a read-only launch list.
- **Text-scan `ref:`, not a `use:` scan.** The roadmap's reference code scanned for a `use:` key,
  which is retired. Component usage is detected by regex over raw file text
  (`REF_LINE` in `src/home/components-panel.tsx`), independent of whether the referencing file
  compiles — this has to work for dialect v1 files, which the app's compiler currently refuses
  outright (DG-26 lands the compiler support).
- **`component.description` read as plain YAML**, via `yaml`'s `parseDocument(text).toJS()`
  directly, not through the app's dialect-versioned compiler — the compiler cannot read a
  dialect-v1 component file at all yet, and the description is unaffected by dialect version.
- **A hardcoded `HOME_TEMPLATES` list** (`src/home/start-from.tsx`), not an extension of the
  existing `EXAMPLES` list — templates are DG-67's two dialect-v1 files, a different set with
  different UI (a picker dialog, not the examples gallery).
- **Copies land in `workspace/customers/`**, created on first write if it does not exist
  (`server/workspace-fs.mjs` auto-`mkdir`s on write) — chosen as a plausible customer-diagrams
  folder distinct from `examples/` and `templates/`.
- **No `data-slot="recent-card"` override.** `Card`'s own root slot is kept (the convention: a
  preset wrapping a base component keeps the base's slot).
- **Thumbnails for the two examples that had none** (`lakehouse-aws.yaml`,
  `clickhouse-cloud-stack.yaml`) were generated the way the app's own thumbnail writer makes them:
  opened in edit mode in light theme, `diagramActions.setText` appended a trailing comment (a
  no-op edit — the rendered picture is identical), waited for autosave + the thumbnail write
  (`workspace/examples/*.thumb.png`, committed), then the text was set back to byte-identical
  original and saved again. `git diff` on both `.yaml` files is empty; only the two `.thumb.png`
  files are new.
- **Newer-format files still show "This diagram uses a newer format"** when opened — both
  templates and `components/qlik-cloud-tenant.yaml` are dialect v1 (DG-67), and the app cannot
  compile dialect v1 until DG-26. This is expected, not a Home bug — Home's job is to create/copy
  the file and open it, not to compile it.

## Verified in the browser

- Recent, Folders and Components render correctly in both themes at both widths; no horizontal
  scroll at 390px, single-column card stacking.
- Keyboard: Tab from "New diagram" reaches "New from template", "Connect an LLM", then one Tab
  stop per recent card (a full-card focus ring, not a ring on the inner link).
- "New diagram" and "New from template" both create the expected file, never overwrite, and open
  in edit mode with "Saved" status.
- The Components panel's "Used in N" popover was verified against a real usage (a temporary test
  diagram with a `ref:` line, removed afterwards — never committed) and correctly lists the
  referencing diagram; with zero real usages (the workspace's actual current state) it correctly
  reads "Not used yet".
- Connect an LLM's four sections render the real `mcp/README.md`/`mcp/prompts/*.md` data; copy
  buttons work; Esc returns focus to the trigger.
