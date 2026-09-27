# View mode: read-only, plus two per-viewer choices

Maintainer ruling, 2026-09-27: "in view mode nothing should be able to change, also moving
the nodes is not allowed. Just the layout direction, if it's card or icon, and then the
change from technical to visual [a lens, built separately on `diagram/lens-switch`] — these
are the only allowed changes." This replaces the narrower "direction only" design the first
pass of this file described; that review round (`​.evidence/view-direction/review-r0/`) found
several holes in it, listed below next to their fixes. Built on `diagram/view-direction`
(worktree `.claude/worktrees/view-direction`), against `origin/main`.

## 1. Two per-viewer, in-memory choices: direction and node style

**Store.** `shell/view-overrides-store.ts` replaces the old `view-direction-store.ts`, and
generalises from one field to a small `ViewOverrides` record (`direction?`, `nodeStyle?`),
keyed per open document:

- `setOverride(key, field, value)` — the view-mode control's own choice for one field, this
  document only.
- `noteFileValues(key, file)` — called once per render of the file's real `direction:` /
  `nodeStyle:` (`canvas-pane.tsx`, `useSyncViewOverridesWithFile`). A field that changed from
  what was last seen for it **drops only that field's** open override; the other field's
  override (if any) is untouched, since the two are independent choices.
- `effectiveViewValue(viewing, override, fileValue)` is the one place both `canvas-pane.tsx`
  and `top-bar.tsx` derive the shown value — review-r0 found they used to derive it two
  different ways (`canvas-pane.tsx` gated on `viewing`, `top-bar.tsx` did not), which could
  disagree about what a viewer was looking at.
- Nothing here reaches `diagramStore`/undo/autosave — confirmed below.
- A third field (the technical/visual lens `diagram/lens-switch` is building) is a one-line
  addition to `ViewOverrides`; nothing else in this store changes shape for it.

**Keying fixes a real leak (review-r0).** `mode-store.ts`'s `docKey(path)` folds every
path-less document — every shared link opened in this tab — into one constant
(`SHARED_DOC_KEY`, `"#shared"`), which is correct for _tabs_ (one shared document per tab
slot) but was wrong for overrides: two different diagrams opened via two different share
links got the same override key, so a direction choice on one leaked onto the other. A new
`overrideDocKey(path, share)` keys a shared document by its own share id (`route.share`, the
link's own compressed content, unique per document) instead. `docKey` itself is untouched.

**Carried on rename/move.** `mode-store.ts`'s `moved(from, to)` already remapped open tabs
and modes when a file is renamed or moved; it now also calls
`viewOverrideActions.moved(follow)` with the same path-rewriter, so an open override survives
a rename (review-r0: it used to be silently dropped, reading as "the rename reset my view").

**Wiring (`canvas-pane.tsx`).** `effectiveDirection` swaps into the existing direction/layout
plumbing unchanged. `nodeStyle` is architecturally different: it is baked into
`graph.nodes[].data.variant` at compile time (`compile-arch.ts`), not carried as a separate
prop the way direction is. Recompiling the AST on every view-mode toggle would be wasteful and
would need new plumbing; instead `applyViewNodeStyle(graph, nodeStyle, keepExplicit)` remaps
`data.variant` on the already-compiled graph for every node that does not set its own
`variant:` in the YAML (`explicitVariantIds(ast)`, read directly from the AST — no compile
changes). A view-only nodeStyle override doesn't move `structureKey()` (computed from the
file's own graph), so the existing "patch in place, don't re-layout" fast path would otherwise
apply; `laidOutView` (generalised from the old `laidOutDirection`) also tracks the shown
graph's identity and bumps `layoutKey` a frame later when it changes with no structural change,
so a card/icon toggle re-lays-out the same way a direction toggle always has.

**Edit mode is unchanged.** Both controls there still call `diagramActions.setTopLevel`,
writing `direction:`/`nodeStyle:` to the text for everyone; the canvas there only ever shows
the file's own values.

## 2. View mode is read-only, at the source

Review-r0's most important finding: a view-mode node drag moved the node, fired "Switch to
manual layout?", and — if accepted — wrote `layout: manual` and every position into the file.
Root cause: `canvas-pane.tsx`'s `waveProps` merge included `useCanvasDelete()`'s and
`useManualLayout()`'s handlers in the `viewing` branch, only `presenting` (Present mode) was
locked down. Fixed by unifying the two under one `READ_ONLY_PROPS` (`nodesDraggable: false,
nodesConnectable: false, edgesReconnectable: false, deleteKeyCode: null`) and excluding
`deleteProps`/`layoutProps` from the merge entirely whenever `presenting || viewing`, not
merely overriding a couple of fields on top of them.

Every write path this session found, and how view mode blocks each one:

| Path                                                  | Where                                             | Blocked by                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drag a node                                           | React Flow `nodesDraggable`                       | `READ_ONLY_PROPS.nodesDraggable = false`                                                                                                                                                                                                        |
| "Switch to manual layout?" prompt                     | `use-manual-layout.ts`, fires from a drag         | `layoutProps` excluded from the merge in view mode — the hook is never wired to the canvas, so it never sees a drag to prompt on                                                                                                                |
| Delete (key)                                          | `use-canvas-delete.ts`, `deleteKeyCode`           | `deleteProps` excluded from the merge; `READ_ONLY_PROPS.deleteKeyCode = null`                                                                                                                                                                   |
| Connect / reconnect an edge                           | `nodesConnectable` / `edgesReconnectable`         | both `false` in `READ_ONLY_PROPS`; live-checked (see below), edge count unchanged after a drag between two handles                                                                                                                              |
| Direction / node style write                          | `top-bar.tsx` `diagramActions.setTopLevel`        | that control only renders in the `edit` branch of `top-bar.tsx`; view mode renders `ViewControls`, which only calls `viewOverrideActions.setOverride`                                                                                           |
| Layout mode radio (auto/manual), "Auto layout" button | `layout-controls.tsx`                             | only rendered in the edit-mode section of `DiagramOptionsMenu`/wide bar                                                                                                                                                                         |
| Inspector field edits                                 | `inspector-pane.tsx`                              | the Inspector toggle only renders `edit && !compact`; entering view mode sets `inspectorOpen: false` (`mode-store.ts` `setMode`); a node double-click in view mode shows the read-only hover/detail card instead (confirmed live)               |
| Undo / redo (⌘/Ctrl+Z)                                | `state/history.ts` `onHistoryKeyDown`             | now also returns early when `currentMode() !== "edit"` (previously only presenting was excluded — found in this session, not in review-r0's list)                                                                                               |
| Palette (⌘K) commands                                 | `shell/keymap.ts`, `diagram-shell.tsx`            | audited: the palette currently only ever holds "switch diagram" and "navigate to page" entries; nothing registers an editing command into it today, in either mode                                                                              |
| Paste / duplicate a node                              | —                                                 | audited: no such feature exists in this app yet (no paste/duplicate/copy-node code path was found); nothing to gate                                                                                                                             |
| Rename a node or zone                                 | `inspector-pane.tsx` title field                  | same Inspector gating as above — there is no separate rename control                                                                                                                                                                            |
| Delete/rename/move a _file_ from the sidebar          | `shell/workspace-tree.tsx` context menu           | left as is: this is the workspace file browser, available regardless of which tab (or mode) is focused, not a control on the diagram being viewed — out of this ruling's scope, which is about the open diagram's own surface                   |
| A share link pasted into the address bar              | `io/document-controls.tsx`, `hashchange` listener | pre-existing DG-16 behaviour, unchanged by this work and identical in both modes — flagged here for visibility, not fixed: it is not a _view-mode_ hole (edit mode has the same address-bar path) and changing it is a separate design question |

Zone fold/unfold, pan, zoom, fit, hover cards, selection highlight, the walk-through, Present
and Export are unchanged — none of them write to the file today, so none needed a view-mode
guard.

## 3. Home thumbnail never reflects an override

`use-autosave.ts`'s `makeThumb` now also skips when `viewOverrideActions.hasOverride(path)` is
true. This is defence in depth, not a reachable path today: a thumbnail is only ever taken
after a successful _save_, and view mode cannot save (§2) — the canvas there always shows the
file's own values regardless of any override. Kept because the guard is one line and the
alternative (relying only on "view mode can't write" holding forever) is fragile.

## 4. Top bar: node style added, and three review-r0 UI bugs fixed

- **Accessible name repeated the whole hint.** `WithTooltip`'s `label` sets both the visible
  tooltip and the control's `aria-label`; the old view-mode tooltips embedded the full "— this
  view only; the default for everyone is set in Edit mode" clause, so every radio's name was
  that whole sentence. Fixed: the view-mode controls now reuse the exact same plain option
  names edit mode uses ("Left to right (LR)", "Icons", …), and the scope note moved to a
  separate hint reachable via `aria-describedby` on the group — a shared `sr-only` span in the
  wide bar (`view-scope-hint`), a `DropdownMenuLabel` with an `id` in the compact menu
  (`direction-view-hint`, `node-style-view-hint`). Verified with an accessibility snapshot:
  each radio's name is exactly the option; `aria-describedby` resolves to the hint text.
- **390 px overflow.** Review-r0 measured the compact menu's own hint text forcing the
  dropdown past the viewport (`menuWidthWithHint: 390` vs. `211` without). The hint string is
  shorter now ("This view only. Edit sets the default for everyone.", ~51 characters, down
  from ~65) and its `DropdownMenuLabel` carries `max-w-56` so it wraps regardless of length.
  Verified at 390×844: the menu's right edge sits at 334 px, comfortably inside the viewport.
- **Double separator.** The old code rendered an unconditional separator right after the
  direction section, and in view mode (no node-style/inspector/layout block between it and
  `ExportMenuItems`, which renders its own leading separator) the two sat adjacent. Fixed by
  restructuring so the node-style section (now present in both modes) always sits between them.
  Verified: walking the open menu's DOM children, the longest run of consecutive `separator`
  elements is 1.
- **Node style, view mode.** A second `ViewToggleGroup`/`OptionsRadioSection` next to
  direction's, same wording pattern, same wide-bar/compact-menu split, using the app's
  existing icon-node/card-node glyphs and tooltips.

## Checks and evidence

Evidence under `apps/diagram/.evidence/view-read-only/build/` (gitignored, main checkout).

- `pnpm exec tsc --noEmit -p .` / `pnpm run typecheck:local` (apps/diagram): 0 errors.
- `pnpm run lint:local`: 0 errors, 12 warnings — the documented pre-existing baseline, none in
  files this change touched.
- `pnpm brand-ui audit --strict apps/diagram/src` (worktree root): 0 blocking, 2 advisory
  (em-dash density in two of this change's own doc comments; non-blocking).
- Prettier: clean on every changed file.
- `git diff --stat -- packages/`: empty against this branch's own merge point; `origin/main`
  gained unrelated `packages/charts` work after that merge, which a diff against the _current_
  `origin/main` tip also shows — not this branch's change.
- `#dev/spec-check`: 37 of 37, no console errors.
- Live browser session (`examples/lakehouse-aws.yaml`, 1440×900 and 390×844, light and dark
  menu chrome), view mode:
  - A real mouse-driven drag directly on a node's centre leaves its `transform` byte-for-byte
    identical; no `api/workspace` request fires; the file's sha256 is unchanged before/after.
  - Delete and Backspace, with the node selected: node still present.
  - A drag between two nodes' handles: edge count unchanged (14 before, 14 after), no request.
  - Double-click a node: the read-only hover/detail card opens, not an editable Inspector.
  - Direction → TB and node style → Cards, from the wide bar: canvas re-lays-out top-to-bottom
    with card nodes; "Saved" status unchanged; file unchanged on disk; reload returns to the
    file's own LR/icon.
  - Compact menu at 390 px: single separator between every section, hint wraps inside the
    menu's own width (334 px right edge, well inside 390), each radio's accessible name is
    just the option, `aria-describedby` resolves.
- Edit mode, same document: the direction radio writes `direction: TB` straight to disk
  (confirmed by reading the file); a real drag moves the node and raises "Switch to manual
  layout?" (declined, to leave the fixture clean) — both regression-free.

## Not verified live this session

- Two _different_ shared links' overrides staying isolated, and an override surviving a real
  rename/move — both fixed at the store level (`overrideDocKey`, `viewOverrideActions.moved`)
  and covered by the same generic logic already exercised for the direction-only design in
  `verify-r0/`, but not re-driven end-to-end through the browser in this pass (clipboard
  access was unavailable in this session's browser sandbox, and the share-link UI's own click
  handler was not exercised reliably here). Low risk: the mechanism is a plain key computed
  from data already read from `useRoute()`, not new plumbing.
- Cross-theme (light/dark) screenshots of the wide-bar view controls specifically — the
  compact menu was checked in both; the app's theme control in this build only exposed a
  brand picker (Default/Qlik), not a direct light/dark toggle, in the session's time budget.
