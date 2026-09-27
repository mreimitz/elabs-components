# View-mode direction, and no port dots outside edit mode

Maintainer feedback, 2026-09-27: "changing the direction shouldn't force the user to go in
edit… only when a user wants to set the default direction for everyone who opens the diagram,
that must happen in edit mode. Also, the unused anchor points on nodes show up in view mode
when I hover the node, that's also not needed." Both fixed on `diagram/view-direction`
(worktree `.claude/worktrees/view-direction`), against `origin/main`.

## 1. Direction in view mode is a per-viewer, in-memory choice

**Design.** A new store, `shell/view-direction-store.ts`, keyed by `mode-store.ts`'s `docKey`:

- `setOverride(key, direction)` — the view-mode control's own choice, this document only.
- `noteFileDirection(key, fileDirection)` — called once per render of the file's real
  `direction:` (`canvas-pane.tsx`, via `useSyncViewDirectionWithFile`). A change from what was
  last seen for that key **drops** the override, so the canvas falls back to the new saved
  default. This covers all three ways the file's direction can change under an open override:
  the edit-mode toggle, typing the YAML directly, and (once the app polls or a share link
  reloads) a change from outside. Recommended and implemented behaviour — the alternative
  (keep the stale override) would silently show a direction the file no longer claims.
- Nothing here reaches `diagramStore`/`interactionStore`/undo — the override never marks the
  document dirty, never autosaves, and a page reload forgets it (confirmed below). Persists
  across a tab switch because the store is keyed by document, not by the currently-shown tab.

**Wiring (`panes/canvas-pane.tsx`).** `CanvasPane` computes `fileDirection` (from `spec`),
`directionOverride` (`useViewDirectionOverride(overrideKey)`), and
`effectiveDirection = viewing && directionOverride !== undefined ? directionOverride :
fileDirection`. `effectiveDirection` is passed to `DiagramCanvas` as a new `direction` prop,
which feeds `useDiagramLayout` and a small effect that bumps `layoutKey` when `direction`
changes without a `structure` change — so toggling direction re-lays-out the CURRENT nodes,
the same as an edit-mode direction change always has, without a recompile.

**Edit mode is unchanged**: the control there still calls `diagramActions.setTopLevel`
(`top-bar.tsx`), which writes `direction:` to the text for everyone. In edit mode the canvas
only ever shows the file's own direction — `viewing` gates which value `effectiveDirection`
picks.

**Scope wording.** Both the wide top bar and the compact overflow menu state the scope in the
control itself, via `TOP_BAR_LABELS` (i18n-strings convention, curly quotes, no ellipsis
needed here):

- View mode, wide bar: radio group labelled `Direction`, each option's accessible name ends
  "— this view only; the default for everyone is set in Edit mode." (verified with
  `agent-browser snapshot`, see below).
- View mode, compact menu: section heading "Direction (this view)", with a line under the
  radios reading "This view only. The default for everyone is set in Edit mode."
  (`compact-menu-direction-view-mode.png`).
- Edit mode: both surfaces drop the qualifier and go back to plain "Left to right (LR)" /
  "Top to bottom (TB)".

No new keyboard shortcut was added — there was none for direction before this change, so
none was invented for it now.

**Present and export.** No special-case code needed: "presenting" is a route-level overlay
orthogonal to per-document mode (`mode-store.ts`), and the override plumbing lives in
`CanvasPane`/`DiagramCanvas`, which Present renders too. Verified: set the qlik example to TB
in view mode, opened Present — the presented canvas is laid out TB
(`present-mode-shows-TB.png`). Export takes a DOM screenshot of whatever is currently
rendered, so it inherits the same picture; not separately screenshotted here, but there is no
code path where it could differ.

**Manual layout (`layout: manual`) parity.** `useDiagramLayout` calls `layoutManual(nodes,
edges, { direction, … })` on the same `direction` value as the ELK path
(`layout/use-diagram-layout.ts:241-244`), so a manual-layout document's port-side reassignment
(`followZoneDirection`) follows the viewer's override exactly like an ELK document's routing
does; only the node positions stay fixed, which is what "manual" means. This is a separate
concern from `layout/use-manual-layout.ts`'s `useManualLayout(spec, view)` hook (similar name,
different job): that one saves a dragged node's position back to the file in edit mode and
reads `spec.layout.direction` — the file's real value — because it is writing real state, not
showing a viewer's private choice. Read from source rather than exercised end-to-end: no
shipped example uses `layout: manual`, and driving a real React-Flow node drag through
`agent-browser`'s synthetic mouse events did not reliably cross the library's drag threshold
in this session (the node moved a few px, no `layout:` line appeared, file stayed clean per
`git status`). Flagged as unverified in the review below.

## 2. No port dots on hover outside edit mode

**Root cause.** React Flow computes each node's `isConnectable` from the canvas's
`nodesConnectable` prop and hands it to the custom node component via `NodeProps`, but stops
there — `Handle`'s own `isConnectable` prop defaults to `true` unless the node explicitly
forwards it. The app's node components never did, so setting `nodesConnectable={false}` at
the canvas level alone had no visible effect.

**Fix, two levels:**

- `panes/canvas-pane.tsx`: outside edit mode (`viewing && !presenting`), `waveProps` now
  applies `NOT_CONNECTABLE_PROPS` (`nodesConnectable: false, edgesReconnectable: false`); in
  edit mode it applies the new `CONNECTABLE_PROPS` (`nodesConnectable: true,
edgesReconnectable: true`) **explicitly** — both branches always set the two fields, never
  omit them. React Flow's own `StoreUpdater` skips any field whose incoming value is
  `undefined` and keeps the store's previous value, so an earlier version of this fix that
  omitted the keys on the edit-mode branch left the canvas stuck non-connectable after a
  view-to-edit switch (found and fixed in this session; see the round-trip check below).
- Every arch node forwards `NodeProps.isConnectable` into its ports: `nodes/actor-node.tsx`,
  `nodes/zone-node.tsx`, and `nodes/service-node.tsx`'s shared `ArchPorts`
  (used by `service-node.tsx`, `external-node.tsx`, `queue-node.tsx`, `datastore-node.tsx`,
  and the composite-mock layout).

Edit mode keeps today's look (dots on hover, drag to connect) — dragging nodes and Delete are
unrelated to this and unchanged in both modes. `nodes/port-visibility.ts`'s docstring now
names both readers of "nothing connectable" (view mode and presentation).

## Checks and evidence

Evidence under `apps/diagram/.evidence/view-direction/build/` (gitignored, main checkout).

- **DOM proof, not a screenshot substring match:** `.classList.contains('connectionindicator')`
  on every handle (a naive `className.includes('connectionindicator')` false-positives on our
  own `IDLE_PORT_CLASS` Tailwind selector, which contains that literal substring — this cost
  real debugging time in this session before the mistake was found).
  - View mode, qlik example: every handle `false` (service, datastore, zone nodes checked).
  - Edit mode, round trip view→edit→view: `true` (idle, hover-revealed) → back to `false`.
    Confirms the `StoreUpdater`-omission bug above is fixed, not just the view-mode half.
- **Screenshots:** `view-mode-hover-erp-zoomed-nodots.png` (hover, view mode — no extra dots
  on the SAP S/4HANA node's free sides), `edit-mode-hover-erp-zoomed-dots.png` (same node,
  edit mode, hover — top and bottom idle dots visible), `lakehouse-view-mode-TB-light.png` /
  `-dark.png` (second example, view-mode-only TB override, both themes, 1440×900),
  `compact-top-bar-narrow.png` + `compact-menu-direction-view-mode.png` (480×800),
  `present-mode-shows-TB.png`.
- **File never written in view mode:** `git status --short` on `apps/diagram/workspace/`
  stayed clean through the whole view-mode session (toggling direction on two files, hovering,
  switching themes, tab switches, Present). "Saved" status in the top bar did not change; no
  editor "dirty" state.
- **Edit mode still writes:** toggled qlik's direction radio in edit mode — `direction: LR`
  became `direction: TB` on disk and the bar showed a fresh "Saved · …" timestamp; restored
  with `git checkout -- apps/diagram/workspace/examples/qlik-cloud-data-gateway.yaml` (worktree
  only; `git status` clean afterwards).
- **Reload resets the override**, tab switch keeps it: covered in this session's earlier pass
  (screenshots from that pass: `after-tab-switch-keeps-TB.png`, `after-reload-resets-LR.png`,
  `after-undo-attempt.png` — undo stayed empty after toggling direction in view mode).
- `#dev/spec-check`: 37 of 37.
- `pnpm run typecheck:local` (apps/diagram): 0 errors.
- `pnpm run lint:local`: 0 errors, 12 warnings — all pre-existing, in files this change did not
  touch (`dev/spec-check-view.tsx`, `panes/editor-pane.tsx`).
- `pnpm brand-ui audit --strict apps/diagram/src` (worktree root): 0 style issues, 0
  content-slop.
- `git diff --stat -- packages/`: empty — no `packages/` changes.
- Prettier: clean on every changed file.

## Not verified

- Manual-layout direction parity is read from source (above), not driven end-to-end through a
  live drag — see "Manual layout parity" above.
