/**
 * DG-12 — fit around the canvas chrome. The title block (top-left), the legend
 * (bottom-left), the minimap (top-right), the zoom controls (bottom-right) and the stale badge
 * (bottom-centre) are React Flow `Panel`s over the canvas; a plain `fitView` puts nodes under
 * them.
 *
 * Two passes:
 * 1. **Box clearance** (DG-12). Each panel is cleared either vertically (reserve its height from
 *    its top/bottom edge) or horizontally (reserve its width from its left/right edge); every
 *    combination is tried and the one that allows the largest zoom wins — a wide LR diagram
 *    gives up height, a tall TB one width. It keeps the diagram's whole bounding box clear, so
 *    it is always safe, and it is the floor.
 * 2. **Node-aware** (wave-2 review M1). A panel may sit over an empty part of that box — a zone's
 *    empty corner, the gap between two branches. From the largest zoom the pane allows down to
 *    pass 1's zoom, the first zoom with a placement where no leaf node and no zone header meets a
 *    panel wins; of those placements, the one nearest the pane's centre. Zone bodies, borders and
 *    edges may pass under a panel; words and marks may not.
 *
 * P4: library gap — `fitView` has no "avoid these panels" option; CanvasShell could offer
 * one (proposed: `fitViewOptions.avoid: "panels"`). docs/findings/DG-12-editor-integration.md.
 */
import type { Node } from "@elabs-ai/components-flow";
// P4: library gap — flow does not re-export the `FitViewOptions` type (verified-apis.md → flow).
import type { FitViewOptions } from "@xyflow/react";
import { ZONE_HEADER_HEIGHT, isZoneNode } from "../nodes/zone-data";

type Side = "top" | "right" | "bottom" | "left";
type Insets = Record<Side, number>;
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Room between a panel and the nearest node, and around the diagram elsewhere (px). */
const GAP = 16;
/** Each node-aware step lowers the zoom by 1 %; then the last step is bisected this often. */
const ZOOM_STEP = 0.99;
const REFINE_STEPS = 6;

/** The zoom limits of the canvas the fit is for (React Flow's store `minZoom`/`maxZoom`). */
export interface FitZoomLimits {
  minZoom: number;
  maxZoom: number;
}

function nodeSize(node: Node): { width: number; height: number } {
  return {
    width: node.width ?? node.measured?.width ?? 0,
    height: node.height ?? node.measured?.height ?? 0,
  };
}

/**
 * The laid-out diagram's box (flow units): top-level nodes carry absolute positions, so their
 * box is the diagram's. A zone's size is its laid-out `width`/`height`, never a stale `measured`.
 */
export function diagramBounds(nodes: readonly Node[]): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    if (node.parentId !== undefined || node.hidden) continue;
    const { width, height } = nodeSize(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }
  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * What must stay out from under a panel (flow units, absolute): every visible leaf node, and the
 * header band of every expanded zone — a collapsed zone is a chip and counts whole.
 */
function obstacles(nodes: readonly Node[]): Rect[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const absolute = (node: Node): { x: number; y: number } => {
    const parent = node.parentId === undefined ? undefined : byId.get(node.parentId);
    if (!parent) return node.position;
    const origin = absolute(parent);
    return { x: origin.x + node.position.x, y: origin.y + node.position.y };
  };
  return nodes.flatMap((node) => {
    if (node.hidden) return [];
    const { width, height } = nodeSize(node);
    if (width === 0 || height === 0) return [];
    const { x, y } = absolute(node);
    const band = isZoneNode(node) && !node.data.collapsed;
    return [{ x, y, width, height: band ? Math.min(height, ZONE_HEADER_HEIGHT) : height }];
  });
}

interface PanelBox {
  /** The panel's box (pane px) — pass 1 clears it whole. */
  rect: Rect;
  /**
   * What the panel paints (pane px) — pass 2 keeps nodes out from under these. The panel's own
   * box when it paints a surface; its children's boxes when it is a bare column (the title
   * block: the title card, then the status line — the corner beside a short status line is
   * canvas).
   */
  ink: Rect[];
  /** The panel's position classes (`top`, `bottom`, `left`, `right`, `center`). */
  at: DOMTokenList;
}

function paints(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  return style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.boxShadow !== "none";
}

/** The visible panels of `pane`. */
function panelsOf(pane: HTMLElement): PanelBox[] {
  const box = pane.getBoundingClientRect();
  const relative = (r: DOMRect): Rect => ({
    x: r.left - box.left,
    y: r.top - box.top,
    width: r.width,
    height: r.height,
  });
  return [...pane.querySelectorAll<HTMLElement>(".react-flow__panel")].flatMap((panel) => {
    const r = panel.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return [];
    const rect = relative(r);
    const children = [...panel.children].map((child) => child.getBoundingClientRect());
    const ink =
      paints(panel) || children.length === 0
        ? [rect]
        : children.filter((c) => c.width > 0 && c.height > 0).map(relative);
    return [{ rect, ink, at: panel.classList }];
  });
}

/** Pass 1: each panel's two ways out of the diagram's way (pane-relative px). */
function clearances(
  panels: PanelBox[],
  width: number,
  height: number,
): [Partial<Insets>, Partial<Insets>][] {
  return panels.map(({ rect: r, at }) => {
    const vertical: Partial<Insets> = at.contains("top")
      ? { top: r.y + r.height + GAP }
      : { bottom: height - r.y + GAP };
    const horizontal: Partial<Insets> = at.contains("left")
      ? { left: r.x + r.width + GAP }
      : at.contains("right")
        ? { right: width - r.x + GAP }
        : vertical; // a centred panel can only be cleared vertically
    return [vertical, horizontal];
  });
}

/** Pass 1: the largest zoom that keeps the whole bounding box clear of every panel. */
function boxFit(
  choices: [Partial<Insets>, Partial<Insets>][],
  size: Rect,
  width: number,
  height: number,
): { insets: Insets; zoom: number } {
  let best: Insets = { top: GAP, right: GAP, bottom: GAP, left: GAP };
  let bestZoom = -Infinity;
  for (let mask = 0; mask < 1 << choices.length; mask += 1) {
    const insets: Insets = { top: GAP, right: GAP, bottom: GAP, left: GAP };
    choices.forEach((pair, index) => {
      const pick = pair[(mask >> index) & 1] ?? {};
      for (const side of Object.keys(pick) as Side[]) {
        insets[side] = Math.max(insets[side], pick[side] ?? 0);
      }
    });
    const zoom = Math.min(
      (width - insets.left - insets.right) / size.width,
      (height - insets.top - insets.bottom) / size.height,
    );
    if (zoom > bestZoom) {
      bestZoom = zoom;
      best = insets;
    }
  }
  return { insets: best, zoom: bestZoom };
}

/**
 * The free `ty` nearest `target` in `span`, given the open intervals blocked at one `tx`.
 * Open intervals: a placement on an edge keeps exactly `GAP` and is free.
 */
function nearestFree(
  blocked: [number, number][],
  span: [number, number],
  target: number,
): number | null {
  // Merge overlapping intervals (touching ones leave their shared end free).
  const merged: [number, number][] = [];
  for (const [lo, hi] of [...blocked].sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && lo < last[1]) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  const run = merged.find(([lo, hi]) => lo < target && target < hi);
  if (!run) return target;
  const ends = run.filter((y) => y >= span[0] && y <= span[1]);
  if (ends.length === 0) return null;
  return ends.reduce((best, y) => (Math.abs(y - target) < Math.abs(best - target) ? y : best));
}

/**
 * Pass 2 at one zoom: the diagram's top-left corner on screen (`tx`, `ty`, pane px) nearest the
 * centred placement such that no obstacle meets a panel grown by `GAP`, or `null`.
 *
 * An obstacle at offset `o` (flow units from the diagram's corner) meets panel `p` exactly when
 * `tx` lies in `(p.left − GAP − (o.x + o.w)·z, p.right + GAP − o.x·z)` and `ty` in the matching
 * interval — an open box in placement space. The set of boxes over a `tx` only changes at a box
 * edge, so the nearest free placement has `tx` at the centre, a range end or a box edge; for each
 * such `tx` the nearest free `ty` is found in one dimension.
 */
function placeAt(
  zoom: number,
  size: Rect,
  items: readonly Rect[],
  panels: readonly Rect[],
  width: number,
  height: number,
): { tx: number; ty: number } | null {
  const spanX: [number, number] = [GAP, width - GAP - size.width * zoom];
  const spanY: [number, number] = [GAP, height - GAP - size.height * zoom];
  if (spanX[1] < spanX[0] || spanY[1] < spanY[0]) return null;
  // The midpoints of the ranges: the centred placement.
  const cx = (spanX[0] + spanX[1]) / 2;
  const cy = (spanY[0] + spanY[1]) / 2;
  const boxes: [number, number, number, number][] = [];
  for (const item of items) {
    const ox = (item.x - size.x) * zoom;
    const oy = (item.y - size.y) * zoom;
    const ow = item.width * zoom;
    const oh = item.height * zoom;
    for (const p of panels) {
      const x0 = p.x - GAP - ox - ow;
      const x1 = p.x + p.width + GAP - ox;
      const y0 = p.y - GAP - oy - oh;
      const y1 = p.y + p.height + GAP - oy;
      if (x1 <= spanX[0] || x0 >= spanX[1] || y1 <= spanY[0] || y0 >= spanY[1]) continue;
      boxes.push([x0, x1, y0, y1]);
    }
  }
  const xs = [cx, ...spanX, ...boxes.flatMap(([x0, x1]) => [x0, x1])]
    .filter((x) => x >= spanX[0] && x <= spanX[1])
    .sort((a, b) => Math.abs(a - cx) - Math.abs(b - cx));
  let best: { tx: number; ty: number } | null = null;
  let bestDistance = Infinity;
  for (const tx of xs) {
    if ((tx - cx) ** 2 >= bestDistance) break;
    const over = boxes
      .filter(([x0, x1]) => tx > x0 && tx < x1)
      .map(([, , y0, y1]): [number, number] => [y0, y1]);
    const ty = nearestFree(over, spanY, cy);
    if (ty === null) continue;
    const distance = (tx - cx) ** 2 + (ty - cy) ** 2;
    if (distance < bestDistance) {
      best = { tx, ty };
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The per-side padding (px) for `getViewportForBounds` that keeps every leaf node and zone header
 * clear of every panel in `pane` (the `.react-flow` element) at the largest zoom. `nodes`: the
 * laid-out graph; `limits`: the canvas's zoom limits (the node-aware pass never exceeds
 * `maxZoom`). The padding pins the zoom and the placement: `getViewportForBounds` turns it back
 * into exactly that viewport.
 */
export function chromeFitPadding(
  pane: HTMLElement,
  nodes: readonly Node[],
  limits?: FitZoomLimits,
): FitViewOptions["padding"] {
  const size = diagramBounds(nodes);
  const { width, height } = pane.getBoundingClientRect();
  if (!size || size.width === 0 || size.height === 0) return GAP;
  const panels = panelsOf(pane);
  const box = boxFit(clearances(panels, width, height), size, width, height);
  const px = (insets: Insets): FitViewOptions["padding"] => ({
    top: `${insets.top}px`,
    right: `${insets.right}px`,
    bottom: `${insets.bottom}px`,
    left: `${insets.left}px`,
  });

  const ceiling = Math.min(
    (width - 2 * GAP) / size.width,
    (height - 2 * GAP) / size.height,
    limits?.maxZoom ?? Infinity,
  );
  if (!(ceiling > box.zoom)) return px(box.insets);
  const items = obstacles(nodes);
  const rects = panels.flatMap((panel) => panel.ink);
  const place = (zoom: number) => placeAt(zoom, size, items, rects, width, height);

  let fail = Infinity;
  let zoom = ceiling;
  let at = place(zoom);
  while (!at) {
    fail = zoom;
    zoom *= ZOOM_STEP;
    if (zoom <= box.zoom) return px(box.insets);
    at = place(zoom);
  }
  // Bisect between the last zoom that failed and the first that fits.
  for (let step = 0; fail !== Infinity && step < REFINE_STEPS; step += 1) {
    const mid = (zoom + fail) / 2;
    const found = place(mid);
    if (found) {
      zoom = mid;
      at = found;
    } else {
      fail = mid;
    }
  }
  return px({
    top: at.ty,
    left: at.tx,
    bottom: height - at.ty - size.height * zoom,
    right: width - at.tx - size.width * zoom,
  });
}
