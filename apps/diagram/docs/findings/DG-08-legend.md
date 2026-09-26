# DG-08 — spec-driven legend and title block

Built: `src/chrome/build-legend.ts` (pure), `src/chrome/diagram-legend.tsx`,
`src/chrome/title-block.tsx`, the `#legend` demo (`src/fixtures/legend-demo.ts`, route in
`src/app.tsx`). Evidence: `apps/diagram/.evidence/DG-08/` (repo-root-relative, gitignored).

## Gaps

### 1. `Legend` has no non-colour swatch — the main finding

- **Where:** `packages/flow/src/legend/legend.tsx:73-99` (`LegendCategorical`),
  `docs/verified-apis.md` → flow.
- **Evidence:** the categorical variant's `items` are `{ label: string; color: string }[]`
  and every item draws the same `size-2.5 rounded-full` dot with `style={{ backgroundColor:
item.color }}` — no slot for a custom mark. Owners are told apart by **border style**
  (`zoneVariants`: solid / solid+hatch / dotted / dashed, plan D3) and edge kinds by
  **marker shape + dash + glyph** (`edge-style.ts`); neither fits a colour dot, and none of
  it can be a `color` string anyway — colour is deliberately NOT the channel here (WCAG
  1.4.1, `zoneVariants`' own doc comment: "no per-owner or per-provider hue"). So
  `DiagramLegend` does not use `Legend` at all; it builds its rows from `ui` parts
  (`Text`, `Badge`) plus raw swatches that reuse the exact `cva`/style maps the real nodes
  and edges render from (`zoneVariants`, `zoneBodyVariants`, `KIND_STROKE`, `MARKER_TYPE`,
  `resolveDash`), so a swatch can never drift from what it explains.
- **Proposed API:** an item-level `swatch?: ReactNode` (or `renderSwatch?: (item) =>
ReactNode`) on `LegendCategoricalProps`, falling back to today's colour dot when unset.
  A `DiagramLegend`-style consumer would then pass `<OwnerSwatch owner={o} />` per item and
  reuse `Legend`'s heading/list chrome and `data-slot="legend"` contract instead of
  reimplementing the floating-surface shell.

### 2. `useNodes`/`useEdges` are not re-exported by flow

- **Where:** `packages/flow/src/index.ts:33-45` (re-exports `useReactFlow`,
  `useNodesState`, `useEdgesState`, but not `useNodes`/`useEdges`).
- **Evidence:** `DiagramLegend` needs the LIVE node/edge arrays (so a Backspace-delete is
  reflected without an extra render pass through the gallery view's own state), which is
  exactly what `useNodes`/`useEdges` read off the internal store; `useNodesState` only
  hands back the array a component itself is managing. Both exist on `@xyflow/react`
  (verified: `dist/esm/index.d.ts` exports `useNodes`/`useEdges`, `12.11.1`), and the app
  already depends on the engine directly, so `diagram-legend.tsx` imports them from
  `@xyflow/react` — no stop condition hit (the "take nodes/edges as props" fallback in the
  item's stop conditions was not needed).
- **Proposed API:** re-export `useNodes`/`useEdges` next to `useNodesState`/`useEdgesState`
  in the "convenience re-exports" block of `packages/flow/src/index.ts`.

### 3. Panel tab order — recorded, not fixed (per DG-03 findings §3, not this item's job)

- **Measured** on `#legend` (10 nodes/zones, 5 edges, both `Panel`s mounted): Tab visits
  the 5 edges, then the 9 focusable node/zone elements (4 zones each also contribute a
  "Collapse" `IconButton`, so 14 stops), **then the legend trigger** (`data-slot=
"diagram-legend-trigger"`, stop 20 of 23), then `ZoomControls`' three buttons (Zoom in /
  Zoom out / Fit view), then wraps to `<body>`. `TitleBlock` contributes no stop (it has no
  interactive element).
- So: **edges → nodes/zones → legend trigger → zoom controls**, i.e. the legend is the
  FIRST of the two `Panel`s in tab order (it is mounted before `ZoomControls` in
  `legend-gallery-view.tsx`) — a panel's tab position follows DOM order, not `position`.
  Consistent with DG-03 findings §3 ("edges → nodes → panels"); not something this item
  changes.

### 4. `TitleBlock` has no library part

- **Where:** `src/chrome/title-block.tsx`.
- **Evidence:** flow ships `Panel` (bare positioning) and `Legend` (its own floating-surface
  shell), but nothing for a title/description/meta block — `TitleBlock` hand-rolls the
  same `rounded-lg bg-surface-elevated/90 p-3 text-meta shadow-ring-sm backdrop-blur` shell
  `Legend` uses internally, duplicated here and in `diagram-legend.tsx`'s
  `FLOATING_SURFACE` constant.
- **Proposed API:** export that shell as a `FlowPanelSurface`/`useFlowPanelSurface`
  className string (or a thin wrapper around `Panel`) so a title block, a legend and any
  future floating chrome share one definition instead of three copies.

### 5. `ICON_INDEX` labels are wrong for two vendors (DG-04's generator, not this item)

- **Where:** `apps/diagram/public/icons/index.json` (built by
  `scripts/build-icon-index.mjs`, DG-04), read via `src/icons/register-packs.ts`.
- **Evidence:** the label is title-cased from the pack's own file name: `aws/aws` →
  `"Aws"`, `k8s/k8s` → `"K8s"`. `"K8s"` is arguably fine as a rendered word but `"Aws"` is
  not the vendor's own casing. `DiagramLegend`'s `ProvidersSection` works around it with a
  small `PROVIDER_LABEL_OVERRIDE` map (`aws` → `"AWS"`, `k8s` → `"Kubernetes"`) rather than
  changing the generator.
- **Proposed fix (DG-04's file, not touched here):** a per-vendor label override table in
  `scripts/build-icon-index.mjs` for the small set of vendors whose title-cased file name
  isn't their real name (`aws`, `k8s`, …), so every consumer of `ICON_INDEX` gets the right
  word without its own override map.

## Not a gap — noted for the next item touching these files

- Every architecture node (`arch/service`, `arch/datastore`, `arch/zone`, …) exposes two
  horizontal ports (`in:in`/`out:out`) plus two vertical ones (`in:top`/`out:bottom`,
  service/datastore/queue/external only), so an edge connecting two of them MUST set
  `sourceHandle`/`targetHandle` explicitly — unlike the `edge-gallery.ts` fixture's plain
  `FlowNode` leaves (one handle per direction, no ambiguity). `legend-demo.ts`'s `flow()`
  helper always passes `{ sourceHandle: "out:out", targetHandle: "in:in" }`; DG-12's
  compiler will need the same rule (or a per-flow port name) once it emits `arch/*` edges.

## Acceptance evidence

`apps/diagram/.evidence/DG-08/`: `legend-auto-{light,dark,qlik-light}.png`,
`legend-none-light.png`, `legend-edges-light.png`, `legend-auto-light-greyscale.png` (+
`crop-*.png` swatch/real side-by-sides), `legend-trigger-focus-before.png` /
`-after-collapse.png` (keyboard toggle, `aria-expanded` read back true → false → true),
`default-route-sanity.png` (unrelated routes unaffected). Axe (`axe-core@4.13.0`,
`axe.run()`) on `#legend`: **0 violations** in both light and dark.
