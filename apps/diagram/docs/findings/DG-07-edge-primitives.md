# DG-07 — edge primitives (`DataFlowEdge`, label cluster, zone endpoints)

Built: `src/edges/` (`DataFlowEdge` registered as `arch/flow`), the `#edges` gallery
(`src/fixtures/edge-gallery.ts`, route in `src/app.tsx`). Evidence:
`apps/diagram/.evidence/DG-07/` (repo-root-relative, gitignored).

## Summary for P4 (the harvest)

Every custom edge in this app re-solves the same four things `FlowWeightedEdge` also
solves privately: paint + selected look, marker set, label/meta cluster, motion. The
library already owns the first (`FlowEdgePath`). The proposal is one **edge group**
primitive that owns the other three once, so `DataFlowEdge` shrinks to "pick a path,
pass the axes".

```tsx
// proposed — @elabs-ai/components-flow/architecture (D8)
<FlowEdgeGroup
  path={path} labelX={labelX} labelY={labelY}
  selected={selected}
  stroke="var(--flow-edge-strong)" dash="dashed"        // style, not a dasharray literal
  markers={{ start: "open" | "closed" | undefined, end: … }} // drawn per edge, follows stroke AND selection
  animated                                            // gated on the same rule as --motion-factor
>
  <FlowEdgeGroup.Label step={2}>Load</FlowEdgeGroup.Label>   // pill, composable, no own portal
  <FlowEdgeGroup.Meta icon={<Lock />} code="HTTPS 443">hourly</FlowEdgeGroup.Meta>
</FlowEdgeGroup>
```

## Gaps

### 1. `EdgeLabelPill` cannot be part of a cluster

- **Where:** `src/edges/edge-label-cluster.tsx:20-26` (the P4 comment).
- **Evidence:** `EdgeLabelPill` wraps itself in `FlowEdgeLabel`
  (`packages/flow/src/flow-weighted-edge/edge-label-pill.tsx:43`), which portals through
  `EdgeLabelRenderer` (`packages/flow/src/flow-edge-path/flow-edge-label.tsx`). Used as a
  child of a flex column it portals out and positions itself on its own; its `children`
  are also fixed (`label` / `secondaryLabel` only), so a step number or a glyph cannot go
  inside it either.
- **Workaround:** one `FlowEdgeLabel` anchor for the whole cluster; the label is a
  `Badge variant="outline"` carrying the pill's own tokens (`bg-flow-node`,
  `border-flow-group-border`, `border-ring` when selected).
- **Proposed API:** split the pill look from its anchor — export an unanchored
  `EdgeLabelPillBody` (or give `EdgeLabelPill` an `anchor={false}`), accept `children`,
  and let `FlowEdgeGroup.Label` compose it.

### 2. Marker colour: React Flow's default is a literal grey, and a marker never follows selection

- **Where:** `src/edges/edge-style.ts:107` (`edgeMarkers` and its doc comment).
- **Evidence:** React Flow builds `<marker>` defs from the EDGE OBJECT's
  `markerEnd`/`markerStart` and passes the edge component only a `url(#…)` string
  (`FlowEdgePath` `markerEnd?: string`, `flow-edge-path.tsx`). The polyline gets
  `style={{ stroke: color, fill: color }}` inline (`@xyflow/react` `ArrowSymbol` /
  `ArrowClosedSymbol`); when the object has no `color`, `ReactFlow`'s
  `defaultMarkerColor` prop — a hard-coded grey — is used. `CanvasShell` does not set
  `defaultMarkerColor` (grep `packages/flow/src/canvas-shell`), so every built-in edge with
  a marker draws a grey arrowhead that follows no theme.
- **Workaround:** `edgeMarkers(kind, direction)` sets `color` to the kind's stroke TOKEN
  REFERENCE (`var(--flow-edge)` etc.). React Flow writes it inline, the variable resolves
  per theme — verified in the browser: marker ids
  `1__color=var(--flow-edge)&type=arrowclosed`, blue-grey in light, blue in dark
  (`01-edges-light-fit.png`, `03-edges-dark-fit.png`).
- **Still wrong:** a SELECTED edge paints `--ring` and is 1.5 px wider
  (`FLOW_EDGE_DEFAULTS`), but its marker keeps the kind colour and — because
  `markerUnits="strokeWidth"` — grows with the wider stroke (`10-edge-keyboard-focus.png`,
  the selected `secure · tls` edge: lime line, large dark arrowhead).
- **Proposed API:** `CanvasShell` defaults `defaultMarkerColor="var(--flow-edge)"`; and
  `FlowEdgePath` draws its own per-edge `<marker>` with `fill="context-stroke"` /
  `stroke="context-stroke"` (or an explicit `paintStroke`), so the head follows stroke
  AND selection without an edge-object round trip.

### 3. Stroke paint must go through `stroke`, not a `stroke-*` class

- **Where:** `src/edges/edge-style.ts:57` (`KIND_STROKE`).
- **Evidence:** `FlowEdgePath` paints `stroke` and `strokeWidth` as an inline style on the
  `BaseEdge` path (`flow-edge-path.tsx`, the `style={{ stroke: paintStroke, … }}` block)
  — by design, see its own doc comment on unlayered React Flow CSS. A `stroke-flow-edge`
  class therefore never shows. The item's `KIND_CLASS` map became `KIND_STROKE` (token
  references passed as `stroke`). Tokens used, all present in
  `packages/tokens/src/themes.css`: `--flow-edge`, `--flow-edge-strong`, `--border-strong`.
- **Proposed API:** a `tone`/`emphasis` prop on the edge group (`"default" | "strong" |
"weak" | "structural"`) mapping to those tokens, so no consumer writes `var(--…)`.

### 4. Animated flows and reduced motion

- **Where:** `src/edges/data-flow-edge.tsx:46-58` (`useFlowMotionReduced`) and `:118` (`motionStyle`).
- **Evidence (two gaps):**
  1. React Flow animates an edge via the unlayered rule `.react-flow__edge.animated path
{ animation: dashdraw … }` (`@xyflow/react/dist/style.css`). `themes.css` documents
     that its reduced-motion backstop only fires on the OS setting, not on an in-app
     `data-motion-pref="reduced"` ("KNOWN GAP" comment above the
     `prefers-reduced-motion` backstop).
  2. `useReducedMotion()` (`packages/tokens/src/theme-provider.tsx:1105`) reads the
     provider's STATE, not the `data-motion-pref` attribute the CSS gate reads — they
     disagree whenever the attribute is set by anything other than that provider.
- **Workaround:** `DataFlowEdge` owns the animation off `data.animated` (inline
  `animation: dashdraw 0.5s linear infinite`, React Flow's own keyframe and timing) and
  gates it on the attribute first (`reduced` / `full`), then `useReducedMotion()`. An edge
  object that still sets `animated: true` is cancelled with an inline `animation: none`
  under reduced motion. The dash pattern stays when still (solid + animated keeps React
  Flow's `5` dash), so "animated" is still visible as a pattern. So the DG-10 compiler
  should NOT set the edge object's `animated`; `data.animated` is enough.
- **Measured** (`animated · dashed` edge): motion on → `animation-name: dashdraw`,
  `stroke-dashoffset` 9.382 px → 6.714 px in 130 ms; `data-motion-pref="reduced"` on
  `<html>` → `animation-name: none`, offset `0px` → `0px`. Screenshots 1 s apart under
  reduced motion are byte-identical (`05-…t0.png` vs `06-…t1s.png`, `cmp` equal); the
  control pair with motion on, 0.23 s apart, differs (`08`, `09`).
- **Proposed API:** `FlowEdgePath animated` that applies the march itself and gates it on
  one shared `useMotionReduced()` that reads the attribute (or have the provider expose the
  resolved value the CSS sees).

### 5. Floating zone endpoints — helper IS exported; two small gaps

- **Where:** `src/edges/zone-endpoint.ts`.
- **What works:** `getEdgeParams` is exported (`packages/flow/src/flow-floating-edge/index.ts`),
  so the rectangle intersection is the library's, not app math. A zone end is aimed at
  the other end's HANDLE point by passing `getEdgeParams` a zero-size geometry there; a
  leaf end never floats (stays on its measured handle, per `flow-maps-editor.md`).
- **Measured:** node→zone ends at `(640, 1339)` on zone A's left border (`x 640`);
  zone→zone runs `(1000, 1340)` → `(1280, 1340)`, A's right border to B's left border.
  Collapsing A (360×200 → 220×48): node→zone end `(640, 1278)`, zone→zone start
  `(860, 1276)` — both on the collapsed chip's border (`12-zone-a-collapsed.png`).
  Resizing B from its bottom-left handle (x 1280 → 1109, 360×200 → 531×273): zone→zone
  end `(1109, 1359)` on B's new left border (`13-zone-b-resized.png`).
- **Gap a:** `useInternalNode` is not re-exported by `@elabs-ai/components-flow` (its own
  `FlowFloatingEdge` imports it from the engine) — the app imports it from `@xyflow/react`
  (`src/edges/data-flow-edge.tsx:4-6`). Same for the `EdgeMarker` type
  (`edge-style.ts:4`). Proposed: re-export both next to `EdgeProps`.
- **Gap b:** `getEdgeParams(source, target)` always floats BOTH ends on the
  centre-to-centre line. A "float one end, aim it at a point" variant
  (`getBorderPoint(node, towards: {x, y})`) would remove the zero-size-geometry trick.

### 6. The edge cannot name its own focus target

- **Where:** `src/edges/edge-style.ts:125` (`edgeAriaLabel`), set as the edge
  object's `ariaLabel` in `src/fixtures/edge-gallery.ts`.
- **Evidence:** the focusable element is React Flow's `g.react-flow__edge` (verified:
  `tabindex="0"`, `role="group"`), and its name comes only from the edge object's
  `ariaLabel` (default `Edge from <id> to <id>`). An `aria-label` on the path inside is
  not the focused element's name. So the words for every visual channel (kind, direction,
  secure, protocol, schedule, step) must be put on the edge object by the compiler —
  `edgeAriaLabel` exists for DG-10 to call. The label cluster is `aria-hidden` so the same
  words are not read twice.
- **Proposed API:** the edge group computes the name from its own parts.

### 7. Smaller notes

- `Badge` has no circular count shape: the step badge is
  `Badge` + `min-w-5 justify-center rounded-full px-1.5 tabular-nums`
  (`edge-label-cluster.tsx:51`). A `shape="count"` (or a `CountBadge`) would cover it.
- Markers are small at fit zoom (React Flow default 12.5 × stroke width); open vs closed
  heads are readable at 100 % (`04-edges-light-greyscale-kinds.png`) but faint at the
  ~0.6 fit zoom of the full gallery.
- Tab order: React Flow renders edges BEFORE nodes in the DOM, so Tab reaches all 30
  edges first (focusable list: indices 0–29 edges, 30+ nodes); the focus indicator is
  `FlowEdgePath`'s compound contour + ring (`10-edge-keyboard-focus.png`, the
  `protocol + schedule` edge; ring layer computed `opacity: 1` under `:focus-visible`).

## Marker set per kind (as built)

| kind      | stroke token         | head (end/start) | default style | glyph (always) |
| --------- | -------------------- | ---------------- | ------------- | -------------- |
| `data`    | `--flow-edge`        | closed arrow     | solid         | —              |
| `request` | `--flow-edge`        | open arrow       | solid         | —              |
| `access`  | `--flow-edge-strong` | open arrow       | solid         | `KeyRound`     |
| `control` | `--flow-edge`        | closed arrow     | **dotted**    | `Cog`          |
| `network` | `--border-strong`    | none             | solid         | —              |

`direction: back` puts the head at the start only, `both` at both ends
(`orient="auto-start-reverse"` turns the start head around). Deviation from the item: the
item's second channel for `control` was "closed arrow + dotted when no style is given" —
with an explicit style (`control · dashed`) that is indistinguishable from `data · dashed` (same head, same dash, same
token), so `control` also always shows a `Cog` glyph. Greyscale check
(`04-edges-light-greyscale-kinds.png`): all five kinds separable by head / glyph / no head.

Secure glyphs (Lucide): `tls` → `Lock`, `vpn` → `Shield`, `private-link` → `Cable`,
`sso` → `Key`; the words (`secured by TLS` …) are in the accessible name.

## Step 9 — smart-edge comparison on the DG-03 fixture (paper + measurement)

Measured in the browser on the DG-03 route after ELK: every edge's real endpoints (the
rendered path's first/last point, which are the handle centres), then the path sampled at
301 points and tested against every group rectangle that is NOT an ancestor of either
endpoint ("foreign zone"). Same endpoints, two path sources:

| direction | edges | bezier (today's `FlowEdge`)                | `getSmoothStepPath`      |
| --------- | ----- | ------------------------------------------ | ------------------------ |
| LR        | 14    | 1 — `vpc → snowflake` through `databricks` | 1 — same edge, same zone |
| TB        | 14    | 1 — `vpc → snowflake` through `databricks` | 1 — same edge, same zone |

- **`getSmoothStepPath` does not reduce foreign-zone crossings here.** The one crossing is
  the group-to-group edge DG-03 already flagged (gap 1: `FlowGroupNode`'s fixed
  top/bottom ports); an orthogonal path between the same two ports still runs through
  `databricks`. It does not add crossings either.
- **`FlowSmartEdge` would not change the count.** It is not an obstacle router: it picks
  the closest pair of MEASURED handles (`pickClosestAnchors`,
  `packages/flow/src/flow-smart-edge/smart-edge-geometry.ts:49`) and draws a bezier
  between them. `FlowNode` and `FlowGroupNode` each render exactly one target and one
  source handle, so the "closest pair" is the pair `FlowEdge` already uses — identical
  path, identical count (1/14). It helps only on nodes with a handle on every side.
- **`@tisoap/react-flow-smart-edge`, on paper (not installed):** it is an A\* router on a
  grid around node bounding boxes, falling back to a plain path when no route exists. On
  this fixture every leaf sits INSIDE its ancestor zones, so with all nodes as obstacles
  the start and end cells are already blocked and it falls back; it would only help if
  the app passed it the foreign zones alone as obstacles. Even then its paths are
  independent of ELK's layout and would ignore zone headers. Better long-term fit: ELK's
  own orthogonal routing (DG-03 gap 2 — `layoutFlowElk` discards the bend points).
