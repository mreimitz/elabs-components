# DG-03 — canvas states, contrast and focus order (wave-0 review)

Source: the wave-0 `brand-ui-reviewer` pass (2026-09-26). This file complements
`DG-03-elk-nested.md`, which covers the layout-quality gaps.

## 1. `CanvasShell` has no loading state

- **Where needed:** `src/panes/canvas-pane.tsx`.
- **Evidence:** until `layoutFlowElk` resolves, all 19 nodes sat at `{x:0,y:0}` for
  about 0.4 s warm and 0.8 s cold. Nothing had `role="status"`. `.then` had no rejection
  handler.
- **App workaround:**
  - A `pending | ready | error` state. The canvas stays mounted, so React Flow can still
    measure nodes for the post-layout fit. It is kept `invisible` behind
    `StatePanel kind="loading"`.
  - A failure shows `StatePanel kind="error"`.
- **Verified:** an iframe probe polling every 5 ms saw the status panel ("Laying out the
  diagram…") with the canvas invisible, then ready at about 416 ms. The error path was
  not exercised.
- **Proposed API:** `CanvasShell loading?: boolean` (a skeleton or status overlay that
  keeps the flow mounted and measurable) and an `error?: ReactNode` slot. This is the
  loading-state convention's "internal prop" rung.

## 2. Nested group borders are below 3:1 in light themes (WCAG 1.4.11)

- **Where:**
  - `packages/tokens/src/themes/light.css:212` (`--border-strong`), `:310` (`--canvas`)
    and `:317-318` (`--flow-group`, `--flow-group-border`);
  - `packages/flow/src/flow-group-node/flow-group-node.tsx:111`
    (`border-flow-group-border` on a `/60` wash).
- **Evidence:** a nested group has the same wash as its parent (fill contrast 1.00:1), so
  the border is the only cue. Contrast by theme:

  | Theme      | Border vs `--canvas` | Border vs the parent's wash |
  | ---------- | -------------------- | --------------------------- |
  | light      | 2.97:1               | 2.73–2.87:1                 |
  | qlik-light | 3.02:1               | 2.82:1                      |
  | dark       | 3.72:1               | 3.34:1                      |

- **Proposed fix:**
  - Either give `--flow-group-border` its own rung, at least 3:1 against the darkest
    nested wash, not just against `--canvas`;
  - or alternate the wash per nesting level, so fill becomes a second cue.
  - DG-06's `ZoneNode` was told to measure and record its own pairing.

## 3. Tab order follows React Flow's layer order

- **Evidence:**
  - The canvas has 41 tab stops: 14 edges, then 19 nodes, then 5 group toggles, then the
    zoom controls.
  - "Zoom in" is the 39th stop.
  - Edges come before the nodes they connect.
- **Proposed fix:** controls reachable first, or roving focus inside the graph. Plan §6's
  "proxied focus" contract should cover this.

## 4. Group collapse cannot be switched off and does not re-lay out

- **Where:** `packages/flow/src/flow-group-node/flow-group-node.tsx:78-80,144`. The
  toggle is always rendered.
- **Evidence:** collapsing "VPC" shrinks it to a chip at its old position. The parent
  keeps its full size, and every crossing edge converges on the chip's top handle.
- **App follow-up:** DG-11 re-runs layout when a zone's `collapsed` flips. That
  requirement has been added to the DG-11 item.
- **Proposed API:** `FlowGroupNode collapsible?: boolean`, plus an `onCollapsedChange`
  callback so the host can re-lay out.

## 5. Default edge names are raw ids

- **Evidence:** React Flow names each edge "Edge from nat to dbx-workspace". The visible
  titles and the edge label appear nowhere in the name.
- **App workaround:** `withEdgeNames()` in `canvas-pane.tsx` sets `ariaLabel` to "<source
  title> to <target title>: <label>". Verified: "Salesforce to S3 — landing: Data
  export". DG-07's `edgeAriaLabel` replaces this once DG-10 emits `arch/flow` edges.
- **Proposed API:** `FlowEdge` derives its name from the end nodes' `data.title` and its
  own `data.label`.
