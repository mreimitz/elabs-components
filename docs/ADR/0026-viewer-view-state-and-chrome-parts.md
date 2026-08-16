# ADR 0026 — the viewer's view state (page, scale, rotation) belongs to the shell, not to the adapter

- **Status:** accepted (2026-08-10)
- **Deciders:** maintainer decisions on fidelity (keep our data-model adapters), on the PDF
  engine (keep pdf.js), and on which new surfaces are in scope
- **Related:** ADR 0024 (the viewer package), ADR 0025 (addressing and the highlight funnel),
  ADR 0007 (presentation-layer scope), ADR 0017 (microcopy), `.claude/rules/viewer-components.md`

## Context

`@elabs/components-viewer` landed with the full addressing layer of
ADR 0025 but with no **chrome**. (It was still unpublished at that point — the package
joins the release set in this same release, so no consumer ever saw the shape below.) A PDF was a one-page-at-a-time pager, a deck a
one-slide-at-a-time outline, and both owned their controls: `pageNumber` and `zoomIndex` were
`useState` inside `PdfRenderer`, `index` was `useState` inside `PptxRenderer`.

That placement is the defect. Because the state lived in the renderer:

- an app could not deep-link to page 7, because there was no prop to set;
- an app could not put a page control in its own header, because there was no state to read;
- nothing could ask the viewer to reveal a region, because the only way in was the canvas;
- the pager could only ever exist **once**, inside the canvas;
- `image`'s manifest declared `zoom: true, rotate: true` while its renderer implemented
  neither — a claim nothing could observe, and therefore a claim nothing could falsify;
- and each paginated adapter re-implemented the same prev/next/clamp/announce chrome, in its
  own words, with its own microcopy keys.

ADR 0025 already answered the same question for highlights: the provider holds the state, the
renderer receives it as props and reports back. This ADR applies that answer to the view state.

### Prior art evaluated

[`extend-hq/ui`](https://github.com/extend-hq/ui) (MIT) — a document-AI component set built on
the same shadcn registry model. Read in full: the repository, the components documentation and
the blocks gallery. Its viewers scroll continuously rather than paging, and its page control is
a click-to-edit "N of M" field.

**The valuable idea there is not a component.** Its viewer knows nothing about its domain:
citations, OCR blocks, signature fields and page splitting are all built on a handful of
seams — an overlay render prop, a per-page class hook, page pointer events, a toolbar-actions
slot, and a ref handle exposing `scrollToPage` / `scrollToPageArea`. That inversion — the
viewer owns page geometry, the caller owns meaning — is what this ADR adopts.

**What was rejected, and why:**

- **`@extend-ai/react-{pptx,docx,xlsx}`** (open-source Rust→WASM renderers) give real slide
  geometry, page boxes, comments, tracked changes and merged cells — but they own their DOM
  and ship their own CSS. That breaks "adapters emit DATA, never HTML" (ADR 0024) and reduces
  theming to whichever props they expose. Our pptx stays an outline, our docx stays reflowed,
  our xlsx stays a table.
- **EmbedPDF / PDFium-in-WASM** would deliver continuous scroll, tiling, thumbnails, rotate,
  search and selection as plugins — at the cost of eleven new optional peers, a WASM binary
  fetched from a CDN (an origins-allowlist and CSP change, `docs/CSP-AND-NETWORK.md`), and
  rewriting the rect painter and the text index onto a new API. pdf.js stays.
- Their Base UI migration, their icon set (freemium), their three layered theming systems
  with ~9,500 lines of imported-but-unused CSS and raw `blue-500` in overlays, and their
  engineering posture (`ignoreBuildErrors: true`, no tests) — all declined.

## Decision

### 1. Page, scale and rotation are provider state, exposed as three controlled/uncontrolled trios

`FileViewerViewState` joins `FileViewerLoadState` on `state`:

```ts
interface FileViewerViewState {
  pageNumber: number; // 1-based, clamped to the document
  pageCount: number; // 0 when the format has no pages
  zoom: ZoomLevel; // what was ASKED for — a number or a fit mode
  effectiveZoom: number; // what the renderer RESOLVED it to
  rotation: DocumentRotation;
}
```

with `goToPage` / `nextPage` / `previousPage` / `setZoom` / `zoomIn` / `zoomOut` /
`setRotation` / `rotate` on `actions`, and `pageNumber`, `zoom` and `rotation` each following
the repo's controlled/uncontrolled convention (`component-api.md`): a `value` prop, a
`defaultValue` prop, and an `onChange` prop, never flipping between modes.

`pageCount` is **derived**, not stored — it is `state.document?.pageCount ?? 0`, so a format
that has no pages reports `0` and every page control renders nothing.

### 2. A fit mode is a REQUEST; only the renderer can answer it

`ZoomLevel = number | "fit-width" | "fit-page"`. The shell cannot compute a fit: it does not
know the page's intrinsic size and does not own the viewport that has to hold it. So the fit
travels **down** as the request, and the resolved scale travels **back up** through
`onZoomResolved`, landing on `state.effectiveZoom`.

Two consequences fall out of that split, and both are deliberate:

- **The trigger shows "Fit width" while the live region announces "Zoom 137%".** They are
  different facts, and a reader needs both.
- **Stepping is measured against `effectiveZoom`, never against `zoom`.** A page fitted to
  137% must step to 150%, not to 125% — otherwise the first press of "+" makes the page
  smaller. `zoomIn`/`zoomOut` are the only readers of the reported value; a numeric `zoom`
  ignores the report entirely, so there is no feedback loop.

### 3. The chrome is three parts, and each renders `null` when its capability is absent

`FileViewerPager` (previous · a page you can type into · "of N" · next),
`FileViewerZoom` (out · a `Select` of fit modes and fixed stops · in), and
`FileViewerRotate` (one clockwise quarter-turn). `<FileViewer>` composes all three into its
default toolbar; anything inside `FileViewerProvider` may compose them anywhere else.

They are **parts**, in the same sense `FileViewerToolbar` and `FileViewerFind` are: a workspace
can put the pager beside a breadcrumb, or beside a thumbnail rail, and every copy stays in
step because none of them owns the state.

`AdapterCapabilities.pages` / `.zoom` / `.rotate` decide whether each part exists at all —
inert chrome over a CSV reads as a broken render, the same call ADR 0024 made for an empty
toolbar. That absence is also the repair for `image`'s hollow claim: the manifest declared
both, so now the renderer honours both, and a unit test asserts the claim and the behaviour
together.

**None of the three is a `role="toolbar"`.** The role promises roving-tabindex arrow-key
navigation, and the page field is a text input — ArrowLeft/ArrowRight there move the caret.
Radix's roving-focus guard (`event.target !== event.currentTarget`) does not protect an
`asChild` input, so the keys really would be swallowed. They are plain named groups of
ordinary tab stops: the same call `FileViewerFind` made in ADR 0025 §9, for the same reason.

Each group carries **one** `sr-only` `role="status"` live region for the whole group, not one
per control — a repainted canvas announces nothing on its own, and a `Select`'s own value
change is not announced either.

### 4. The zoom ladder is shared, not per-adapter

`VIEWER_ZOOM_STEPS` (`0.5 · 0.75 · 1 · 1.25 · 1.5 · 2 · 3`), `stepZoom`, `canStepZoom` and
`isZoomFit` live in `core/zoom.ts` and are exported from the barrel. The provider steps along
that ladder, the `Select` lists it, and a consumer building its own control reads the same one.
It was previously `PDF_ZOOM_STEPS`, private to the PDF adapter — which is why no other format
could zoom at all.

### 5. Both paginated adapters give up their own viewport

`viewer-components.md` allows an adapter its own `overflow-auto` only when it has **fixed
chrome above a scrolling body**. Once the chrome leaves, that justification leaves with it:
`pdf` and `pptx` now render plain blocks and let `FileViewerContent` scroll, restoring the
one-scroll-boundary rule, removing a duplicate focusable region, and — not incidentally —
giving the continuous-scroll work a single, unambiguous scroll host to virtualize against.

The one nested scroller that stays is the deck's `aspect-video` slide frame: a fixed-ratio box
whose content may not fit it, which is a different thing from a second page viewport. It keeps
its `tabIndex={0}` and its name (WCAG 2.1.1).

### 6. Every new field is optional, so `PROTOCOL_VERSION` stays `1`

`pageNumber`, `onPageChange`, `zoom`, `onZoomResolved` and `rotation` are optional on
`AdapterRendererProps`. An adapter written against the old protocol keeps working and simply
never pages; a `Renderer` mounted outside a provider keeps working too, because `usePageControl`
gives it the same controlled/uncontrolled trio the shell uses. Adding an optional field is not
a breaking change (ADR 0024 §protocol).

### 7. A paginated document is a scrolling COLUMN, virtualized, over the shell's viewport

A pager that replaces the canvas is not how anyone reads a document. `pdf` and `pptx` now
render every page into one column and let the reader scroll it; the page number becomes a
_position_ in that column rather than a switch between mutually exclusive views.

- **`usePagedScroll` (`core/use-paged-scroll.ts`) is the shared mechanism**, on
  `@tanstack/react-virtual` — already this repo's virtualizer in `ui`, `data` and `charts`, so
  no new dependency family. Only the pages near the viewport are mounted: a 900-page report
  costs a window, not a document. A future paginated adapter uses this hook; it does not
  hand-roll a second one.
- **It scrolls somebody else's element.** §5 gave both adapters up their viewports, so the
  column is a CHILD of `FileViewerContent`. `scrollMargin` carries the offset between the two,
  measured geometrically (`getBoundingClientRect`) rather than with `offsetTop`, which is
  relative to the nearest _positioned_ ancestor and would report the distance to some outer
  frame.
- **The page number is a two-way binding, and that is the whole difficulty.** Scrolling
  reports the page under the viewport's top edge; setting the page scrolls to it. Wired
  naively they fight — a scroll reports page 3, the prop becomes 3, and the "prop changed,
  scroll to it" effect snaps the reader back to the top of page 3 mid-gesture. So each
  direction remembers what it last said and ignores an echo of its own words, and the report
  fires only on a CHANGE of active page — which is also what lets a shell that mounts already
  pointing at page 140 be honoured rather than answered with "you are on page 1".
- **`AdapterDocument.pageSizes` is now a real field** (optional, so §6 still holds). The PDF
  loader collects each page's scale-1 viewport inside the loop it already runs for the text
  projection, so the estimates are exact and the scrollbar is honest from the first frame
  instead of settling as pages render.
- **It may be SHORTER than `pageCount`, on purpose.** That loop is capped at
  `PDF_TEXT_PAGE_LIMIT` (50), and a second pass would be 900 worker round-trips for numbers
  nobody has asked for. Past the cap the renderer falls back to the FIRST page's size —
  uniform page size is overwhelmingly the common case, and a wrong guess costs a scrollbar
  that corrects itself as those pages measure, not a wrong render. This is the concern the
  first draft of this ADR deferred the field over; the fallback is the answer to it.
- **A zoom change keeps the reader's place.** The page under the top edge and how far into it
  they are is recorded on every scroll, and re-applied after the measurements are thrown away
  — otherwise every zoom step is also a jump to somewhere else in the document.
- **Citations still navigate first, then scroll.** The renderer asks the shell for the cited
  page (§1), the column scrolls there, and the mark's own `scrollIntoView` — now inside a
  per-page component — does the fine positioning. Nothing about ADR 0025's contract changes;
  the first half is simply a scroll now instead of a page swap.

## Consequences

- **The default PDF and PowerPoint surfaces changed shape.** The controls moved out of the
  document pane and into the viewer's toolbar row. Their microcopy keys moved with them:
  `viewer.pdf.*` / `viewer.pptx.*` chrome keys are replaced by format-neutral `viewer.pager.*`
  / `viewer.zoom.*` / `viewer.rotate` keys, since one control now serves every format.
- **The default toolbar row is now up to eight ordinary tab stops** (previous, the page field,
  next, zoom out, the scale select, zoom in, rotate, download). That is the accepted cost of
  refusing `role="toolbar"` over a text input, and it is the a11y reviewer's call to revisit.
- **§1–§6 were the enabler; §7 is the feature they enabled.** A thumbnail rail, a
  `reveal(page, area)` action and a `renderPageOverlay` seam remain follow-on work,
  deliberately not smuggled in — but they now have a scroll target to aim at.
- **Two seams stay deferred**, rather than shipped as protocol fields nothing reads:
  `reveal` and `renderPageOverlay`. Both want per-page geometry that the rail's own work will
  produce anyway. (`AdapterDocument.pageSizes`, the third, shipped in §7.)
- **A page's DOM lifetime is now the scroll window.** A page scrolled far enough away is
  unmounted, which cancels its own pdf.js render task and releases its own page — but also
  means selection, focus and any consumer state inside a page do not survive scrolling past
  it. That is the ordinary cost of virtualization and the reason the window carries an
  overscan page on each side.
- **Still dead:** `capabilities.outline` and `capabilities.thumbnails` are read by nothing.
  `thumbnails` becomes real with the rail; `outline` needs an adapter that produces a heading
  tree, which none does today.
