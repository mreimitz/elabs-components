# DG-12 — editor integration: debounced compile, patching, issues, markers, chrome, toggles

Built on `diagram/dg-12-editor-integration`, which starts from `diagram/integrate` with DG-09,
DG-10 and DG-11 merged. Checked in Chromium through agent-browser at 1440×900 against the app's
Vite dev server (port 5186). The canvas pane is 710 × 844 px. Evidence lives in
`apps/diagram/.evidence/DG-12/` (repo-root-relative, git-ignored).

## Screenshots

| Step                                    | Light                                                                                                | Dark                                                                 | Qlik light                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 8a — seed, fitted round the chrome      | [seed-fit](../../.evidence/DG-12/8a-seed-fit-light.png)                                              | [seed-fit](../../.evidence/DG-12/8i-seed-fit-dark.png)               | [seed-fit](../../.evidence/DG-12/8i-seed-fit-qlik-light.png)               |
| 8b — rename patched in place            | [glue renamed](../../.evidence/DG-12/8b-patch-glue-renamed-selected.png)                             |                                                                      |                                                                            |
| 8c — node added, staged, re-laid out    | [airflow](../../.evidence/DG-12/8c-airflow-added-relayout.png)                                       |                                                                      |                                                                            |
| 8c — a second added node                | [dbt](../../.evidence/DG-12/8c-second-node-dbt-after-layout.png)                                     |                                                                      |                                                                            |
| 8d — marker and Problems row            | [datastorex](../../.evidence/DG-12/8d-datastorex-marker-light.png)                                   | [error row](../../.evidence/DG-12/8i-error-row-dark.png)             | [error row](../../.evidence/DG-12/8i-error-row-qlik-light.png)             |
| 8d — bad parent, revealed by its row    | [line 86](../../.evidence/DG-12/8d-bad-parent-line86-revealed.png)                                   |                                                                      |                                                                            |
| 8e — canvas → editor                    | [postgres-rds](../../.evidence/DG-12/8e-canvas-to-editor-postgres.png)                               |                                                                      |                                                                            |
| 8e — editor → canvas                    | [msk](../../.evidence/DG-12/8e-editor-to-canvas-msk.png)                                             |                                                                      |                                                                            |
| 8e — selection survives a re-layout     | [aws after LR + Auto layout](../../.evidence/DG-12/8e-selection-survives-relayout.png)               |                                                                      |                                                                            |
| 8f — Tab out to the Problems rows       | [first row](../../.evidence/DG-12/8f-tab-exit-first-problem-row.png)                                 |                                                                      |                                                                            |
| 8f — then the resize handle             | [handle](../../.evidence/DG-12/8f-tab-exit-resize-handle.png)                                        |                                                                      |                                                                            |
| 8g — direction TB                       | [TB](../../.evidence/DG-12/8g-direction-TB-light.png)                                                | [TB](../../.evidence/DG-12/8i-TB-dark.png)                           | [TB](../../.evidence/DG-12/8i-TB-qlik-light.png)                           |
| 8g — Auto layout                        | [LR](../../.evidence/DG-12/8g-auto-layout-LR-light.png)                                              |                                                                      |                                                                            |
| 8g — Cards                              | [LR](../../.evidence/DG-12/8g-cards-LR-light.png), [TB](../../.evidence/DG-12/8g-cards-TB-light.png) |                                                                      |                                                                            |
| 8g — back to Icons                      | [LR](../../.evidence/DG-12/8g-icons-LR-back-light.png)                                               |                                                                      |                                                                            |
| 8g — `layout: manual`                   | [Auto layout disabled](../../.evidence/DG-12/8g-manual-auto-layout-disabled.png)                     |                                                                      |                                                                            |
| 8h — stale badge (bottom-centre)        | [stale](../../.evidence/DG-12/8h-stale-badge-bottom-center-light.png)                                | [stale](../../.evidence/DG-12/8h-stale-badge-bottom-center-dark.png) | [stale](../../.evidence/DG-12/8h-stale-badge-bottom-center-qlik-light.png) |
| 8h — before the move (top-centre)       | [overlapped the title](../../.evidence/DG-12/8h-stale-badge-light.png)                               |                                                                      |                                                                            |
| 8h — after undo                         | [restored](../../.evidence/DG-12/8h-after-undo-light.png)                                            |                                                                      |                                                                            |
| 8i — greyscale                          | [error state](../../.evidence/DG-12/8i-greyscale-light.png)                                          |                                                                      |                                                                            |
| 8i — top-bar focus rings (5 Tab stops)  | [rings](../../.evidence/DG-12/8i-topbar-focus-rings-light.png)                                       |                                                                      |                                                                            |
| 8i — VPC collapsed                      | [collapsed](../../.evidence/DG-12/8i-collapse-vpc-light.png)                                         |                                                                      |                                                                            |
| 8i — the collapse crash, before the fix | [blank page](../../.evidence/DG-12/8i-collapse-vpc-crash-light.png)                                  |                                                                      |                                                                            |

## Results

- **Fit clear of the chrome (binding ruling).** After every fit, no node's
  `getBoundingClientRect()` intersects a visible `.react-flow__panel` (title block, legend,
  minimap, zoom controls), and every node lies inside the pane. The check:

  ```js
  const panels = [...document.querySelectorAll(".react-flow__panel")]
    .map((p) => p.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
  const hit = (a, b) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  [...document.querySelectorAll(".react-flow__node")]
    .filter((n) => panels.some((p) => hit(n.getBoundingClientRect(), p)))
    .map((n) => n.dataset.id);
  ```

  Each theme ran seed → TB → LR → Auto layout → Cards → TB → LR → Icons. Every row reported
  `outside []`, `underPanel []`, and no child outside its zone.

  | Step            | Light and dark viewport                           | Qlik light                                        |
  | --------------- | ------------------------------------------------- | ------------------------------------------------- |
  | seed (LR)       | `translate(7.70289px, 311.947px) scale(0.344337)` | `translate(7.70289px, 318.947px) scale(0.344337)` |
  | TB              | `translate(261.843px, 69.0488px) scale(0.38708)`  | `translate(260.35px, 64.8814px) scale(0.393282)`  |
  | LR, Auto layout | same as seed                                      | same as seed                                      |
  | Cards LR        | `translate(10.2812px, 368.342px) scale(0.211809)` | `translate(10.2812px, 372.342px) scale(0.211809)` |
  | Cards TB        | `translate(196.557px, 71.0574px) scale(0.383754)` | `translate(182.657px, 64.4069px) scale(0.401961)` |
  | Icons LR        | same as seed                                      | same as seed                                      |

  Panels at 1440×900: title `745,71 411×48`, legend `745,561 175×324`, minimap
  `1225,71 200×150`, zoom controls `1329,853 96×32`. Qlik light's title block is 368×44.

- **Patch (8b).** Renaming `glue` keeps the node selected and the viewport unchanged, and logs
  no `[DG-11]` layout line.
- **Stage and lay out (8c).** Adding `airflow` gives one layout
  (`[DG-11] engine=elk ms=14 nodes=20 @262ms`). Over 58 frames, the new node was staged hidden,
  never seen at the origin, and nothing jumped before the layout (`stagedSeen: true`,
  `airflowVisibleAtOrigin: 0`, `jumpsBeforeLayout: []`). Afterwards `{ nodes: 20, outside: [] }`.
- **Markers (8d).**
  - 200 ms after typing `datastorex`: the Problems row reads "Error … Line 24, column 23",
    the textarea has `aria-invalid="true"` and `aria-describedby` points to the Tab hint, and
    the header shows "1 error".
  - The squiggle itself lands 220–302 ms after the keystroke, which is 65–147 ms after the
    150 ms debounce fires (five runs).
  - A bad parent (`unknown-parent`, 86:13) squiggles once its row is clicked, which reveals
    line 86.
- **Selection (8e).**
  - Clicking `postgres-rds` on the canvas highlights its entry (5 `bg-accent` decorations,
    lines 23–27).
  - Clicking line 31 in the editor selects `msk` on the canvas.
  - A selection survives a re-layout on both sides. A canvas-made `glue` survives TB. An
    editor-made `aws` survives LR and Auto layout (store `selectedId`, the canvas's
    `.selected` and the editor highlight all agree).
- **Keyboard (8f).**
  - With the Tab-focus chord on, Tab leaves the editor for the first Problems row, then the
    second, then the resize handle.
  - The text is unchanged (3180 characters).
- **Toggles (8g).** The toggles rewrite only their own lines: `direction: TB` on line 4 and
  `nodeStyle: card` on line 5. With `layout: manual`, Auto layout is disabled.
- **Stale (8h).** Deleting `diagram: "0"` shows "Showing the last valid diagram" after 165 ms.
  The canvas keeps its 19 nodes, the heading reads "Untitled diagram" and the toggles are
  disabled. Undo restores everything without a new layout.
- **Badge position and announcement (8h, after the ruling).** The badge now sits in an
  always-mounted `Panel position="bottom-center" role="status" aria-live="polite"`.
  - At 1440×900 it is `985,860 201×25` and intersects no other panel (qlik light `994,860 181×25`).
  - Empty, the panel is 0×0, so `chromeFitPadding` skips it. The seed viewport is
    `translate(7.70289px, 311.947px) scale(0.344337)` both before and after.
- **Zone collapse.** Every zone collapses and expands with no page error, re-lays out, and
  fits clear of the chrome:

  | Zone collapsed    | Nodes shown |
  | ----------------- | ----------- |
  | VPC               | 12          |
  | Private subnet    | 14          |
  | AWS account       | 10          |
  | Databricks (SaaS) | 17          |
  | Snowflake (SaaS)  | 17          |

- **Accessibility (8i).**
  - axe 4.13 on the default route: **0 violations** in light, dark and qlik-light (41 passes).
  - Only incomplete item: `color-contrast`, 31 nodes in light and dark, 30 in qlik light. In
    light, 26 are canvas text over the zone hatch images (`imgNode`) or overlapping labels
    (`bgOverlap`), and 5 are in the sidebar. None are in the editor, Problems list or top bar.
  - Greyscale: severity reads by icon and word (circled X "Error", i "Info"). The pressed
    segment reads by its raised fill.
  - Top-bar Tab stops: sidebar toggle, direction group, node-style group, Auto layout, theme.
    Each shows `:focus-visible` with the compound ring. Export is disabled and skipped.

## The zone-collapse loop (fixed)

**Symptom.** With the item's code as written, collapsing a zone crashed the page with
"Maximum update depth exceeded" (React names `<StoreUpdater>`) and a blank screen. Branch
HEAD (before DG-12) collapsed cleanly. Without `onSelectionChange`, DG-12 did too.

**Evidence.** A wrapper round `diagramActions.select` logged `"vpc", "null", "vpc", "null", …`
(34 calls). Tracing every write that flipped `vpc.selected`:

1. `onNodesChange select vpc true`: the click on the chevron also selects the zone.
2. `onNodesChange replace vpc selected=undefined`, 4 ms later: the **second writer**. Flow's
   `useFlowGroups().toggleCollapse` (`packages/flow/src/use-flow-groups/use-flow-groups.ts:99–101`)
   builds the collapsed graph from a `getNodes()` snapshot taken _before_ the click selected
   the zone. Its `apply` (L51–53) writes it with `setNodes(result.nodes)`.
3. The canvas's editor→canvas effect then ran for the older `"vpc"` render and wrote the zone
   selected again. React Flow reported that as a canvas selection. The effect ran again for
   `null`, and so on until React gave up.

**Fix.** Three changes, all in the app:

- `onSelectionChange` calls `select(id, "canvas")` only when the id differs from the store's.
- The store records `selectionOrigin`, and the editor→canvas effect runs only for the
  editor's selections.
- Every restage and layout write keeps the live selection (`keepSelection` in
  `state/pipeline.ts`, used by the layout hook's `apply` and by the canvas's staging).

A ref holding "the id the canvas last reported" was tried first and failed. Two canvas
changes (`vpc`, then `null`) landed before the effect ran, so the ref matched neither render.

## Library gaps (P4)

1. **CanvasShell caches measured sizes by id.**
   - _Where:_ `packages/flow/src/canvas-shell/use-measured-nodes.ts:80–81` merges each node's
     cached size into every node the app passes in.
   - _App impact:_ a restaged node arrives "measured" at its old size, and the fit uses stale
     zone boxes.
   - _Evidence:_
     - After Cards, 11 children overflowed their zones by 23–95 flow units.
     - With a DOM-size gate alone, 4 still overflowed. With the gate plus a one-frame-deferred
       re-layout, none did.
     - After TB → LR, `aws` had `measured.height 876` against `height 490.67`, and the fit put
       the diagram 144 px above centre.
   - _Workarounds:_
     - `matchesDom` in `layout/use-diagram-layout.ts`.
     - A `requestAnimationFrame` re-layout bump in `panes/canvas-pane.tsx`.
     - The fit computed from the layout's own box: `getViewportForBounds` + `setViewport`,
       run after the commit. React Flow resolves a queued `fitView` inside `setNodes` using
       `measured` (`@xyflow/react` 12.11.1 `dist/esm/index.mjs:3381`).
   - _Proposed:_ drop a cached size when a node's `type`, `data` or `width`/`height` changes,
     or when the app passes a node without `measured`. Or expose
     `invalidateMeasurements(ids?)` from CanvasShell.
2. **`toggleCollapse` writes a stale snapshot.**
   - _Where:_ `packages/flow/src/use-flow-groups/use-flow-groups.ts:51–53` and `:99–101`.
   - _Evidence:_ the loop above. The zone clicked to collapse ends up unselected.
   - _Proposed:_ apply through an updater over the live nodes, keeping `selected`, or compute
     the collapse at flush time.
3. **`fitView` cannot avoid panels.**
   - _Workaround:_ `chrome/fit-padding.ts` computes per-side px padding from the panel rects.
   - _Proposed:_ `fitViewOptions.avoid: "panels"` on CanvasShell.
4. **Engine API not re-exported by flow:** `useNodesInitialized`, `useStore`, `useStoreApi`,
   `getViewportForBounds` and the `FitViewOptions` type are imported from `@xyflow/react`
   directly (`layout/use-diagram-layout.ts`, `chrome/fit-padding.ts`).
5. **`fitBounds` padding is typed too narrowly (upstream).** `FitBoundsOptions.padding` is
   `number` (`@xyflow/system` 0.0.78 `types/general.d.ts:210–212`), yet the implementation
   passes it to `getViewportForBounds`, which takes per-side `Padding`. Hence
   `getViewportForBounds` + `setViewport`.
6. **CodeEditor's aria props miss Monaco's focus target.**
   - _Where:_ `packages/editor/src/code-editor/code-editor.tsx:65–68` (the props) and
     `:219–240` (stamped on the textarea).
   - _Evidence:_
     - Without `options={{ editContext: false }}`, Monaco 0.55 in Chromium focuses
       `DIV.native-edit-context`, with `aria-invalid` and `aria-describedby` both `null`.
     - With the option, it focuses `TEXTAREA.inputarea` with `aria-describedby="_r_p_"` and
       `aria-invalid` tracking the compile.
   - _Proposed:_ CodeEditor defaults `editContext: false` while it owns these props, or stamps
     them on the EditContext element too.
7. **ScrollArea cannot hold truncating rows.** ui `ScrollArea` wraps its content in Radix's
   `display: table` viewport child (`packages/ui/src/components/scroll-area/scroll-area.tsx:35`),
   which grows to the longest message and defeats `truncate`. The Problems list uses a
   `max-h-40 overflow-y-auto` box instead. (This is the item's own P4 note; the width was not
   re-measured here.)
8. **CodeEditor has no disclosed Tab-out.** Continues [DG-02](DG-02-shell-a11y.md); the caption
   under the editor names the chord.

## Other findings

- **Sticky-scroll Tab stops.** Once the editor is scrolled, Monaco's sticky-scroll lines
  (`span.sticky-line-content`, `tabindex="0"`) are Tab stops before the Problems rows. This
  is Monaco's own behaviour.
- **ResizeObserver message.** "ResizeObserver loop completed with undelivered notifications."
  is logged once per Cards/Icons toggle. It also appears with the item's code as written and
  is harmless.
- **YAML round trip.** A `yaml` `Document` round trip (`doc.set(…); String(doc)`) re-flows
  flow maps, moves trailing comments and adds a newline. The toggles therefore splice at
  DG-09's source-map offsets (`state/edit-text.ts`).
- **An edge covers the Private subnet chevron.** At fit zoom, the interaction path of edge
  `salesforce->s3-landing` covers that zone's collapse button (`elementFromPoint` at its
  centre hits `react-flow__edge-interaction`), so a pointer click selects the edge. Keyboard
  (focus + Enter) collapses it. DG-12 does not change edge z-order; this was not re-checked on
  the baseline.
- **The squiggle is not "200 ms after the keystroke".** The Problems row and `aria-invalid`
  are there by 200 ms. Monaco paints the squiggle 65–147 ms after the debounce fires.

## Wave-2 review additions (2026-09-26)

Library gaps found while fixing wave-2 review findings M1, M3, M7 and m1 in the canvas. The app
workarounds carry `// P4: library gap` notes at the lines named below.

9. **ZoomControls' Fit view ignores the app's fit (review M7).**
   - _Where:_ `packages/flow/src/zoom-controls/zoom-controls.tsx:75` calls
     `onClick={() => fitView()}` with no options, and `ZoomControls` takes neither
     `onFitView` nor `fitViewOptions`. P4 note at `apps/diagram/src/panes/canvas-pane.tsx:265`.
   - _Evidence:_ the review measured Fit view putting nodes under the legend and title block,
     which the chrome-aware fit (`chrome/fit-padding.ts`) keeps clear. Composing a second
     button in the app would duplicate a library control, so the app keeps `ZoomControls` as is.
     Pressing Fit view also leaves the resize re-fit (item 10) disarmed until the next layout,
     because the view no longer matches the app's last fit.
   - _Proposed:_ `onFitView?: () => void` on `ZoomControls` (the app runs its own fit), or
     `fitViewOptions?: FitViewOptions` passed to `fitView(options)`. React Flow's `fitView`
     already takes per-side px `padding`, so the second form is enough once item 3 lands.
10. **No re-fit when the canvas resizes, and no way to tell a user move from a programmatic
    one (review M1, DG-11 defect 5).**
    - _Where:_ CanvasShell re-fits only when `fitViewKey` changes
      (`packages/flow/src/canvas-shell/canvas-shell.tsx:43–59`). React Flow reports
      `onMoveStart`/`onMoveEnd` with `event.sourceEvent`
      (`@xyflow/system` 0.0.78 `dist/esm/index.mjs:2780`, `:2814`), which is `null` for
      every d3-zoom call made in code — the app's `setViewport`, and equally flow's own
      Zoom in/out buttons (`panZoom.scaleBy`) and the minimap (`scaleTo`/`setViewportConstrained`).
    - _Evidence:_ before the fix, a 390 → 1920 window resize left the Lakehouse diagram at
      zoom 0.1, 228 × 68 px in a 998 px pane (review). A `null` event cannot separate "the
      user pressed Zoom in" from "the app fitted", so the app compares the store transform with
      the viewport its last fit set (`layout/use-diagram-layout.ts:82` `sameViewport`, `:197`
      `refit`). Workaround: a `ResizeObserver` on the pane and the legend, one `refit()` per
      animation frame (`panes/canvas-pane.tsx:158–183`, P4 note at `:161`).
    - _Proposed:_ `refitOnResize?: boolean` on CanvasShell that re-runs the last fit (with its
      options) when the pane resizes, and stops once the user pans or zooms, including through
      the flow controls and minimap; or an `origin: "user" | "program"` on the move events.
11. **`Viewport` type not re-exported by flow.** Imported from `@xyflow/react` in
    `layout/use-diagram-layout.ts:18` beside the item-4 imports.
12. **"Avoid panels" must mean the nodes, not the diagram's box (refines item 3).**
    - _Where:_ `chrome/fit-padding.ts:276` `chromeFitPadding`.
    - _Evidence:_ fitting the diagram's bounding box clear of every panel wastes the empty
      corners a panel could sit over. The node-aware pass keeps only leaf-node boxes and the
      44 px zone header bands (`ZONE_HEADER_HEIGHT`) clear of each panel's painted area, and
      raised the fit zoom at 1920 × 1080 from 0.411 to 0.511 on Qlik Sense and from 0.804 to
      0.830 on ClickHouse, with no leaf node, zone header or edge label under the title block,
      status line, legend or minimap on the four examples at 1920 and 1440 in light, dark and
      Qlik Bright. A panel that paints nothing (the title column: transparent background, no
      shadow) counts as its children's boxes (`paints()`, `fit-padding.ts:111`) — a heuristic
      the library could replace with a data attribute on each floating surface.
    - _Proposed:_ `fitViewOptions.avoid: "panels"` avoids the visible node boxes (plus an
      app-supplied list of extra rects, such as zone header bands), not the bounds.
13. **`elevateNodesOnSelect` on by default lifts a selected zone over the edge labels
    (review M3).** React Flow adds 1000 to a selected node's z, its children's and its edges'
    (`@xyflow/react` 12.11.1 store default `dist/esm/index.mjs:3298`), which is exactly
    `FlowEdgeLabel`'s fixed z. The app sets `elevateNodesOnSelect={false}` on CanvasShell
    (`panes/canvas-pane.tsx:233`); the library fix is the one recorded for wave-1 B1 —
    `FlowEdgeLabel` derives its z from its edge's z plus the selection lift.
