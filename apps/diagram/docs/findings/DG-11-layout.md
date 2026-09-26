# DG-11 — layout from spec: nested ELK, per-zone direction, notes, manual positions

Built on `diagram/integrate` c011a10d (DG-09 + DG-10 merged). Checked in Chromium through
agent-browser at 1440×900 against the app's Vite dev server (port 5189), editor pane at its
default width (the canvas pane is 710 × 844 px). Evidence: `apps/diagram/.evidence/DG-11/`
(repo-root-relative, git-ignored).

## Screenshots

| Step                    | Light                                                                    | Dark                                                   | Qlik light                                                         |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------ |
| 6a — LR, fitted         | [lr-light](../../.evidence/DG-11/lr-light.png)                           | [lr-dark](../../.evidence/DG-11/lr-dark.png)           | [lr-qlik-light](../../.evidence/DG-11/lr-qlik-light.png)           |
| 6a — LR, greyscale      | [lr-light-greyscale](../../.evidence/DG-11/lr-light-greyscale.png)       |                                                        |                                                                    |
| 6b — TB, fitted         | [tb-light](../../.evidence/DG-11/tb-light.png)                           |                                                        |                                                                    |
| 6c — private subnet TB  | [zone-tb-light](../../.evidence/DG-11/zone-tb-light.png)                 |                                                        |                                                                    |
| 6d — VPC collapsed      | [vpc-collapsed-light](../../.evidence/DG-11/vpc-collapsed-light.png)     |                                                        |                                                                    |
| 6d — VPC expanded again | [vpc-expanded-light](../../.evidence/DG-11/vpc-expanded-light.png)       |                                                        |                                                                    |
| 6e — loading panel      | [loading-light](../../.evidence/DG-11/loading-light.png)                 | [loading-dark](../../.evidence/DG-11/loading-dark.png) | [loading-qlik-light](../../.evidence/DG-11/loading-qlik-light.png) |
| 6f — ELK failed         | [error-light](../../.evidence/DG-11/error-light.png)                     | [error-dark](../../.evidence/DG-11/error-dark.png)     | [error-qlik-light](../../.evidence/DG-11/error-qlik-light.png)     |
| 6f — ELK failed, grey   | [error-light-greyscale](../../.evidence/DG-11/error-light-greyscale.png) |                                                        |                                                                    |
| 6g — `layout: manual`   | [manual-light](../../.evidence/DG-11/manual-light.png)                   |                                                        |                                                                    |

## Results

- **Fit (6a/6b):** `{ nodes: 19, outside: [] }` at LR and at TB, and again in dark, qlik-light,
  with the private subnet at TB, and after collapse (`{ nodes: 12, outside: [] }`, hidden
  children are not rendered) and expand. LR fits at zoom 0.328 (`translate(24.1px, 339.5px)
scale(0.328085)`), below React Flow's default `minZoom` 0.5 — `FIT_MIN_ZOOM` is what makes it fit.
- **Per-zone direction (6c):** with `direction: TB` on the private subnet the five children stack
  (the item's script returns `true`); edges inside the zone leave from the bottom port and enter
  on top (`followZoneDirection`).
- **Collapse (6d):** `vpc` becomes 220 × 48, `aws` shrinks from 491 px to 174 px high, edges
  re-attach to the chip; expand restores `vpc` to 789 × 415 and `aws` to 491 px.
- **Never at `{0,0}` (6e):** a per-frame probe during load recorded
  `loading, inert, opacity 0, 19 nodes at translate(0px, 0px)` → `ready, not inert, 0 nodes at {0,0}`.
  While the panel is up, `document.querySelector(".react-flow").closest("[inert]")` is the
  `h-full w-full opacity-0` wrapper and the panel is `role="status"` `aria-live="polite"`; after
  the `[DG-11]` line it is `null`.
- **Error (6f):** flow's warning (`layoutFlowElk could not run elkjs … falling back to the dagre
layout`), then `[DG-11] layout failed Error: ELK failed; flow fell back to dagre`; the pane shows
  "The diagram could not be laid out" and the canvas stays `inert` at opacity 0.
- **Manual (6g):** `[DG-11] engine=none ms=0 nodes=2`; `a` is `translate(0px, 0px)`, `b` is
  `translate(300px, 120px)`.
- **axe** on the default route (light, laid out): 0 violations, 38 passes; `color-contrast`
  incomplete (needs review, as usual for overlapping canvas layers).
- **"Maximum update depth exceeded"** (hardening question 59): never seen. An `error` listener
  and a `console.error` wrapper installed before every load stayed empty.

## Timings

`ms` is `runElk`'s own clock (it includes loading elkjs on the first run).

- **Cold** — a fresh page with the browser cache disabled (DevTools `Network.setCacheDisabled`):
  `[DG-11] engine=elk ms=157 nodes=19`. The first load of the session logged `ms=150`. The
  loading panel is up for about 270 ms (probe: first frame with the panel at ≈ 590–730 ms after
  navigation, ready at ≈ 860–1060 ms). DG-03's ≈ 1 s cold figure was not reproduced here.
- **Warm — five edits** (appending `1`…`5` to the title, one layout each), then five
  Backspaces:

  ```
  [DG-11] engine=elk ms=119 nodes=19
  [DG-11] engine=elk ms=113 nodes=19
  [DG-11] engine=elk ms=117 nodes=19
  [DG-11] engine=elk ms=111 nodes=19
  [DG-11] engine=elk ms=109 nodes=19
  [DG-11] engine=elk ms=84 nodes=19
  [DG-11] engine=elk ms=80 nodes=19
  [DG-11] engine=elk ms=82 nodes=19
  [DG-11] engine=elk ms=81 nodes=19
  [DG-11] engine=elk ms=77 nodes=19
  ```

  Five edits: min 109, max 119 ms; the ten: 77–119 ms. This run had a per-frame probe
  running in the page. Without it (steps 6b–6d): `ms=116, 74, 42, 40` (LR → TB),
  `104, 41, 38, 38` (back to LR), `95, 38, 40` and `139` (zone TB on and off), `69` (collapse,
  one pass), `81` (expand). **Warm range 38–139 ms — under the 500 ms criterion.**

## DG-06 auto-fit after ELK

After every auto layout the console shows `[DG-06] auto-fit: aws, vpc`. Measured by running
`layoutDiagram` in the page on the same measured nodes and comparing with the rendered sizes:

| Zone         | ELK          | After auto-fit | Change   |
| ------------ | ------------ | -------------- | -------- |
| `aws`        | 984 × 490.67 | 974 × 490.67   | −10 px W |
| `vpc`        | 794 × 414.67 | 789 × 414.67   | −5 px W  |
| `private`    | 752 × 220.67 | 752 × 220.67   | —        |
| `databricks` | 308 × 189    | 308 × 189      | —        |
| `snowflake`  | 308 × 192    | 308 × 192      | —        |

Only the widths of the two zones that hold a zone change, by 5 px per level: ELK's right edge
of a compound child is not DG-06's fixed point. Both writes land in the same frame (a
`MutationObserver` on the node styles sees only the final size), so nothing visibly moves.
Before layout, auto-fit also runs once on the unlaid-out graph
(`auto-fit: aws, databricks, snowflake, vpc, private`) — harmless, the canvas is hidden then.

## Remaining defects

1. **Legibility at fit.** The LR lakehouse fits at zoom 0.33 in the 710 px pane: labels are
   about 4 px high. Fitting is correct (the whole diagram is in view); readability needs DG-13's
   spacing work or a wider canvas.
2. **Zone titles truncate when a zone is as narrow as its children.** At TB, `Databricks (SaaS)`
   and `Snowflake (SaaS)` read "Databric…"/"Snowfla…"; with the private subnet at TB, its title
   reads "Private s…". ELK sizes a group to its children only. Candidate for DG-13: a minimum
   group width in `run-elk.ts` (one place, not per example).
3. **Edge labels are not in the ELK graph.** Inside the Databricks zone the "PrivateLink" pill
   overlaps a node label (LR). Labels would need to be ELK edge labels (DG-13).
4. **Fit ignores the minimap.** The fit uses plain padding; the 200 × 150 minimap at bottom-left
   can cover a node in other diagram shapes (not in the lakehouse). DG-12's `chromeFitPadding`
   owns the per-side insets.
5. **No re-fit on pane resize.** Switching to qlik-light shrinks the header (56 → 48 px); the
   diagram stays inside (`outside: []`) but is not re-centred. Out of scope here.
6. **Every keystroke re-lays out from scratch** (DG-10's `useMemo` compile). DG-12 replaces this
   with patching and a structural `layoutKey`.

## P4 library gaps (with their code comments)

1. **Per-group layout options on `layoutFlowElk`.** One `direction` for the whole graph
   (`packages/flow/src/flow-layout/layout-flow-elk.ts:40`), `groups` without options (L54), and
   the root forces `INCLUDE_CHILDREN` (L195). Worked around by decorating the ELK graph inside
   `loadEngine` (L62). Comment: `src/layout/run-elk.ts:28`. Proposed API:
   `groups: { id, children, layoutOptions?: Record<string, string> }[]` or
   `decorateGraph?: (graph: FlowElkGraph) => FlowElkGraph`.
2. **`extent: "parent"` forced on every child** (`layout-flow-elk.ts:359`). The app takes only
   position and group size from the result, so a drag can cross a zone edge (DG-06 auto-fit).
   Comment: `src/layout/layout-from-spec.ts:115`. Proposed API: `extent?: "parent" | null`
   option, default `"parent"`.
3. **`useNodesInitialized` not re-exported by flow** (flow `index.ts` L42–43 re-export only
   `useNodesState`/`useEdgesState`). Imported from `@xyflow/react`. Comment:
   `src/layout/use-diagram-layout.ts:2`. Proposed API: re-export it with the other React Flow
   hooks.
4. **No `loading`/`error` on `CanvasShell`.** The pane overlays `StatePanel` and hides the canvas
   with `opacity-0` + `inert`. Comment: `src/panes/canvas-pane.tsx:115`. Proposed API as in
   `DG-03-canvas-states.md` §1: `loading?: boolean`, `error?: ReactNode`.
5. **No bend points from `edgeRouting: "orthogonal"`.** The returned edges are the input array
   (DG-03 gap 2); the app's edges draw their own paths. Comment: `src/layout/run-elk.ts:129`.
   Proposed API: return ELK's sections as `edge.data.points` when routing is orthogonal.
6. **Misleading fallback warning** (new, minor): `warnFallback` (`layout-flow-elk.ts:140–146`)
   always asks "is the optional peer `elkjs` installed?", also when a supplied `loadEngine`
   rejects or ELK throws on the graph (seen in 6f). Proposed: word the warning from the error
   (missing module vs engine failure) and pass the cause through, e.g. `onFallback?(error)`.

## Browser-check notes (for later items)

- The loading window is about 270 ms, too short to screenshot. Holding the elkjs module request
  through the DevTools `Fetch` domain (a tiny script on the session's CDP URL) keeps the pane in
  the loading state with a normal CPU; CPU throttling works too but the screenshot often lands
  after the layout.
- Monaco: `press Space` types nothing; `press " "` types a space. One space after `layout:` was
  swallowed once while typing fast — read the line back before trusting it.
- `Meta+Shift+K` deletes the current line in Monaco (used to undo 6c).
