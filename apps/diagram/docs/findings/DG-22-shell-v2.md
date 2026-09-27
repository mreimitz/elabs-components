# DG-22: App shell v2 findings

These were found while building the Atlas shell on 2026-09-27, on `diagram/dg-22-shell-v2`
(from `diagram/atlas-integrate`, with `5eb18d1a`, `6737d97b` and `d2f7f0e2` merged in). They
were checked in the app's dev server, in Chromium through `agent-browser`.

The findings fall into two groups:

- **Library gaps** (§1–§4) are things `@elabs-ai/components-ui` lacks. Each one is marked in
  the code with a `// P4: library gap` comment.
- **Decisions and deviations** (§5–§13) are choices this item made that differ from the brief,
  or problems it found in other items.

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
  `tone="destructive"` (`shell/workspace-tree.tsx`, at the comment near line 255).
- **Proposed API:** `DropdownMenuItem variant="destructive"`, matching `Button`'s tone.

### 3. `EmptyState` is deprecated in favour of `StatePanel`

- **Where:** `packages/ui/src/components/empty-state/empty-state.tsx:2` and `:23` say
  "`@deprecated` Use `StatePanel kind="empty"`".
- **Evidence:** the brief's step 7 asks for `EmptyState` cards on Home, Catalog and Settings.
- **App:** Home and Catalog use `StatePanel kind="empty" titleAs="h2"`. The top bar's
  breadcrumb holds the page `h1`. Settings is a `Card` listing the shortcuts, not a
  placeholder.
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

### 10. H-24 (focus returns to `<body>`) applies to the new dialogs

`ConfirmDialog` has no trigger, so when it closes, focus lands on `<body>` (harvest
inventory H-24). This affects:

- the workspace tree's rename and trash confirmations, which hand focus back themselves
  (`shell/workspace-tree.tsx:172`);
- the close-tab confirmation (`shell/doc-tabs.tsx`);
- the new "Replace your edits?" confirmation (`shell/diagram-shell.tsx`,
  `ReplaceEditsDialog`).

For the last two, the action that follows moves focus anyway: the route changes and the
workspace remounts. H-24's proposed `returnFocusTo` would cover all of them.

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
`app.tsx`, `syncDocRoute` then goes back to that document (a replace), closes the tab of the
file that did not open, and toasts that the edits are not saved yet, so the other diagram
was not opened. Seen in the browser: with the file write forced to fail, a click on another
diagram in the tree left the edited scratch diagram on screen with its edit, one tab, and
the toast. After the write worked again, the next edit saved, and a normal switch opened the
other diagram in a second tab.

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
- **"Exit presentation" covers the title** (`interaction/presentation-view.tsx`, DG-18). At
  1,440 px the button sits over the end of a long title.
- **Height-bound examples fit about 6 % smaller.** The tab strip takes 56 px of canvas
  height, so the ClickHouse and Qlik Sense examples fit at a smaller zoom than in DG-20's
  shots. The layout and the routing are unchanged. Lakehouse is width-bound and unchanged.
