# DG-22: App shell v2 findings

**2026-09-29 behavior update:** Edit opens only the editor. Inspector opens through its
explicit control; returning to View closes it. Earlier automatic-opening behavior below
is historical.

These were found while building the Atlas shell on 2026-09-27, on `diagram/dg-22-shell-v2`
(from `diagram/atlas-integrate`, with `5eb18d1a`, `6737d97b` and `d2f7f0e2` merged in). They
were checked in the app's dev server, in Chromium through `agent-browser`.

The findings fall into two groups:

- **Library gaps** (§1–§4, and §16 from the UI review) are things `@elabs-ai/components-ui`
  lacks. Each one is marked in the code with a `// P4: library gap` comment.
- **Decisions and deviations** (§5–§15) are choices this item made that differ from the brief,
  or problems it found in other items.
- **The UI review** (§16–§17, 2026-09-27, branch `diagram/dg-22-review-fixes`) fixed the
  review's findings. §10 was rewritten then to say what the shell now does with focus.

## Library gaps

### 1. ui has no closable document tab strip (`DocumentTabs`)

- **Where:** `packages/ui/src/components/tabs/tabs.tsx:19` makes `Tabs` the Radix tabs root.
  Each trigger is a `<button>`.
- **Evidence:** a document strip needs a close control on every tab. It also needs
  middle-click to close, and a tab it can remove. A close `<button>` cannot sit inside a
  trigger `<button>`, and Radix tabs does not let you take a tab out of its roving focus
  group on your own terms.
- **App workaround:** `shell/doc-tabs.tsx` builds the strip from ui `Button`s inside a
  `role="tablist"`, and handles its own roving focus with ←/→, Home and End. The selected tab
  points to the workspace with `aria-controls`. The workspace is `role="tabpanel"`,
  `aria-labelledby` the shown tab (`shell/diagram-shell.tsx`).
- **Proposed API:** a ui `DocumentTabs` with `items` (`{ id, title, dirty }`), `value`,
  `onValueChange`, `onClose(id)`, a dirty dot that is not only colour, and an overflow
  scroller.

### 2. `DropdownMenuItem` has no destructive variant

- **Where:** `packages/ui/src/components/dropdown-menu/dropdown-menu.tsx` has no `variant`
  prop, and the word `destructive` appears nowhere in the file.
- **Evidence:** the workspace tree's row menu has a Trash item. It should look destructive
  next to New, Rename and Move.
- **App workaround:** a plain item. Trash asks first through a `ConfirmDialog` with
  `tone="destructive"` (`shell/workspace-tree.tsx`, at the Trash item's `P4: library gap`
  comment).
- **Proposed API:** `DropdownMenuItem variant="destructive"`, matching `Button`'s tone.

### 3. `EmptyState` is deprecated in favour of `StatePanel`

- **Where:** `packages/ui/src/components/empty-state/empty-state.tsx:2` and `:23` say
  "`@deprecated` Use `StatePanel kind="empty"`".
- **Evidence:** the brief's step 7 asks for `EmptyState` cards on Home, Catalog and Settings.
- **App:** Home and Catalog use `StatePanel kind="empty" titleAs="h2"`. The top bar's
  breadcrumb holds the page `h1`. Settings is a `Card` listing the shortcuts, not a
  placeholder. Since the UI review, the canvas's empty and "not a diagram" states use
  `StatePanel` as well (`panes/canvas-pane.tsx`), so the app no longer renders `EmptyState`.
- **Library:** nothing to add. This is recorded so the brief template stops naming
  `EmptyState`.

### 4. `NavUser` has no signed-out or local state

- **Where:** `packages/ui/src/components/nav-user/nav-user.tsx:19-27`. `user.name` and
  `user.email` are required, and "Sign out" always renders.
- **Evidence:** Atlas has no accounts. The shell standard says the sidebar footer must be
  `NavUser`, and the rule against invented filler text forbids a made-up person. v1 showed
  "Avery Rao, avery@example.com".
- **App workaround:** `NavUser user={{ name: "Local workspace", email: "Not signed in" }}` with
  `settingsHref="#settings"` (`shell/diagram-shell.tsx`). "Sign out" still shows, and does
  nothing.
- **Proposed API:** `NavUser` accepts `user` without `email`, and gets `signOut={false}` (or
  hides Sign out when there is no `onSignOut`), for apps with no account.

## Decisions and deviations

### 5. The editor slides at the tokens' `base` rung: 260 ms, not 200 ms

The brief says the editor slides in over 200 ms. DG-20's `motion.ts` reads the tokens'
gated scale, and there `--duration-base` is 260 ms and `--duration-fast` is 160 ms. There is
no 200 ms rung. The slide is the panels' own `flex-grow` transition, using
`MOTION_CLASS.base` (`duration-base ease-standard`). The tokens drive that transition to
about 0 under `data-motion-pref="reduced"` or the OS setting. The editor unmounts
`motionMs("base")` after it collapses, which is 0 ms when motion is reduced. The transition
is dropped while the handle is being dragged, so dragging does not lag.

### 6. v1's `#icons` hashes are not redirected to `#catalog` yet

v1's bare gallery hashes (`#icons/aws`, `#nodes`, `#legend/none`) still parse, as
`#dev/<name>` routes (`routes/use-hash.ts`, `parseRoute`). This keeps old bookmarks working
for one release. Sending `#icons/<vendor>` to `#catalog/<vendor>` waits for DG-24, which
builds the real Catalog. Until then the Catalog placeholder links to the icon sheet for the
vendor it names.

### 7. `inspectorOpen` stays in the diagram store

The brief lists `inspectorOpen` as mode-store state. DG-14's inspector and canvas read it
from `diagram-store`, and moving it would touch files outside this item. The mode store
drives it instead: `setMode("edit")` opens the inspector and `setMode("view")` closes it
(`shell/mode-store.ts`). Esc closes the inspector first, then leaves edit mode.

### 8. The store keeps `openPaths`; titles and dirty state are derived

The brief says the mode store keeps `openDocs: { path, title, dirty }[]`. The store keeps
only `openPaths`, which is persisted to localStorage. `useOpenDocs()` derives each tab's
title and dirty state live:

- **Title:** the shown document's YAML `title:`, else the tree's title, else the file name.
- **Dirty:** autosave pending, failed, or held by a conflict. Only the shown tab can be dirty.

Storing titles would only let them go stale.

### 9. Chromium takes ⌘W and ⌘⇧[ / ⌘⇧]

Chromium acts on Close tab and on switching tabs before the page sees the keys, and
`preventDefault` cannot stop it. Each of these actions also answers to ⌥ / Alt with the same
key: ⌥W, ⌥⇧[ and ⌥⇧]. `docs/keyboard.md` and the Settings page list both bindings.

### 10. H-24 (focus returns to `<body>`): where the shell hands focus on

A `Dialog` or `ConfirmDialog` with no trigger closes onto `<body>` (harvest inventory H-24),
and so does the ⌘K `CommandDialog`. A closed tab or a trashed row also takes its focused
element with it. Since the UI review, `shell/focus.ts` hands focus to a named target instead.
`focusSoon` looks the target up by id or `data-tree-path`, polls on a timer until React has
rendered it, and falls back when it never shows. The latest call wins.

What each action now does with focus, checked keyboard-only in the browser:

- **Workspace tree dialogs** (`shell/workspace-tree.tsx`). The row menu and the Workspace
  menu pass their trigger to `ask`.
  - Esc or Cancel: back to that trigger ("Actions for …" or "Workspace actions").
  - New diagram: the new document's tab, in edit mode.
  - New folder: the folder's row.
  - Rename file: the file's tab if it is open, else its row.
  - Move: the moved row.
  - Trash: the parent folder's row, or the rail's Workspace entry for a file at the root.
- **⌘K palette** (`shell/diagram-shell.tsx`, `CommandPalette`). A layout effect records what
  had focus as the palette opens.
  - Esc, or a command: back to that element, else the workspace.
  - A diagram: its tab.
  - A page under "Go to": the workspace.
- **Closing the last tab** (Delete, ⌥W or the close button): the workspace
  (`shell/mode-store.ts`, `closeTab`). The strip is gone, so no tab can take it.

Fixed afterwards by the orchestrator (`90b35a07`). **Correction (review 2):** this was
checked with a forced store flag only (`pendingClose` set directly), not with a real failed
autosave — which is why it missed should-fix 1 below. Re-checked properly this round with
real blocked writes:

- **The close-tab confirmation** (`shell/doc-tabs.tsx`). "Keep it open" and Esc go back to
  the kept tab; "Close without saving" goes to the tab shown next (`focusSelectedTab`).
- **The "Replace your edits?" confirmation** (`shell/diagram-shell.tsx`,
  `ReplaceEditsDialog`). Cancel and Esc go to the tab on screen; Replace goes to the opened
  file's tab.

H-24's proposed `returnFocusTo` on the dialogs would let the app drop most of `focus.ts`.

### 11. DG-21: `workspaceActions.open()` goes ahead after a failed save

`workspace/workspace-store.ts`, in `open`, awaits `saveNow()` but ignores its outcome. If the
write fails, or is held by a disk conflict, the next file still loads. The unsaved edits then
leave the editor. A tab switch or a click in the tree reaches this path. DG-22 does not
change `workspace-store.ts`, because it is outside this item's touches.

**Proposed fix (DG-21):** `open` returns early, or asks, when `saveNow()` gives `failed` or
`changed-on-disk`.

**Fixed in DG-22 (authorised), commit `14619be9`.** `open` now reads nothing
when the save gives `failed` or `changed-on-disk`, or the workspace is still in `conflict`.
It throws `UnsavedEditsError`, whose `path` is the document that keeps its edits. In
`app.tsx`, `syncDocRoute` then goes back to that document (a replace) and toasts that the
edits are not saved yet, so the other diagram was not opened. Seen in the browser: with the
file write forced to fail, a click on another diagram in the tree left the edited scratch
diagram on screen with its edit, one tab, and the toast. After the write worked again, the
next edit saved, and a normal switch opened the other diagram in a second tab.

**Correction (review 2, second pass):** this section used to say `syncDocRoute` "closes the
tab of the file that did not open" on this path. That call closed whichever tab `path`
named, which is sometimes a tab that already existed before the failed open (a neighbour
reached mid-close, should-fix 1 below) — closing it was the should-fix 1 bug, so the call was
removed. But removing it unconditionally left a _different_ case broken: opening a document
that was **not** already a tab (from the tree or the hash) adds its tab speculatively before
the read starts, and when the open is then refused that tab never loads and never leaves the
strip (a phantom tab, filed as a regression this round). `syncDocRoute` now tells the two
apart by whether the tab existed before this attempt, and only drops the one that did not —
with `modeActions.dropTab`, not `closeTab`, so nothing is saved or navigated for a tab that
was never shown (`shell/mode-store.ts`, `app.tsx`).

Still open: `workspaceActions.create` creates the file before it calls `open`. With unsaved
edits, the new file is on disk but not opened, and the tree toasts "could not create" with
this error's text. The file shows in the tree.

### 12. `editor-visibility.tsx` stays as a shim

DG-22 folded DG-02's "Canvas only" into the mode store: view mode is canvas only.
`io/export-menu.tsx` (DG-17) still calls `useEditorVisibility()` for its phone menu, and
that file is outside this item's touches. So `shell/editor-visibility.tsx` is now a small
reader over the mode store. It can go once DG-17's menu reads `useDocMode()`.

### 13. Found on the way

- **DG-16 Export marked a workspace file as saved.** "Save as YAML" called
  `fileActions.markSaved()`, which sets `loadedText` to the text. For a workspace file, that
  makes autosave see no edits and skip the write, while the disk still holds the old text.
  Export now marks only a document that is no workspace file, such as a share link
  (`io/document-controls.tsx`, `save`).
- **DG-18's Present button drops the path.** `presentingHash` keeps only `key=value` parts, so
  `#d/<path>` became a bare `#present`. The document route now puts the path back (no Back
  step): `#d/<path>&present` (`app.tsx`, `syncDocRoute`). Leaving presentation then returns
  to the same tab.
- **Autosave now runs while presenting.** `ShellServices` (autosave and live reload) used to
  render inside the shell, which unmounts while presenting. It now renders once from `App`,
  above every route.

### 14. Found in the step 9 browser check, and fixed

- **The inspector followed you to the next document** (`8940901c`). Opening a file from a
  document in edit mode left the inspector open over the new document's view mode, because
  `inspectorOpen` is one flag. `syncDocRoute` now matches it to the opened document's mode.
- **The save time belonged to the previous file** (`8940901c`). A file that had just opened
  showed "Saved · <time>" from the last write of another file. The time now shows only after
  the shown file's own save; a file that has just opened shows "Saved".
- **Dragging the editor shut shrank the next Edit** (`7515caf2`). The drag passes the 25 %
  minimum on its way to the edge, and that width was kept. The width at drag start is now
  restored when the drag ends in a collapse.
- **The top bar's controls overlapped** (`2adb2ebf`). At a 1,100 px window in edit mode the
  centre controls ran over Undo/Redo and the save state, because the centre group had
  `min-w-0` and the breadcrumb kept its full width. With the sidebar open the header is
  256 px narrower than the window, so a window-width switch left the full bar in 844 px. The
  centre now keeps its width, the breadcrumb truncates, and the bar measures its own width
  and folds below 1,052 px (1,100 px of window beside the rail).

### 15. Found in the step 9 browser check, not fixed (outside DG-22's touches)

- **A new diagram shows the loading outline for good** (`panes/canvas-pane.tsx`, DG-20 and
  DG-11). "New diagram" writes a title and no nodes. That text is not blank, so the empty
  state does not show, and the first layout never reports ready, so `LayoutSkeleton` stays.
  **Fixed on the integration line** (orchestrator, 2026-09-27): a compiled graph with no nodes
  shows the empty state ("Nothing to draw yet"); typing the first node mounts the canvas and
  lays it out (checked on :5195 with a title-only file).
- **"Exit presentation" covers the title** (`interaction/presentation-view.tsx`, DG-18). At
  1,440 px the button sits over the end of a long title.
- **Height-bound examples fit about 6 % smaller.** The tab strip takes 56 px of canvas
  height, so the ClickHouse and Qlik Sense examples fit at a smaller zoom than in DG-20's
  shots. The layout and the routing are unchanged. Lakehouse is width-bound and unchanged.

## UI review (2026-09-27)

### 16. `CommandDialog` does not forward cmdk's `label`

- **Where:** `packages/ui/src/components/command/command.tsx:240`. `CommandDialog` spreads its
  props onto the Radix `Dialog` root and renders `<Command filter={filter}>` with no `label`.
  `CommandInput` takes cmdk's input props, and cmdk points the input's `aria-labelledby` at its
  own label element.
- **Evidence:** in the browser, the palette's search box has
  `aria-labelledby="radix-_r_4e_"`, whose element is empty, and no `aria-label`. The
  accessibility snapshot shows `combobox [expanded=true]` with no name. The placeholder
  ("Search diagrams, pages and commands…") is not used as the name, because the label
  reference wins.
- **App:** no workaround. The palette's `CommandInput` carries a
  `// P4: library gap` comment (`shell/diagram-shell.tsx`).
- **Proposed API:** `CommandDialog` takes `label` and passes it to `<Command label>`. It could
  default to `title` when that is a string.

### 17. Decisions and notes from the review

- **Tab width stays `max-w-56`.** At a 1,440 px window with the sidebar open, four example
  diagrams take 896 of the strip's 1,184 px: each tab is 224 px and cuts its title after about
  22 characters. Hovering a tab now shows the full title and the file path, and a tree row
  shows the title and the file name. A wider cap would fit fewer tabs before the strip
  scrolls, so the cap stays.
- **Rename stays a file rename.** The menu item and the dialog say "Rename file…". The
  dialog names the diagram's title and the file it is saved as, and says the title stays.
- **A new diagram opens in edit mode without the inspector.** `workspaceActions.create`
  loads the file before the route changes, so `syncDocRoute` finds it already shown and
  does not call `setMode`. The editor opens; the inspector does not. Left as it is: the
  inspector's behaviour on Edit is the maintainer's call.
- **A new diagram edited into invalid YAML shows the empty state, not the error.** The canvas
  keeps the last compile that had a graph, and a title-only file never had one. Not changed
  (`panes/canvas-pane.tsx` is a shared file).
- **The dev server reloads the page on some workspace file moves and trashes.** Vite logged
  `page reload workspace/shellfix-folder/shellfix-two.yaml`, and focus was lost with the
  page. `server/workspace-plugin.mjs` filters workspace files in the legacy
  `handleHotUpdate`, which Vite 6 calls only for changed files, not for created or deleted
  ones. **Fixed** (`02792752`): the plugin filters in `hotUpdate`; create, move and trash
  over the API no longer reload the page (checked with a page marker and Vite's log).
- **The palette ranks "Qlik Cloud (SaaS)…" above "Home" for the query "Home".** cmdk's fuzzy
  score matches the letters across the long title. A strict substring `filter` would fix it.
  Not changed.

## UI re-review 2 (2026-09-27, branch `diagram/wave0-review2-fixes`)

Fixed should-fix 1 (closing a tab whose autosave failed could close a DIFFERENT, neighbour
tab instead, and repeat) and should-fix 2 (a dialect Atlas cannot read yet showed as "the text
is not a diagram", inviting an edit to a curated template); n3, n5, n6, n7, n9, n10, n11, n12,
n13 from the nits list. Checked against the dev server with Playwright (the repo's own copy
under `apps/docs/node_modules/playwright`, driven from a scratch script — no new dependency),
reading `activeElement`, the tab list, the route and `GET /api/workspace/file` on disk, unless
noted.

- **Should-fix 1** — real blocked writes (a Playwright network route on
  `/api/workspace/file*` returning 500), two tabs open, edited the scratch until "not saved",
  then Delete → Tab → Enter on "Close without saving". Before the fix: the OTHER tab closed,
  the scratch stayed open and dirty, focus landed on `<body>`, and the toast blamed the wrong
  document. Cause: `closeTab` (`shell/mode-store.ts`) navigated to the neighbour before the
  failed save/dirty state was cleared, `workspaceActions.open` threw `UnsavedEditsError`, and
  `app.tsx`'s error branch closed the tab the person had just tried to reach — not the one
  with the edits — and skipped re-syncing the mode. Fixed with an explicit
  `workspaceActions.discard(path)` (drops the edits in memory, never writes) that "Close
  without saving" now calls before `closeTab` navigates anywhere, plus removing the wrong
  `closeTab` call from the `UnsavedEditsError` branch and adding the missed `setMode`. Re-ran
  the same repro after the fix: the neighbour opens with its tab focused, `GET
/api/workspace/file?path=…` for the scratch still returns the text from before the edit
  (unwritten), and the last-tab variant reaches Home with focus on the workspace and opening
  another diagram works on the first try.

  **Correction (review 2, second pass):** the paragraph above checked only the doc-route
  close (the tab shown IS the route) and its last-tab variant; both hold. It missed that
  the tab strip also shows on `#home` (a background tab can sit there dirty), and on that
  route `closeTab`'s discard guard compared against `routeDocPath()` — `null` on Home — so it
  never ran: "Close without saving" confirmed from Home left the edits un-discarded, the
  "closed" document came back as "(not saved)" on the next open, and once writes recovered
  those discarded edits were **written to disk** (not "unwritten" as stated above — checked
  with real blocked writes: `sha1` of the scratch moved `adcd94fa…` → `e8608752…` →
  `f661dc14…`, the last containing the discarded text). Fixed by reading
  `workspaceStore`'s own open document instead of the route (`mode-store.ts`, `closeTab`).
  Re-verified with real blocked writes (a Playwright network route aborting the
  workspace-file `PUT`, not a forced store flag — the repo's own Playwright copy under
  `apps/docs/node_modules/playwright`, driven from a scratch script, same method as the first
  pass) in three shapes: two tabs from the doc route, the last tab (both as before), and a
  background tab closed from Home — all three now leave the file on disk untouched. The same
  pass also found and fixed a regression this
  round's earlier attempt introduced: dropping the `UnsavedEditsError` branch's `closeTab`
  call unconditionally (to stop it closing the neighbour) also stopped it dropping a tab that
  really was only speculative — opening a document that was not yet a tab, refused for the
  same reason, left a phantom tab in the strip that never loaded. See the correction under
  §11 above for the fix (`modeActions.dropTab`).

- **Should-fix 2** — opened a dialect-1 fixture; the editor's Problems panel showed
  `unsupported-version`, and the canvas showed the generic error. `panes/canvas-pane.tsx` now
  reads the first compile issue: `unsupported-version` gets its own non-error, no-Edit-button
  state ("This diagram uses a newer format…"); every other failure keeps the error kind but
  states the issue's own message. Re-checked both branches: the dialect-1 file shows the new
  copy with no Edit action (only the shell's own Edit/Done toggle remains); a bad-YAML file
  still shows "The text is not a diagram" with its own message and an Edit action.
- **n3, n5, n6, n7, n9, n10, n11, n12, n13** — each re-checked directly: a title with `/`
  (n3) creates and opens a document instead of disabling Create; Present and Export are
  disabled on a title-only document (n9); a dirty tab's accessible name reads "‹title› (not
  saved)" with the space in place (n5); the tree's load-failure panel gives a plain sentence
  and its text changes on a same-error retry so assistive tech re-announces it (n7); no
  "Missing resize handle for PanelGroup" warning on a normal load (n11); a `refreshTree()`
  failing right after a successful create/move/trash/mkdir raises no uncaught rejection (n12);
  closing the last tab hands focus to the workspace in well under the old 800 ms ceiling (n13,
  measured ~130 ms); the trash-confirmation dialog names a document by its title, not its file
  slug, when the two differ (n10). n6 (the wordmark's icon at its default size, not
  `height={20}`) was confirmed by reading the rendered chrome.

### 18. `CommandDialog` renders no `DialogDescription`

- **Where:** `packages/ui/src/components/command/command.tsx:240`. `CommandDialog` renders
  `DialogContent` and an optional `DialogTitle`, never a `DialogDescription`, and does not set
  `aria-describedby={undefined}` on `DialogContent` to opt out.
- **Evidence:** Radix logs "Missing `Description`" to the console every time the ⌘K palette
  opens.
- **App:** no workaround; commented at the call site (`shell/diagram-shell.tsx`,
  `CommandPalette`).
- **Proposed API:** `CommandDialog` takes an optional `description`, rendered as a
  `DialogDescription` (`sr-only` when there is a visible one already, as `title` is), and sets
  `aria-describedby={undefined}` on `DialogContent` when neither is given.

### 19. ui `Tree`'s accessory slot stays in the tab order

- **Where:** `packages/ui/src/components/tree/tree.tsx`, the `data-slot="tree-item-accessory"`
  span (~L406–423). It stops the accessory's click, keydown and focus from reaching the row,
  but does not remove an interactive child from the page's natural tab order.
- **Evidence:** a Tab-only pass through a tree with a per-row action (a menu trigger, in the
  accessory) stops at every row's accessory as its own tab stop, not just at the active row —
  arrow keys move the roving `tabIndex` between rows, but Tab still visits every accessory.
- **App:** `shell/workspace-tree.tsx`'s folder tree is hand-built on `SidebarMenuSub` instead
  of ui `Tree`, in part for this — its own row menu trigger is reachable, but the tree has no
  arrow-key row navigation at all yet (deferred, see below).
- **Proposed API:** a dedicated row-action slot (`node.actions`?) rendered with `tabIndex={-1}`
  by default, or documented guidance to set it on every interactive child of `accessory`.

### Deferred after review 2

Not built — recorded so a later pass has the exact ask, not a rediscovery:

- **should-fix 3** — the workspace tree has no arrow-key/roving-focus navigation between rows.
  Waits for §19 above (a ui `Tree` row-action slot) or for DG-23's own tree work.
- **n1** — renaming a file does not move focus to the tree row afterwards.
- **n2** — "New diagram" opens the editor but does not focus it.
- **n4** — a tab's and a tree row's title could use a ui `Tooltip` instead of the native
  `title` attribute (hover-only, no keyboard/touch equivalent).
- **n8** — the breadcrumb and `document.title` show the file slug for a document that cannot
  be drawn (not a diagram, or a newer format), instead of its known title.
- **n14** — a brand-new, not-yet-written document that fails to compile shows no inspector;
  left for the maintainer's list.
