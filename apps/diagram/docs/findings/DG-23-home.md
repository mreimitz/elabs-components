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

Layout: the top bar already renders the page's one `<h1>` ("Home", `shell/top-bar.tsx`'s
breadcrumb); Home renders no `<h1>` of its own (round 0 shipped a second, `sr-only` one — review
finding F3/F11, fixed: two `<h1>Home</h1>` elements is two landmarks for the same page to a
screen reader, not one hidden extra). Section headings ("Recent", "Folders", "Components") are
plain `<Heading level={2}>` in `<section aria-labelledby>`; no marketing copy anywhere on the
page.

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
  (`REF_LINE` in `src/home/component-usage.ts`), independent of whether the referencing file
  compiles — this has to work for dialect v1 files. (At the time this was written the app's
  compiler could not yet read dialect v1 at all; DG-26 landed compiler support before round 1,
  and the text scan turned out to matter less than expected as a result — see round 1 below.)
- **`component.description` read as plain YAML**, via the shared `topLevelDescription` helper
  (`src/home/yaml-field.ts`, `yaml`'s `parseDocument(text).toJS()`), not through the app's
  dialect-versioned compiler — a description renders even for a file the compiler rejects, and
  the same helper backs the template picker's top-level `description:` (round 1, R1-F11).
- **Templates read from the tree, not a hardcoded list** (`src/home/templates.ts`) — an early
  draft of this file had a hardcoded `HOME_TEMPLATES` list; round 0's F6 replaced it with reading
  every diagram under `templates/` from the tree, same as the rest of this item.
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
- **Dialect v1 now compiles (DG-26 landed on `origin/main` during round 1).** Both templates and
  `components/qlik-cloud-tenant.yaml` render normally once opened — the "newer format" banner this
  bullet originally described no longer applies. See round 1 below.

## Verified in the browser

- Recent, Folders and Components render correctly in both themes at both widths; no horizontal
  scroll at 390px, single-column card stacking.
- Keyboard: Tab from "New diagram" reaches "New from template", "Connect an LLM", then one Tab
  stop per recent card (a full-card focus ring, not a ring on the inner link).
- "New diagram" and "New from template" both create the expected file, never overwrite, and open
  in edit mode with "Saved" status, and land keyboard focus on the new document's tab.
- The Components panel's "Used in N" popover was verified against a real usage (a temporary test
  diagram with a `ref:` line, removed afterwards — never committed) and correctly lists the
  referencing diagram. (At the time this was written the shipped workspace had no real `ref:` yet;
  it now does — `templates/qlik-cloud-customer-landscape.yaml` names the tenant component, so the
  real state reads "Used in 1 diagram", not "Not used yet".)
- Connect an LLM's four sections render the real `mcp/README.md`/`mcp/prompts/*.md` data; copy
  buttons work; Esc returns focus to the trigger.

## Review round 0 — fixes

Round 0 (`brand-ui-reviewer` + a verify pass) found two must-fix and several should-fix defects,
all in scope for this item; addressed in the commits that follow this doc update (evidence in
`.evidence/home/fix-r0/`). The claim above that Recent "renders correctly … at both widths" was
not true before this pass — see F1.

- **F1 (must-fix) — Recent cards did not fill their grid cell.** `RecentCard`'s root `Card` had no
  `w-full`/`flex-1`, so a card with a short title (e.g. "Untitled diagram") shrank to its content
  width inside a wider `<li className="flex">` — 160px in a 400px column at 1440px. Fixed by
  giving `Card` `w-full` (`src/home/recent-card.tsx`); the same fix applies to `TemplateCard`.
- **F2 (must-fix) — "Used in N diagrams" counted `ref:` lines, not diagrams.** A diagram that
  referenced the same component twice was counted (and listed in the popover) twice, and React
  logged a duplicate-key warning. `refTargets` now returns a `Set`, so a repeated `ref:` to the
  same component inside one diagram counts once (`src/home/component-usage.ts`).
- **F3 (should-fix) — the `ref:` scan missed two valid forms.** A component name with a space
  (dialect v1 allows one) and a flow-style node (`- { id: t, ref: ws/components/x }`) were not
  matched. The pattern now also anchors after `{`/`,`, and an unquoted value runs to `,`, `}`, `#`
  or end of line instead of stopping at the first space.
- **F4 (should-fix) — no error state when the workspace tree fails to load.** Recent, Folders and
  Components all showed "Loading…" forever; the store's `treeError` was never read outside the
  sidebar. Added `TreeErrorPanel` (`src/home/tree-error-panel.tsx`, the same `StatePanel
kind="error"` + Retry pattern as the sidebar's own `TreeLoadError`), read by all three sections.
- **F5 (should-fix) — focus dropped to `<body>` after "New diagram"/"New from template".** Both
  flows now call `focusDocTab(path)` (`../shell/focus`) after `openDoc`, the same hand-off the
  sidebar's own "new diagram" flow uses.
- **F6 (should-fix) — the template picker was a hardcoded list.** `HOME_TEMPLATES` duplicated (and
  had already drifted from) the templates' own titles. The picker now lists every diagram under
  `templates/` straight from the tree, reading each one's title and top-level `description:` the
  way the components panel reads a component's description.
- **F7 (should-fix) — Recent's fallback (before anything has been opened) counted the two
  templates as recents,** and once one recent existed, Recent showed only that one card even with
  more diagrams on disk. `recents.ts`'s `recentFiles` now excludes `templates/` from both the
  stored-recents list and the fallback, and tops the list up to `RECENTS_SHOWN` with the newest
  diagrams by mtime that are not already listed.
- **F8 (should-fix) — pure logic lived inside React component files.** `REF_LINE`, `refTargets`,
  `componentStem`, `componentDescription` and `buildComponentEntries` moved to
  `src/home/component-usage.ts`; `recentFiles` moved to `src/home/recents.ts`. Both are
  React-free, per convention.
- Also fixed as nits while in the same code: the "Used in" popover now names each diagram by its
  title, not its file stem (component-usage.ts carries `{ path, title }`); a shared `NoPreview`
  well (`src/home/no-preview.tsx`) replaces three near-duplicate inline wells, and the components
  panel's thumbnail now shows the "No preview yet" wording instead of a bare glyph; the
  components-panel thumbnail well no longer pairs a fill with a redundant border; the Claude Code
  command (longer than the dialog is wide) now renders in the same scrollable `SnippetBlock` as
  the Claude Desktop config instead of being cut off by `CommandChip`'s fixed-width truncation;
  and `SnippetBlock`'s copy button now falls back to selecting its own text (with an announced
  fallback message) when the clipboard is unavailable, matching `CommandChip`'s own fallback.
- **Decision recorded for the catalog page (F14):** the catalog entry page's own future "Used in"
  (`src/catalog/entry-view.tsx:144`, currently a deferred comment) should read the same
  `ws/components/<file>` text scan this item ships — `refTargets`/`buildComponentEntries` in
  `src/home/component-usage.ts` — not a second source. Not implemented here: that file is outside
  this slice.
- **Not fixed (nits, listed rather than chased):** the Claude Desktop copy's straight apostrophe
  in "fill-catalog"'s description is a byte-for-byte copy of `mcp/prompts/fill-catalog.md`'s own
  frontmatter (verified against the live server's `prompts/list`); curling it here would make
  Home's copy diverge from what the server actually returns, which is the opposite of the point.
  The MCP URL's hardcoded port matches the "strings from the README" decision. Two copies of the
  same template are still visually indistinguishable in Recent/Folders beyond their (identical)
  title. `ComponentsPanel` re-reads every file's text on every tree change, with no mtime cache.

## Review round 1 — fixes

Round 1 (`brand-ui-reviewer` + a verify pass) found one must-fix and several should-fix defects,
all in scope; addressed in the commit that follows this doc update (evidence in
`.evidence/home/fix-r1/`). Two logic modules were split out of view files while fixing these
(`conventions/logic-modules`); everything else is a same-file fix.

- **Wrong toast on "New from template" when the open tab had unsaved edits.** Both start-from
  flows used to call `workspaceActions.open()` as part of "create", so a failed open (the
  currently open tab had unsaved edits that did not reach disk) reported "could not create the
  diagram" — false; the copy had already been written to `workspace/customers/` and was not
  lost. Fixed by separating writing from opening: `copyTemplate` (`src/home/start-from.tsx`) now
  only writes and refreshes the tree, never opens; `createAndOpen` opens via the normal hash
  route (`openDoc`) afterwards and, for the one remaining caller that can still raise this
  (`workspaceActions.create` for plain "New diagram", which does open internally), catches
  `UnsavedEditsError` and toasts the honest, distinct "Created, but not opened" message that
  `UnsavedEditsError` itself already names both documents in.
- **The workspace tree failing to load showed three separate error banners** (Recent, Folders,
  Components each rendered their own `TreeErrorPanel`). `home-view.tsx` now computes one
  `treeFailed` flag and renders a single page-level banner; the three sections render nothing
  (not a second alert, not a loading spinner) while it is showing. `ComponentsPanel` returns
  `null` in that state instead of its own panel; `TemplatePicker` now takes `tree`/`treeError`
  (was `files` alone) so its own dialog body can tell "still loading" apart from "the fetch
  failed" and show the same `TreeErrorPanel` inside the dialog rather than a permanent spinner.
- **Dialect v1 now compiles (DG-26 landed on `origin/main` during round 1).** The doc's own
  claims about a "newer format" banner, about the compiler not reading dialect v1, and about the
  text-scan `ref:` approach mattering because the compiler couldn't be used, were all stale.
  Corrected the "Re-hardening" section above rather than leaving false statements in place; the
  text-scan approach is kept (it is still the right choice — usage detection has to work for a
  file that does not compile for other reasons — just not for the reason originally written).
- **The Claude Desktop config text didn't match `mcp/README.md` byte-for-byte.**
  `JSON.stringify(config, null, 2)` reflows the `args` array onto its own lines, so the copied
  snippet diverged from the fenced block in the README. `connect-info.ts`'s
  `CLAUDE_DESKTOP_CONFIG` is now a literal string kept in sync with the README by eye, with a
  `JSON.parse` at import time as a guard that a future hand-edit stays valid JSON.
- **The Claude Code command snippet was unreadable at dialog width.** It is one line longer than
  the dialog, and `SnippetBlock` scrolled it horizontally behind a scrollbar most platforms hide
  by default, so the rest of the command was invisible without knowing to scroll. `SnippetBlock`
  gained a `wrap?: boolean` (`src/home/connect-dialog.tsx`); the Claude Code command wraps, the
  JSON config block does not (wrapping would fight its own indentation).
- **The components panel's "Used in" popover had no accessible name for screen readers** and
  could not tell two same-titled diagrams (e.g. a template and its copy) apart. `UsedIn`
  (`src/home/components-panel.tsx`) now wires `useId` + `aria-labelledby` from the popover's
  caption to its content, and each listed diagram shows its folder under its title (the tenant
  component's usage list now reads "Qlik Cloud and the customer landscape / templates", not just
  the bare title). `ComponentUsage` gained a `folder` field (`component-usage.ts`) built once in
  `buildComponentEntries` instead of computed per render.
- **"New diagram" had no guard against a double click firing two creates.** Two rapid clicks
  could create two untitled diagrams. `NewDiagramButton` now tracks a `pending` state and uses
  `aria-disabled` + a handler guard (never native `disabled`, matching `TreeErrorPanel`'s Retry
  and `PromptInputSubmit`'s own pattern) so a second click while the first is still in flight is
  a no-op.
- **`component.description` and the template picker's top-level `description:` duplicated the
  same plain-YAML string-field read.** Extracted the shared logic into
  `src/home/yaml-field.ts`'s `topLevelDescription(text, path)`; `component-usage.ts`'s
  `componentDescription` and `templates.ts`'s `templateDescription` both call it now with their
  own path (`["component", "description"]` vs. `["description"]`). `templates.ts` is itself a
  new file — `fileStem`, `templateFiles` and `TEMPLATES_FOLDER` moved out of `start-from.tsx` (a
  view file) so `recents.ts` could import the one `TEMPLATES_FOLDER` constant instead of
  repeating the `"templates/"` literal it already had.
- **The two templates and the components-panel's one component had no real thumbnails**, so
  Home's Components panel and the template picker both showed "No preview yet" for every entry
  even though the rest of the page had real previews. Generated them the same way round 0
  generated the two examples' thumbnails: opened each file directly, in edit mode, in light
  theme, made a no-op edit (append then remove a trailing space inside a comment), waited for
  autosave + the 10-second-rate-limited thumbnail write, then reverted the edit — confirmed
  byte-identical to the original via a SHA-256 hash comparison of the `.yaml` files before and
  after. Three new files: `workspace/templates/qlik-cloud-customer-landscape.thumb.png`,
  `workspace/templates/qlik-talend-cloud-pipeline.thumb.png`,
  `workspace/components/qlik-cloud-tenant.thumb.png`.

**Not fixed / accepted as-is:** the remaining nits from round 0's own "not fixed" list (above)
still apply unchanged — none of round 1's findings asked to revisit them. One verifier finding
could not be exercised live: simulating a workspace-tree fetch failure to visually confirm the
single-banner fix (as opposed to reading the three call sites and confirming they agree) needs
either server-side fault injection or a `fetch` patch in place before the app's own mount-time
fetch runs, and `agent-browser`'s `network route --abort` did not intercept this app's fetch call
in this session; the fix is verified by code reading (`home-view.tsx`'s `treeFailed`,
`ComponentsPanel`'s early `null` return, `TemplatePicker`'s `tree`/`treeError` branch), not by a
screenshot of the failure state, the same limitation the round-0 verify pass already recorded for
`empty-workspace-state`.
