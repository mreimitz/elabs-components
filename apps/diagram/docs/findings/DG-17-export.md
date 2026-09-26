# DG-17 — export: library gaps and measurements

Measured while hardening DG-17 (2026-09-26) against `diagram/integrate` at `de58eeb6`, in the
app's dev server (Chromium through `agent-browser`, 1280 × 577 viewport) on the lakehouse
example (19 nodes and zones, 14 edges, 594 elements in the canvas).

## 1. `html-to-image` is too slow and too large for this canvas

- **What was tried:** `html-to-image@1.11.11` (`toSvg` / `toPng` on the `.react-flow`
  element, with a `filter` for the minimap and controls).
- **Evidence:** it copies every computed property of every element, and Chromium lists 2463
  of them, 1991 of which are custom properties (the token layer). One export of the
  lakehouse canvas took 4568 ms and produced an SVG data URL of 80,425,410 characters.
- **What the app does instead:** `io/export.ts` writes only the properties that differ from
  the browser's defaults for that tag (read once per tag in an empty sandbox frame) and,
  for inherited properties, from the parent. The same export takes about 100 ms for the
  picture and 60 ms for a 2× PNG; the SVG is about 340 KB with the Inter face embedded.
  The dependency was not added.

## 2. `CanvasShell` has no export API

- **Where:** `packages/flow/src/canvas-shell/canvas-shell.tsx` (the `bg-canvas` wrapper at
  `:148`, `Background` at `:158`); `canvas-shell/index.ts:1` exports only `CanvasShell` and
  its props.
- **Evidence:** the app has to find the canvas by `[data-slot="canvas-shell"] .react-flow`,
  clone it, and know React Flow's class names for what to leave out (`__minimap`,
  `__controls`, `__handle`, `__selection`, `__edge-interaction`).
- **App workaround:** `io/export.ts` (`liveCanvas`, `LEFT_OUT`).
- **Proposed API:** `useCanvasExport()` from flow, returning `toSvg(options)` and
  `toPng(options)` that draw the flow graph as real SVG (edges are already SVG; nodes as
  `foreignObject` or a node-level `renderForExport`), with `include` / `exclude` selectors
  for panels. A true vector SVG (section 5) belongs there.

## 3. Selection is painted from React props, so a DOM clone carries it

- **Where:** flow `FlowNodeCard` (`packages/flow/src/flow-node-card/flow-node-card.tsx:51`,
  `selected && "ring-2 ring-ring"`); flow `FlowEdgePath`
  (`packages/flow/src/flow-edge-path/flow-edge-path.tsx:128-131`, an inline `stroke` of
  `FLOW_EDGE_DEFAULTS.selectedStroke` and a wider `strokeWidth`); the app's own edge label
  cluster (`apps/diagram/src/edges/edge-label-cluster.tsx:67`, `border-ring`).
- **Evidence:** with S3 — curated selected, the clone's card had
  `oklch(0.875 0.148 116.5) 0px 0px 0px 2px` in its `box-shadow`; with an edge selected, its
  path had `stroke: var(--ring); stroke-width: 3`.
- **App workaround:** `io/export.ts` `unselect()` removes the ring classes and puts the
  edge's resting stroke back (`KIND_STROKE[kind]`, `FLOW_EDGE_DEFAULTS.strokeWidth`). It has
  to know each component's selected look. Checked: a selected node and a selected edge both
  export exactly like their unselected neighbours.
- **Proposed fix:** paint selection from a `[data-selected]` / `.selected` selector in CSS
  (as React Flow's own class is), so an exporter can strip one attribute; or the export API
  of section 2 renders with `selected: false`.

## 4. The charts exporter's font and XML helpers are internal

- **Where:** `packages/charts/src/chart-frame/export-fonts.ts:182` (`embedExportFonts`) and
  `export-layer.tsx:343` (`sanitizeXml`). Neither is exported from `chart-frame/index.ts`
  (`:6-17` export only `buildExportSvg`, `composeSvg`, `findChartSvg`, `serializeSvg` and
  types), and the diagram app does not depend on charts.
- **App workaround:** `io/export.ts` has its own `fontCss()` (the `@font-face` rules for the
  families and code points the picture uses, as data URLs) and `XML_ILLEGAL`.
- **Proposed fix:** move both into ui (or a small shared export module) so charts, flow and
  the app share one font embedder.

## 5. The SVG is a picture of HTML, which only browsers draw

- **Evidence:** the SVG wraps the canvas in `<foreignObject>`. Chromium draws it (checked:
  the saved `.svg` decodes as an image at 2034 × 957). Figma, PowerPoint, Keynote and
  Illustrator do not render `foreignObject` HTML; they show it blank or drop it. This is
  from their documented limits, not tried here.
- **App handling:** the SVG's toast says so ("Opens in any browser; slide tools draw it
  blank, so use PNG for slides."). Copy as SVG is not offered.
- **Proposed fix:** the flow export API of section 2.

## 6. `getNodesBounds` / `getViewportForBounds` are not needed

- flow does not re-export React Flow's `getNodesBounds` or `getViewportForBounds`, and it
  does not need to for this: the Export menu sits in the top bar, outside
  `ReactFlowProvider`, and the bounds must include edge labels, which node bounds miss.
  `io/export.ts` `drawnBox()` measures the drawn elements' rectangles and converts them to
  flow units with the viewport's transform.

## 7. Browsers not checked

- **Safari:** WebKit has tainted a canvas after drawing an SVG image that contains
  `foreignObject`, which makes `toBlob` throw. If it still does, PNG and Copy as PNG fail
  there with the "Could not export the diagram" toast; SVG still works. Not verified.
- **Firefox:** not run.

## 8. Picture faithfulness rules found on the way

Each of these showed up as a visible defect in a Chromium PNG and is handled in
`io/export.ts` (`styleReader().declarations`, `keepOneLine`, `inlineStyles`):

- A border, outline or column rule written without its width reads as `medium` (3 px); a
  line is written whole (width and style) or not at all, and not at all when its style is
  `none`.
- A `<button>` has a UA border; a button with none gets `border-*-style: none`.
- A form control does not inherit its colour and font; it writes all of them.
- The stage's own `right` / `bottom` offsets must be cleared, or the picture shifts.
- Every width is fixed at its live value, and the picture draws text a hair wider than the
  page. Text on one line on the page is kept on one line, and text the page shows whole
  may overflow its box by a pixel rather than wrap or end in "…" (the title in qlik-light,
  set in Source Sans 3, lost its second line before this).
- An icon painted as a CSS mask (`ServiceLogo`'s `mask-image: url(/icons/…)`, the zone-header
  provider logos) keeps a remote URL the picture cannot load and draws as a solid square;
  every remote `url()`, inline or in the pseudo-element rules, becomes a `data:` URL
  (`embedCssUrls`), and a file that cannot be fetched keeps its URL.

## 9. `DropdownMenuSubTrigger` does not size an icon

- **Where:** `packages/ui/src/components/dropdown-menu/dropdown-menu.tsx:13-32`. The
  sub-trigger has no `[&_svg]:size-4` and no gap, unlike `DropdownMenuItem` (`:142`).
- **Evidence:** the compact top bar's "Export" submenu (re-checked at `90aaa41f`) with an
  `ImageDown` icon drew it at lucide's default 24 px, touching the label.
- **App choice:** the sub-trigger carries text only (`io/export-menu.tsx`,
  `ExportMenuItems`).
- **Proposed API:** the sub-trigger sizes its icons and spaces them like `DropdownMenuItem`.

## 10. The status line under the title is left out

- **Where:** `io/export.ts` `LEFT_OUT`.
- **Evidence:** the stale-render status line (`[data-slot="diagram-title"] > [role="status"]`,
  moved under the title card by wave-2 review m4) describes the editor, not the diagram; it
  appeared in the picture during a broken edit.
- **App choice:** it is left out like the minimap and controls, and the title's extent is
  measured on `[data-slot="diagram-title-card"]` only.

## 11. `DropdownMenuSubContent` runs off a phone screen

- **Where:** `io/export-menu.tsx` `ExportMenuItems` (the compact bar's "Export" submenu),
  at 390×844.
- **Evidence:** "Diagram options" opens at x ≈ 142–362; the submenu (≈ 210 px wide) fits on
  neither side, flips left and is cut at the screen edge ("1×", "y as PNG", "sparent
  background"). Radix places a sub-menu only to the right or left of its trigger and does
  not shift it across that axis. The items still work from the keyboard. Screenshot
  `.evidence/DG-17/17-menu-390x844-light.png`.
- **App choice:** none yet (not worked around; the orchestrator decides).
- **Proposed API:** ui's `DropdownMenuSubContent` (or `DropdownMenu`) opens a sub-menu
  inline, below its trigger, when neither side has room.
