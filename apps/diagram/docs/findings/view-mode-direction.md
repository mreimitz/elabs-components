# View mode: read-only, plus two per-viewer choices

Maintainer ruling, 2026-09-27: "in view mode nothing should be able to change, also moving
the nodes is not allowed. Just the layout direction, if it's card or icon, and then the
change from technical to visual [a lens, built separately on `diagram/lens-switch`] — these
are the only allowed changes." This replaces the narrower "direction only" design the first
pass of this file described; that review round (`.evidence/view-direction/review-r0/`) found
several holes in it, listed below next to their fixes. Built on `diagram/view-direction`
(worktree `.claude/worktrees/view-direction`), against `origin/main`.

**fix-r0 (this round).** A second review pass (`verify-r0`/`brand-ui-reviewer`, evidence under
`apps/diagram/.evidence/view-read-only/{verify-r0,review-r0}/`) found the branch had fallen
behind `origin/main` — which had grown its own `diagram/lens-switch` in the meantime — plus a
must-fix regression in view mode (zone resize still worked) and one in edit mode (every
words-only text edit reset the viewport). Fixed in this pass, in order of the finding they
close:

- **Merged `origin/main`.** The lens switch landed as its own `shell/lens-store.ts` (global,
  URL-hash-carried, not per-document) rather than as a third `ViewOverrides` field — §1's "a
  one-line `ViewOverrides` addition" below described a design that did not happen; the merge
  commit resolves `top-bar.tsx` and `use-autosave.ts` to show both the lens toggle and this
  file's direction/node-style controls, and to skip a thumbnail refresh for either reason.
- **Zone resize still worked in view mode.** `nodes/zone-node.tsx`'s `NodeResizer` had no
  mode gate of its own — selecting a zone showed resize handles and dragging one resized it on
  screen (in-memory only, but a visible change outside the ruling's three). Now reads
  `nodesDraggable` straight from the React Flow store (the same flag `READ_ONLY_PROPS` sets)
  and gates both `isVisible` and `onResizeEnd` on it.
- **Edit mode's viewport reset on every edit.** `laidOutView` (§1) compared the shown graph's
  object IDENTITY to decide whether a node-style override needed a re-layout, but that graph
  gets a new identity on every compile regardless — so a plain words-only edit re-laid the
  canvas out and threw away the user's pan/zoom. Fixed by comparing the effective node-style
  VALUE instead (passed down as its own prop, the same way `direction` already was).
- **Thumbnail guard ignored mode.** §3's "not a reachable path today" was wrong: once any view
  override had been set for a document in the session, an edit-mode save's thumbnail refresh
  was suppressed for the rest of the session, since the guard checked only whether an override
  was on record, never whether edit mode (which never reads one) was showing. Now gated on
  `currentMode() !== "edit"` too.
- **Overrides no longer synced via an effect.** `noteFileValues`/`useSyncViewOverridesWithFile`
  (§1) were a `useEffect`-to-sync (conventions forbid this) and only ran while `canvas-pane.tsx`
  stayed mounted — a document open only in the phone's Editor tab could miss an A→B→A file
  change. `view-overrides-store.ts` now pins each override to the file's own value at the
  moment it was set (`basis`) and derives staleness on every read instead.
- **Stale write handlers, defence in depth.** `READ_ONLY_PROPS` now also sets explicit no-ops
  for `onBeforeDelete`/`onNodeDragStop`/`onSelectionDragStop` — the same "every field explicit,
  never omitted" rule the file already documents for `nodesConnectable`, extended to the
  handlers `deleteProps`/`layoutProps` leave out of the merge in view mode.
- **View-mode canvas descriptions no longer lie.** A keyboard user selecting a node or edge in
  view mode used to hear the edit-mode sentence ("…use the arrow keys to move it…Press Delete
  to remove it…"), neither of which view mode allows. `READ_ONLY_PROPS` now supplies its own
  `ariaLabelConfig` entries for both.
- **Compact-menu hint no longer doubled.** The "This view only…" sentence rendered once under
  each of the two view-mode radio groups; it now renders once, after both, with a shared
  `useId()`-generated id both groups' `aria-describedby` point to (the wide bar's own hint
  moved to `useId()` too, for the same reason: no fixed string that a second instance of the
  slot could collide with).

## 1. Two per-viewer, in-memory choices: direction and node style

> The `basis` field this section describes was retired in the round-1 follow-ups (§5): it read
> an override set once, then changed away and back to the same value (A→B→A), as still live.
> `setOverride`/`effectiveViewValue`/`activeOverrideValue` below are current; the storage and
> staleness mechanism under them is §5's subscription-based drop, not `basis`.

**Store.** `shell/view-overrides-store.ts` replaces the old `view-direction-store.ts`, and
generalises from one field to a small `ViewOverrides` record (`direction?`, `nodeStyle?`),
keyed per open document:

- `setOverride(key, field, value, fileValue)` — the view-mode control's own choice for one
  field, this document only. Choosing `fileValue` itself — the file's own current value for
  that field — removes the override instead of recording one (§5).
- `effectiveViewValue(viewing, entry, fileValue)`/`activeOverrideValue(...)` are the one place
  both `canvas-pane.tsx` and `top-bar.tsx` derive the shown value, so the two can never
  disagree about what a viewer is looking at. The other field's override (if any) is untouched
  either way, since the two are independent choices.
- Nothing here reaches `diagramStore`/undo/autosave — confirmed below.
- A third choice — the technical/visual lens — landed on `origin/main` from `diagram/lens-switch`
  as its own `shell/lens-store.ts` instead: global and URL-hash-carried, not a per-document
  `ViewOverrides` field. The "one-line addition" this paragraph used to predict did not happen;
  see the fix-r0 note at the top of this file for how the two stores now share one top bar.

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
apply; `laidOutView` (generalised from the old `laidOutDirection`) also tracks the effective
node style's VALUE and bumps `layoutKey` a frame later when it changes with no structural
change, so a card/icon toggle re-lays-out the same way a direction toggle always has. fix-r0
F1: this used to compare the shown graph's object IDENTITY instead of the value, which broke
edit mode — that graph gets a new identity on every compile regardless of any override, so a
plain words-only edit re-laid the whole canvas out and reset the user's pan/zoom every time.

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
merely overriding a couple of fields on top of them. fix-r0 F7: excluding a slice is not quite
the same as locking it down — React Flow's `StoreUpdater` only overwrites a field whose
incoming value is not `undefined` (the exact gotcha `nodesConnectable` hit once already, hence
that field being explicit above), so `deleteProps`'s `onBeforeDelete` and `layoutProps`'s
`onNodeDragStop`/`onSelectionDragStop` could in principle strand themselves in the store across
an edit-to-view switch. `READ_ONLY_PROPS` now sets explicit no-ops for all three too.

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

## 3. Home thumbnail never reflects an override — and must still refresh once one exists

`use-autosave.ts`'s `makeThumb` skips when `viewOverrideActions.hasOverride(path)` is true —
never a viewer's own choice in the shared thumbnail. fix-r0 F2/F3: the original version of this
guard checked only whether an override was on record, with a comment claiming that was "not a
reachable path today" since a thumbnail only follows a save and view mode cannot save. That
reasoning missed the actual bug: an override set once during a view-mode visit to a document
stays on record (nothing clears it on switching to edit — clearing it there would defeat the
point, since the viewer's choice should still apply if they go back to viewing), so every LATER
edit-mode save's thumbnail refresh was silently suppressed for the rest of the session, measured
live as 2 s to a thumbnail with no override on record versus none within 25 s with one. The
guard is now `currentMode() !== "edit" && hasOverride(path)`: it still refuses a thumbnail while
something other than the file's own values could be on screen, but no longer refuses one in edit
mode, where the canvas always shows the file's own values regardless of what is on record.

## 4. Top bar: node style added, and three review-r0 UI bugs fixed

> The hint this section originally described (fixed ids `view-scope-hint`/`direction-view-hint`/
> `node-style-view-hint`, an `sr-only` wide-bar span, "This view only. Edit sets the default for
> everyone.") was replaced in the round-1 follow-ups (§5, "Visible cue, and a way back."): the
> hint is a **visible** caption now, its id comes from `useId()` (never a fixed string, so a
> second instance of the slot cannot collide with it), and the current wording lives there.

- **Accessible name kept separate from the scope note.** `WithTooltip`'s `label` sets both the
  visible tooltip and the control's `aria-label`; the view-mode toggles reuse the exact same
  plain option names edit mode uses ("Left to right (LR)", "Icons", …), never the scope note —
  so a screen reader hears just the option, never a whole sentence, as any radio's name.
- **390 px overflow.** Review-r0 measured the compact menu's own hint text forcing the dropdown
  past the viewport. Its `DropdownMenuLabel` carries `max-w-56`, wrapping the hint regardless of
  its length — still true of the longer, current wording (§5) — verified at 390×844: the menu's
  right edge stays inside the viewport.
- **Double separator.** The old code rendered an unconditional separator right after the
  direction section, and in view mode (no node-style/inspector/layout block between it and
  `ExportMenuItems`, which renders its own leading separator) the two sat adjacent. Fixed by
  restructuring so the node-style section (now present in both modes) always sits between them.
  Verified: walking the open menu's DOM children, the longest run of consecutive `separator`
  elements is 1.
- **Node style, view mode.** A second `ViewToggleGroup`/`OptionsRadioSection` next to
  direction's, same wording pattern, same wide-bar/compact-menu split, using the app's
  existing icon-node/card-node glyphs and tooltips.

## 5. Follow-ups from the round-1 review (`diagram/view-followups`)

Built on the merged `diagram/view-direction` (worktree `.claude/worktrees/view-followups`,
against `origin/main`). Eight items; each below replaces or extends the section it follows.

**A→B→A no longer resurrects a dropped override (§1's `basis` design retired).** The
`basis`-and-derive-on-read mechanism §1 describes above was itself replaced: `basis` compared
a snapshot taken when the override was SET, so setting an override, changing the file's real
value away and then back to that same value (A→B→A) left `basis` matching again and the
override read back as live — exactly the bug this item reports. `view-overrides-store.ts` now
drops a field's override the instant the file's own value for it changes at all, via a
permanent module-level subscription to `diagram-store.ts` (not a component effect, so it runs
for the app's whole life, not only while some pane happens to stay mounted) that tracks the
CURRENTLY open document's own last-seen direction/node style and compares on every change.
Verified live: `.evidence/view-followups/build/aba-repro-before.png` (a TB override on an LR
file) and `aba-repro-after.png` (edit mode sets TB then LR, back in view mode the canvas and the
top bar both show LR, no override marker).

A round-0 review of this branch (`fix-r0`, `.evidence/view-followups/{review-r0,fix-r0}/`) found
that comparison alone still missed an A→B→A that happens while the document sits in a
DIFFERENT tab, or is closed entirely (an agent or another editor rewriting the file directly):
switching away resets the live comparison to whatever the reopened document's values already
are, so it never sees the round trip, and the override survives. Comparing only the current
value cannot fix this — a round trip that nets back to the same value is indistinguishable from
no change at all by value alone. Each override now also records `workspace-store.ts`'s own
mtime for the file at the moment it was set (`revisionAtSet`, a real per-file revision marker,
not a value); reopening a key with an override on record compares its fresh mtime against that
snapshot, and a mismatch drops the whole override for that key regardless of what value the file
settled on. Verified live: an override set on a document, a background rewrite through a second
tab while it was not the open one (disk direction LR → TB → LR, net unchanged), then reopened by
hash — the override is gone and the canvas/top bar both show the file's own current value.

**Visible cue, and a way back.** The wide bar's `viewScopeHint` ("Only for you here — not saved,
forgotten on reload.") is visible text next to the controls, not only an `aria-describedby`
target; while either field is overridden, a "Custom" marker shows beside it (textual, not colour
alone — WCAG 1.4.1). Neither control's `aria-label` carries this text — it stays the plain
option name; the scope note is a sibling, tied on via `aria-describedby`. Screenshots:
`wide-bar-override-light.png`, `wide-bar-override-dark.png`, `wide-bar-reset-tooltip.png`,
`wide-bar-reset-after.png`.

A round-0 review (`fix-r0`) found the reset control itself, next to that marker, was named
"Custom" too — its own accessible name, which is what a control DOES, not a state a sibling
marker already shows. It is a `RotateCcw` `IconButton` now, split from the "Custom" text: its
name and tooltip are `TOP_BAR_LABELS.viewOverrideReset` ("Reset to the diagram’s own setting"),
with `TOP_BAR_LABELS.viewOverrideResetHint` ("Not saved, forgotten on reload.") appended as a
second tooltip line. The review also found that activating it with the keyboard dropped focus to
the page body, since the control it just fired unmounts the instant `hasOverride` goes false —
it now moves focus to the first direction option itself right after. A third finding: at header
widths just above the compact breakpoint, the marker and the always-visible caption together
squeezed the breadcrumb's file name to zero width; the caption now hides (`sr-only`, so
`aria-describedby` still names it) below `CAPTION_HIDE_BELOW`, comfortably above the compact
breakpoint itself, while the "Custom" marker and the reset control's own tooltip keep saying the
same thing on demand. Unlike the two direction/node-style groups, the reset control is never
disabled by the visual lens — resetting an override it still shows regardless is always a
harmless, useful action, in both the wide bar and the compact menu.

**No-op overrides, and trashed files forgotten.** `setOverride` now drops the field instead of
storing it when the chosen value equals the file's own current value, so choosing the file's
own value removes the "Custom" marker rather than recording a redundant override that would
only ever read back as the file's own value anyway (verified live: TB → LR when LR is the
file's own value clears "Custom"). `mode-store.ts`'s `closeTabsAt` (a trash) now also calls
`viewOverrideActions.forgetAt(path)`, dropping any override for that path or a path under it —
nothing left to apply a viewer's choice to once the file is gone.

**Visual lens disables both controls.** Neither direction nor node style draws anything while
the visual lens shows (`VisualCanvasPane` reads neither), so both `ViewToggleGroup`s disable,
and the shared visible caption swaps to `TOP_BAR_LABELS.lensDisabledReason` ("Applies to the
technical diagram."), replacing the scope hint for the duration — a disabled `ToggleGroupItem`
carries `pointer-events-none`, so a per-item tooltip line would never open to say why. The one
visible caption is the only place this reason shows; an earlier `description` prop that tried to
also append it to each item's own tooltip was dead for the same reason and has been dropped.
Screenshot: `visual-lens-disabled.png`.

**Phones drew a blank canvas in view mode (pre-existing must-fix, now fixed).** Below the `md`
breakpoint, view mode renders `CanvasWithInspector` as the lone child of `#diagram-workspace`'s
row-flex directly (edit mode instead routes through a `flex-col` `Tabs` container, which
stretches its child's width by default; a row-flex does not). With no width of its own to
inherit and no content to size from, the root computed to `width: 0`, and React Flow logged
`error#004` and drew nothing. Fixed with one `w-full` on `CanvasWithInspector`'s root
(`app.tsx`). Verified at 390×844, view and edit mode, both lenses, before (0 width, `error#004`
in the console) and after (390 px all the way down the DOM to `.react-flow`, no console errors).

**"Exit presentation" overlapped the diagram title.** The button was `top-center`, but the
title block is `top-left` with a CONTENT-sized box, not a fixed one — at 1440 px it happened to
clear the centre by ~20 px, and by 900 px it sat directly under "Exit presentation". No
breakpoint value fixes this in general, since the title's width is the title text's, not the
pane's: `canvas-overlays.tsx` now always places the button `bottom-center` (between the legend
and the zoom controls, where the title never reaches), and `step-player.tsx`'s walk-through
surface rises above that row (`mb-13`) whenever presenting, not only below `@2xl` as before
(when the button was `bottom-center` only on a narrow pane). Screenshots:
`presentation-900.png` (before, overlapping), `presentation-after.png` and
`presentation-1440-after.png` (fixed, both widths).

A round-0 review (`fix-r0`) found that last change was too narrow: replacing the walk-through
surface's `@max-2xl:mb-13` with `presenting && "mb-13"` lifted it above the legend/zoom row only
while presenting, so on any narrow pane NOT presenting (a phone in ordinary view or edit mode)
the full-width surface dropped back onto that row and covered the Legend toggle and the Zoom
in/out/Fit buttons. Both classes apply now (`@max-2xl:mb-13` for the narrow case,
`presenting && "mb-13"` for the wide-and-presenting one) — verified at 390×844 in view mode with
a walk-through open: `elementFromPoint` at each zoom button and the legend toggle returns the
control itself, not the step player.

**Thumbnails could capture mid-relayout (pre-existing should-fix, now fixed).** ELK lays a
diagram out asynchronously; `use-autosave.ts`'s `makeThumb` used to read the canvas the moment
a save landed, which could be before that layout (and the fit that follows it) painted. A new
`panes/layout-ready-store.ts` — written only by `canvas-pane.tsx`, the moment its own layout
`status` reaches `"ready"` — is awaited first, followed by two animation frames for the fit;
`makeThumb` re-checks the save is still the open document's current text after each wait,
since a newer edit may have landed while it waited. Separately: a save whose thumbnail was
skipped for an override or the visual lens (not for a dark theme or an unclean compile, neither
of which "clears") now retries once that condition ends, rather than waiting for the next edit
to trigger a fresh save.

A round-0 review (`fix-r0`) found two gaps left in that mechanism. `scheduleThumb`'s
`clearTimeout` cannot cancel a `makeThumb` run already past it and waiting on the layout or the
two frames after it, so a capture that resumes after a hidden tab regains focus could overlap a
newer one — observed as two `POST /api/workspace/thumb` calls landing the same millisecond, the
second a 404 from the exporter's own temp-file name colliding. A generation counter fixes it:
every `scheduleThumb` bumps it, and a `makeThumb` run drops itself at each `await` once a newer
one has superseded it. Separately, a thumbnail skipped because of a view-mode override was only
retried on a later override- or lens-store change — pressing Edit also ends that block
(`blockedByOverride` is gated on mode), but nothing was subscribed to mode changes, so the
thumbnail stayed stale until the next edit rather than refreshing the moment Edit was pressed.
`retryIfUnblocked` now also runs on every `mode-store.ts` change.

**Docs and comments.** This section. Review-round labels (`fix-r0`, `review-r0`) removed from
code comments in every file they were found in (`canvas-pane.tsx`, `view-overrides-store.ts`,
`mode-store.ts`, `state/override-key.ts`, `nodes/zone-node.tsx`, `workspace/use-autosave.ts`,
`interaction/canvas-overlays.tsx`) — a comment now explains the code as it stands, not the
review history that produced it. `top-bar.tsx`'s `TopBar()` had the same
`viewOverrideActions.setOverride` lambda written out twice (the wide bar's `ViewControls` call
and the compact `DiagramOptionsMenu` call); both now share `onViewDirectionChange`/
`onViewNodeStyleChange`, defined once. A stray zero-width space before `.evidence` in this
file's own intro paragraph (byte `e2 80 8b`, invisible in every renderer that showed this file
before) is also gone.

A round-0 review (`fix-r0`) found more of the same pattern still left. `view-overrides-store.ts`
and `state/override-key.ts` both had a header comment carrying build/branch history (which
branch this landed on, "the gap a component-effect design left open the first time this was
built") rather than only the rule the module follows now; both are rewritten to state the
current design alone. `onViewDirectionChange`/`onViewNodeStyleChange` themselves still repeated
the same "guard, then call `setOverride`" shape once per field; a small `setViewOverride` helper
now backs both. Separately (not a comment, the same underlying habit): `canvas-pane.tsx` wrote
`layout-ready-store.ts` from a `useEffect` keyed on `[path, status]` — copying state that had
already changed into an external store, the pattern the conventions call out by name, and one
with no cleanup, so a pane that unmounted (the visual lens swapping it out) could leave a stale
"ready" behind for a path nothing was drawing any more. `use-diagram-layout.ts`'s `useDiagramLayout`
now takes an `onSettled` callback, called at the three points `status` itself settles (a fresh
`layoutKey` starting, and the run that follows landing or failing) instead of being mirrored
after the fact; `canvas-pane.tsx` passes `layoutReadyActions.setReady` straight in, and clears
readiness in its own unmount cleanup.

**Write-path table, two rows this round found.** Neither zone resize nor the arrow-key node
nudge was in §2's table, though both were already blocked:

| Path                          | Where                               | Blocked by                                                                                                                                                                                            |
| ----------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resize a zone (drag a handle) | `nodes/zone-node.tsx` `NodeResizer` | reads `nodesDraggable` straight from the React Flow store (the same flag `READ_ONLY_PROPS` sets); `isVisible` and `onResizeEnd` both gate on it                                                       |
| Arrow-key node nudge          | React Flow's own keyboard handler   | gated on the same `nodesDraggable` flag internally (`@xyflow/react`'s `isDraggable` check) — confirmed live: selecting a node and pressing an arrow key in view mode leaves its `transform` unchanged |

**Share-link isolation: now re-driven live; rename survival still is not.** The "Not verified"
section below previously listed both as store-level-only. This round drove `overrideDocKey`'s
per-share-id keying end to end: a direction override set through a workspace tab's own "Copy
share link" is invisible to a fresh, isolated view of that same share URL (a new browser context,
no workspace path — `path === null`, keyed by `share:${id}`); a second diagram's own share link,
opened in the same tab right after, shows its own default direction, not the first share's
override; and returning to the first share URL in that same tab still shows its override,
untouched by the second. `moved`'s carry-over on rename is unchanged from before — exercised by
the store's own logic (`view-overrides-store.ts`, `mode-store.ts`) but not re-driven through the
browser in this round either, since this build's File menu exposes no rename action to drive it
through (Import YAML…, Export YAML, Copy share link only).

## Checks and evidence (`diagram/view-direction`, before the round-1 follow-ups)

Evidence under `apps/diagram/.evidence/view-read-only/build/` (gitignored, main checkout). This
list is that earlier round's own build — §5 and the round-0 fixes above landed later, on
`diagram/view-followups`, with their own fresh run below.

- `pnpm exec tsc --noEmit -p .` / `pnpm run typecheck:local` (apps/diagram): 0 errors.
- `pnpm run lint:local`: 0 errors, 12 warnings — the documented pre-existing baseline, none in
  files this change touched.
- `pnpm brand-ui audit --strict apps/diagram/src` (worktree root): 0 blocking, 2 advisory
  (em-dash density in two of this change's own doc comments; non-blocking).
- Prettier: clean on every changed file.
- `git diff --stat -- packages/`: empty against this branch's own merge point.
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
  layout?" (declined, to leave the fixture clean). A round-0 review found this claim was wrong
  for a THIRD kind of edit-mode change this file did not test here: a words-only text edit (no
  direction/node-style/drag involved) reset the canvas's zoom and pan on every keystroke-level
  compile, via the `laidOutView` identity bug §1 describes — fixed there, and re-checked with an
  A/B: zoom in, edit a node's title through the Inspector, viewport transform unchanged.

## Checks and evidence, round-0 fixes (`diagram/view-followups`, `fix-r0`)

Evidence under `apps/diagram/.evidence/view-followups/fix-r0/` (gitignored, main checkout).

- `pnpm run typecheck:local` (apps/diagram): 0 errors.
- `pnpm run lint:local`: 0 errors, 11 warnings, all pre-existing and in files this round did not
  touch (`dev/spec-check-view.tsx`, `panes/editor-pane.tsx`).
- `pnpm brand-ui audit --strict apps/diagram/src` (worktree root): 0 blocking, 1 advisory
  (em-dash density, `top-bar.tsx:661`; pre-existing, non-blocking).
- Prettier: clean on every file this round changed.
- `git status --porcelain packages/`: empty.
- No absolute `/Users/…` paths in any file this round changed.
- `#dev/spec-check`: 75 of 75 fixtures pass (`04-spec-check-75of75.png`).
- `#dev/lens-check`: 4 of 4 examples derive a non-empty, deterministic visual lens
  (`03-lens-check-4of4.png`).
- F1 (step-player regression): 390×844 and 900×700, view mode, a walk-through open —
  `elementFromPoint` at the Legend toggle and the Zoom in/out/Fit view buttons all resolve to the
  control itself, never the step player or the "End walk-through" button
  (`01-phone-view-stepplayer-fixed.png`, `02-900-presenting-check.png`); 1024×800 edit mode with
  the inspector open, same result.
- F2 (reset naming/focus): keyboard-focusing the wide bar's reset `IconButton` and activating it
  with Enter moves focus to the first direction toggle option, not the page body.
- F3 (breadcrumb squeeze): swept header widths 600–1450 px with an override active; the
  breadcrumb's `h1` stays ≈170–197 px wide throughout (never squeezed toward zero), and the
  scope caption's `sr-only` class toggles exactly at `CAPTION_HIDE_BELOW` (1352 px header width)
  as designed (`05-1200-override-caption-hidden.png`, `06-1450-override-caption-visible.png`).
- F4 (A→B→A staleness): a true round trip — override set to TB while the file's own direction was
  LR, the file rewritten directly on disk to TB and back to LR (net unchanged) while the document
  was the _non-active_ tab, then reopened by hash — dropped the override and showed the file's own
  LR, which a value-only comparison would have missed since the value returned to what it started
  as. A single external edit (no round trip) while backgrounded also drops the override, confirming
  the mtime check fires on any real disk change, not only a detectable value change.
- Share-link isolation: a direction override set through a workspace tab's "Copy share link" does
  not appear in a fresh, isolated view of that same share URL (new browser context, `path ===
null`); a second diagram's share link opened in the same tab shows its own default, unaffected
  by the first; returning to the first share URL in that tab still shows its override, untouched
  by the second.

## Not verified live this session

- An override surviving a real rename/move, fixed at the store level
  (`viewOverrideActions.moved`, called from `mode-store.ts`) and covered by the same generic
  logic already exercised for the direction-only design in `verify-r0/`, but not re-driven
  end-to-end through the browser: this build's File menu has no rename action (Import YAML…,
  Export YAML, Copy share link only), so there was no UI path to drive it through. Low risk:
  the mechanism is a plain key rewrite over the same two records `setOverride`/`clear` already
  write. (Two different shared links' overrides staying isolated — the other half of this bullet
  in earlier rounds — was re-driven live this round; see §5's "Share-link isolation" paragraph.)
- Cross-theme (light/dark) screenshots of the wide-bar view controls specifically — the
  compact menu was checked in both; the app's theme control in this build only exposed a
  brand picker (Default/Qlik), not a direct light/dark toggle, in the session's time budget.
