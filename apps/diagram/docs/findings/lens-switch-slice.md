# Technical and visual lenses

The visual lens derives capability boxes, lanes, member lists and directed flows from the
compiled diagram. It is a viewer choice: switching lenses never changes YAML, history or
saved thumbnails. The technical lens remains the editing surface.

## Current contracts

- Editing is allowed only at the settled technical endpoint. The target locks immediately,
  before the first moving frame; returning to technical stays locked until the final frame.
  Editor, inspector, reference-subtitle action, canvas and top-bar controls honor the lock.
  Store writes and undo/redo actions also guard their boundaries, preserving history stacks.
- Both layouts stay mounted. A transition waits for their current fits and stable camera
  transforms, while keeping the source visible, then captures graph-coordinate geometry.
  Both live panes and the member/box overlay use one interpolated camera. Reversing keeps the
  same plan and position. The clock starts after preparation and caps a single frame's delta.
- Source content fades into identifiable member ghosts, which gather into the visual boxes.
  The actual box contents finish the transition. The overlay is inert and hidden from
  accessibility APIs. Title, legend, minimap and zoom controls render outside fading content.
- Reduced motion uses a short crossfade without the moving overlay.
- Visual fitting waits for the asynchronous fit result. Window, editor and inspector size
  changes refit an untouched view; a user's pan or zoom remains intentional.
- Contains cards are portaled outside the scaled canvas and kept inside the viewport. Their
  informational layer cannot intercept adjacent boxes. Alt-click or Alt+Enter switches to
  technical, frames the actual member nodes and gives one of them keyboard focus.
- Visual edges use separate ports, gap columns and skip-lane channels. Geometry checks reject
  box-interior crossings and shared collinear segments of at least four graph units. Opposite
  directions and different flow kinds remain distinct. Arrow and boundary colors use
  semantic tokens. Ownership has a visible label or border/pattern as well as color.
- Blank and invalid documents have different visual states. Presentation and export use the
  active lens, including its title and legend.

## Regression checks

Run the app on an isolated port and give the scripts an installed Playwright module:

```sh
DIAGRAM_URL=http://localhost:5415 PLAYWRIGHT_MODULE=playwright node tests/lens-recovery.mjs
DIAGRAM_URL=http://localhost:5415 PLAYWRIGHT_MODULE=playwright node tests/lens-motion.mjs
```

`PLAYWRIGHT_MODULE` also accepts a module file URL. `LENS_EVIDENCE_DIR` saves screenshots and
JSON results. `LENS_SKIP_GALLERY=1` runs only the shorter functional checks.

`lens-recovery.mjs` covers all seven shipped examples, templates and components at 1440 and
390 pixels in light and dark themes. It checks fitted boxes, unclipped member content, every
Contains card, route geometry, resize behavior, keyboard drill-down, export, presentation,
empty/error states and both developer check pages. It creates an in-memory history fixture
with a real undo and redo entry, proves both remain unchanged in every locked phase, then
proves redo still works. File writes and unexpected browser errors fail the check.

`lens-motion.mjs` records every requestAnimationFrame for immediate switching, return,
resize-then-switch and actual mid-flight reversal, with normal and reduced motion. Normal
motion requires at least 95% of moving frames within 16.9ms. Once the source document has a
ready layout and visible renderer, lens preparation must remain below 150ms with visible source
content. A separate held-read fixture requests the lens while a different document is still
loading: it checks current document identity, immediate write blocking, continuous visible
content and settlement within the existing four-second layout timeout. `LENS_LOADING_ONLY=1`
runs only that fixture. Every moving normal frame must use identical cameras and
keep chrome visible. Reduced motion must not display moving ghosts. Preparation latency is
reported separately from moving-frame timing. Run performance checks without other browser
or build workloads on the same machine; failed timing results remain failures.

The `#dev/lens-check` page checks derivation, topology, membership and routing for all seven
shipped documents, including the shared component. `#dev/spec-check` remains the dialect
regression suite. App typecheck, lint, strict token audit and changed-file Prettier are the
static gates.

## Evidence and limits

Recovery evidence is kept locally under `.evidence/recovery-2026-09-28/lens/`: the gallery,
functional and frame JSON, representative morph captures and a CPU profile. Browser timing
is a measurement of the machine and browser used, not a guarantee for every device. The
visual layout is derived from topology and ownership; it does not attempt to infer business
meaning that is absent from the document.
