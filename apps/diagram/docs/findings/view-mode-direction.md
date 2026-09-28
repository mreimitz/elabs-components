# View mode and per-viewer presentation choices

View mode protects the diagram’s content and geometry. A viewer can choose direction,
card/icon style, and the technical/visual lens without changing the YAML, undo history,
autosave state, or shared thumbnail. Edit mode uses the document’s own settings and permits
writes. Sidebar file operations remain available in either mode.

## Controls and accessibility

The direction and node-style controls share one effective-value function with the canvas.
Choosing the document’s own value removes the override. An active override has a visible
“Custom” marker and a separately named “Reset to the diagram’s own setting” action.
Reset returns keyboard focus to an enabled direction control, or the lens control when the
visual lens has disabled the direction controls.

A wrapping strip below the toolbar always says “Only for you here — not saved, forgotten on
reload.” It remains visible on phones and ordinary desktop widths without squeezing the
breadcrumb. The controls have generated `aria-describedby` ids, and the compact menu also
shows the explanation. When the visual lens is active, direction and card/icon controls are
disabled with the visible reason “Applies to the technical diagram.” Disabled compact-menu
radios have reduced opacity as well as Radix disabled semantics.

## Override lifetime

`shell/view-overrides-store.ts` holds overrides in memory, keyed by workspace path or a
share link’s own content id. Different share links cannot inherit each other’s settings.
Reload forgets all overrides. Renaming or moving a file carries its override; trashing a file
forgets it.

A subscription to the diagram store observes every compile while a document is open. A
change to the file’s direction or node style drops that field’s override permanently, even
if the field subsequently changes back. Unrelated edits preserve it.

An override also records the workspace revision it was based on. A successful local write
acknowledges its new revision through `onWorkspaceFileSaved`; its compiles have already been
observed. This preserves overrides after an unrelated local edit followed by a tab switch.
Reopening a document whose revision changed externally drops its overrides conservatively:
an offscreen A–B–A change cannot be reconstructed from the final text alone. This can also
clear an override after an unrelated external edit made while the document was not open.

## Diagram write protection

`panes/canvas-pane.tsx` applies explicit read-only React Flow settings in view mode and while
presenting. The writable drag/delete callbacks are excluded and replaced with safe callbacks
so a previously mounted editor cannot leave handlers behind in React Flow’s store.

| Interaction                | Protection                                                     |
| -------------------------- | -------------------------------------------------------------- |
| Node drag or keyboard move | `nodesDraggable: false`                                        |
| Zone resizing              | Resizer visibility and callback follow the same draggable flag |
| Node/edge deletion         | `deleteKeyCode: null` and no writable deletion callback        |
| Connection or reconnection | `nodesConnectable: false`, `edgesReconnectable: false`         |
| Manual-layout writes       | Writable drag handlers are not attached                        |
| Direction/card/icon        | View controls write only to the override store                 |
| Inspector/layout controls  | Editing controls only render in edit mode                      |
| Undo/redo                  | History keyboard handler requires edit mode                    |

Pan, zoom, fit, selection, details cards, walkthroughs, zone folding, presentation, and export
remain navigation/presentation operations. They do not persist diagram changes. The canvas
has a definite height on phones in both modes. Walkthrough controls clear the bottom legend
and zoom row on narrow panes; the presentation exit button sits below the walkthrough rather
than over the title.

## Thumbnail freshness

`workspace/use-autosave.ts` schedules a light-theme thumbnail after a successful, clean save.
The capture must match the current path, source text, compiled text, and latest thumbnail
generation. It waits for the layout-ready signal and two animation frames. If layout never
becomes ready within the bounded wait, it does not capture an unsettled diagram.

A view-mode override or any transition away from the settled technical lens blocks capture.
Clearing the override, returning to technical, or entering edit mode retries a pending
capture. A newly saved document supersedes the older pending retry immediately. Freshness,
generation, and presentation conditions are checked again after rasterization, before the
thumbnail is written. Dark-theme captures remain skipped because the exporter renders in
the active page theme.

## Repeatable verification

With a dev server running in the same isolated checkout:

```sh
DIAGRAM_URL=http://localhost:5413 node apps/diagram/scripts/check-view-mode.mjs
```

The script uses the monorepo’s existing Playwright dependency in `apps/home`. It creates
throwaway workspace files, runs its own browser context, and removes the files and thumbnails
on completion. `VIEW_EVIDENCE` optionally saves screenshots and the result log.

The checks cover disk hashes and intercepted writes during viewer interaction, ordinary
widths in light/dark themes, reset focus, unrelated local edits, open/offscreen A–B–A changes,
rename continuity, thumbnail retry freshness, disabled menu semantics, and phone controls.
Share-link isolation, reload reset, and trash invalidation have regression assertions. Visual
lens motion belongs to the separate lens workstream.
