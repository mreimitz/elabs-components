/**
 * Story-test helpers for the invariants a CANVAS owes its reader, as distinct
 * from the per-edge invariant in `./edge-anchors`.
 *
 * All four are things a green typecheck cannot see and jsdom cannot measure —
 * they are properties of the rendered, laid-out, zoomed picture:
 *
 * 1. **Everything is in frame.** A canvas that opens with half its graph below
 *    the fold has failed before the reader touches it. Measured on the process
 *    map: `fitView` fired once, before the layout hook had positions, and then
 *    never again — 5 of 11 activities opened off-screen.
 * 2. **Connectors sit on the card.** React Flow lays a `<Handle>` out against
 *    the nearest positioned ancestor, which is NOT necessarily the painted card:
 *    a sibling row rendered beside the card pushes every dot off it by that
 *    row's own height (measured: 24 px). The wrapper still looks correct, so
 *    this must be measured against the card's own box.
 * 3. **Labels do not cover nodes.** Edge label pills are portalled into
 *    `.react-flow__edgelabel-renderer`, so they contribute nothing to dagre's
 *    routing and nothing to React Flow's fitted bounds — a rank gap tuned for
 *    bare arrows is exactly one pill too narrow, and nothing in the layout
 *    math notices.
 * 4. **The overview thumbnail is drawn.** `<MiniMap>` bails out per node in
 *    `nodeHasDimensions(internals.userNode)`, so a controlled canvas whose
 *    consumer never writes measurements back renders a blank white panel with
 *    a correct viewBox — no error, no warning, nothing to typecheck.
 *
 * Every helper returns report LINES rather than a boolean, so a failing
 * assertion prints the offending distances: the numbers are what say whether an
 * anchor drifted a pixel or half a node.
 *
 * Not part of the published surface — see `./index`.
 */

/** The zoom factor React Flow has applied to the viewport, or `1` if it is not rendered. */
export function viewportZoom(canvasElement: HTMLElement): number {
  const viewport = canvasElement.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) return 1;
  const { a } = new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
  return Number.isFinite(a) && a > 0 ? a : 1;
}

/**
 * One line per node that is not COMPLETELY inside the canvas pane.
 *
 * `tolerance` is a sub-pixel allowance: `fitView`'s padding maths and the
 * browser's own rounding routinely leave an edge a fraction of a pixel proud of
 * the pane, which no reader can see.
 */
export function nodesOutsidePane(canvasElement: HTMLElement, tolerance = 1): string[] {
  const pane = canvasElement.querySelector<HTMLElement>(".react-flow__pane");
  if (!pane) return ["no .react-flow__pane rendered"];
  const bounds = pane.getBoundingClientRect();
  const misses: string[] = [];
  for (const node of canvasElement.querySelectorAll<HTMLElement>(".react-flow__node")) {
    const rect = node.getBoundingClientRect();
    const overflow = Math.max(
      bounds.left - rect.left,
      bounds.top - rect.top,
      rect.right - bounds.right,
      rect.bottom - bounds.bottom,
    );
    if (overflow > tolerance) {
      const id = node.getAttribute("data-id") ?? "?";
      misses.push(`node "${id}" is ${overflow.toFixed(1)}px outside the pane`);
    }
  }
  return misses;
}

/**
 * One line per handle dot whose centre sits off the border of its own node's
 * painted card, in FLOW px (screen distance divided by the zoom) so the number
 * means the same at any zoom.
 *
 * `cardSelector` selects the painted card inside each `.react-flow__node`
 * wrapper — `[data-slot="flow-node"]` for a canvas built on `FlowNode`. A node
 * whose wrapper contains no such card is skipped rather than reported: a canvas
 * may legitimately mix node types.
 */
export function handlesOffCard(
  canvasElement: HTMLElement,
  cardSelector = '[data-slot="flow-node"]',
  tolerance = 1,
): string[] {
  const zoom = viewportZoom(canvasElement);
  const misses: string[] = [];
  for (const node of canvasElement.querySelectorAll<HTMLElement>(".react-flow__node")) {
    const card = node.querySelector<HTMLElement>(cardSelector);
    if (!card) continue;
    const box = card.getBoundingClientRect();
    for (const handle of node.querySelectorAll<HTMLElement>(".react-flow__handle")) {
      const rect = handle.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      // Distance from the point to the card RECTANGLE (0 when the point is inside it).
      const dx = Math.max(box.left - x, 0, x - box.right);
      const dy = Math.max(box.top - y, 0, y - box.bottom);
      const gap = Math.hypot(dx, dy) / zoom;
      if (gap > tolerance) {
        const id = node.getAttribute("data-id") ?? "?";
        const side = handle.getAttribute("data-handlepos") ?? "?";
        misses.push(`handle ${side} on "${id}" is ${gap.toFixed(1)}px off its card`);
      }
    }
  }
  return misses;
}

/**
 * One line per portalled edge label that overlaps a node card.
 *
 * Rectangle overlap, not centre distance: a pill that clips a card's corner by
 * two pixels is still a number printed on top of a name, which is the thing a
 * reader complains about.
 */
export function labelsOverNodes(
  canvasElement: HTMLElement,
  cardSelector = '[data-slot="flow-node"]',
): string[] {
  const labels = [
    ...canvasElement.querySelectorAll<HTMLElement>(".react-flow__edgelabel-renderer > *"),
  ];
  const cards = [...canvasElement.querySelectorAll<HTMLElement>(cardSelector)];
  const hits: string[] = [];
  for (const label of labels) {
    const a = label.getBoundingClientRect();
    if (a.width === 0 || a.height === 0) continue;
    for (const card of cards) {
      const b = card.getBoundingClientRect();
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
        const id = card.closest(".react-flow__node")?.getAttribute("data-id") ?? "?";
        hits.push(`label "${(label.textContent ?? "").trim()}" covers node "${id}"`);
        break;
      }
    }
  }
  return hits;
}

/**
 * The framing invariant for a canvas that is allowed to open ZOOMED IN.
 *
 * `nodesOutsidePane` alone says "everything fits", which is the right bar only while the
 * whole graph is meant to fit. A canvas with a legibility floor on its opening fit gives
 * that up on purpose: a process wider than the pane opens readable and partial rather
 * than complete and unreadable. The bar that replaces it is a disjunction —
 *
 * 1. everything is in frame; **or**
 * 2. the fit was CLAMPED by the floor (the zoom is sitting on it), and the beginning of
 *    the process — the first node along each overflowing axis — is fully in frame.
 *
 * Both halves are falsifiable, which is the point of writing it this way. Lose the fit
 * and nodes go out of frame at a zoom BELOW the floor, failing (1) and (2). Lose the
 * anchoring and the clamped fit centres again, so the first node drops off the top or the
 * start edge, failing (2). "Partial" never becomes an excuse for "wrong".
 *
 * Pass `legibleZoom: 0` (the default) to get the plain everything-fits bar back.
 */
export function framingMisses(
  canvasElement: HTMLElement,
  { legibleZoom = 0, tolerance = 1 }: { legibleZoom?: number; tolerance?: number } = {},
): string[] {
  const outside = nodesOutsidePane(canvasElement, tolerance);
  if (outside.length === 0) return [];
  if (legibleZoom <= 0) return outside;

  const zoom = viewportZoom(canvasElement);
  if (zoom < legibleZoom - 1e-3) {
    return [
      `${outside.length} node(s) out of frame at zoom ${zoom.toFixed(3)}, below the legible ` +
        `floor of ${legibleZoom} — the fit was not clamped, it simply missed`,
      ...outside,
    ];
  }

  const pane = canvasElement.querySelector<HTMLElement>(".react-flow__pane");
  if (!pane) return ["no .react-flow__pane rendered"];
  const bounds = pane.getBoundingClientRect();
  const nodes = [...canvasElement.querySelectorAll<HTMLElement>(".react-flow__node")].map(
    (element) => ({
      id: element.getAttribute("data-id") ?? "?",
      rect: element.getBoundingClientRect(),
    }),
  );
  if (nodes.length === 0) return ["no nodes rendered"];

  const spanX =
    Math.max(...nodes.map((n) => n.rect.right)) - Math.min(...nodes.map((n) => n.rect.left));
  const spanY =
    Math.max(...nodes.map((n) => n.rect.bottom)) - Math.min(...nodes.map((n) => n.rect.top));
  const inFrame = (r: DOMRect) =>
    r.left >= bounds.left - tolerance &&
    r.top >= bounds.top - tolerance &&
    r.right <= bounds.right + tolerance &&
    r.bottom <= bounds.bottom + tolerance;

  const misses: string[] = [];
  // Per axis, and only where the content actually outruns the pane: a tall graph in a
  // wide pane is pinned to the top and stays horizontally centred, so demanding a
  // left-edge anchor there would fail a canvas that is framed exactly right.
  if (spanX > bounds.width + tolerance) {
    const first = nodes.reduce((a, b) => (b.rect.left < a.rect.left ? b : a));
    if (!inFrame(first.rect)) {
      misses.push(
        `the graph starts at node "${first.id}", which the clamped fit left out of frame`,
      );
    }
  }
  if (spanY > bounds.height + tolerance) {
    const first = nodes.reduce((a, b) => (b.rect.top < a.rect.top ? b : a));
    if (!inFrame(first.rect)) {
      misses.push(
        `the graph starts at node "${first.id}", which the clamped fit left out of frame`,
      );
    }
  }
  return misses;
}

/** How many node rectangles the overview thumbnail has actually drawn. */
export function miniMapNodeCount(canvasElement: HTMLElement): number {
  const miniMap = canvasElement.querySelector(".react-flow__minimap");
  if (!miniMap) return -1;
  return miniMap.querySelectorAll(".react-flow__minimap-node").length;
}

/** One node's laid-out position, read from React Flow's own inline transform. */
export interface NodePlacement {
  id: string;
  x: number;
  y: number;
}

/**
 * Every node's laid-out position, parsed out of `style.transform`.
 *
 * The inline transform, not `getBoundingClientRect()`: React Flow writes
 * `node.position` there un-animated, so it reads the final coordinate on the
 * first commit that has it — whatever frame a CSS entry transition happens to
 * be on, and whichever way the viewport has since been panned.
 */
export function nodePlacements(canvasElement: HTMLElement): NodePlacement[] {
  const out: NodePlacement[] = [];
  for (const node of canvasElement.querySelectorAll<HTMLElement>(".react-flow__node")) {
    const match = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(node.style.transform);
    if (!match) continue;
    out.push({ id: node.getAttribute("data-id") ?? "?", x: Number(match[1]), y: Number(match[2]) });
  }
  return out;
}

/** Node placements plus the viewport zoom, as one comparable string. */
export function canvasSignature(canvasElement: HTMLElement): string {
  const placements = nodePlacements(canvasElement)
    .map((p) => `${p.id}@${p.x},${p.y}`)
    .join("|");
  return `${viewportZoom(canvasElement).toFixed(4)} ${placements}`;
}

/**
 * Resolve once the canvas has finished laying itself out, or throw.
 *
 * **Every framing assertion needs this, and none of them can detect its
 * absence.** A canvas that has mounted but not yet run its layout has all its
 * nodes stacked on the model's mount position — which is fully inside the pane,
 * has every handle on its own card, and has every edge terminating on a dot,
 * because there is nowhere else for any of it to be. So a play function that
 * measures too early does not fail; it PASSES, on a picture the reader never
 * sees. That is not hypothetical: it is how this helper came to exist.
 *
 * Two conditions, and the first is what excludes that trap:
 *
 * 1. **Distinct positions.** A layout pass gives every node its own coordinate;
 *    before it runs they share one, so a duplicate means it has not landed.
 * 2. **Stable across two consecutive polls** — positions AND zoom, so a
 *    mid-relayout frame or an in-flight re-fit is not mistaken for the result.
 *
 * A settled canvas satisfies both on the second poll, so the cost is one
 * `interval`, not the timeout.
 */
export async function waitForSettledCanvas(
  canvasElement: HTMLElement,
  { timeout = 15_000, interval = 100 }: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeout;
  let previous: string | null = null;
  let reason = "no nodes rendered";
  for (;;) {
    const placements = nodePlacements(canvasElement);
    const signature = canvasSignature(canvasElement);
    const distinct = new Set(placements.map((p) => `${p.x},${p.y}`)).size;
    if (placements.length === 0) {
      reason = "no nodes rendered";
    } else if (distinct !== placements.length) {
      reason = `${placements.length - distinct} node(s) share a position — layout has not run`;
    } else if (signature !== previous) {
      reason = "positions or zoom still changing";
    } else {
      return;
    }
    previous = signature;
    if (Date.now() >= deadline) {
      throw new Error(`canvas did not settle within ${timeout}ms: ${reason}`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
