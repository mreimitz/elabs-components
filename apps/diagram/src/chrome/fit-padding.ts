/**
 * DG-12 — fit around the canvas chrome. The title block (top-left), the legend
 * (bottom-left), the minimap (top-right) and the zoom controls (bottom-right) are React
 * Flow `Panel`s over the canvas; a plain `fitView` puts nodes under them. Each panel is
 * cleared either vertically (reserve its height from its top/bottom edge) or horizontally
 * (reserve its width from its left/right edge); every combination is tried and the one
 * that allows the largest zoom wins — a wide LR diagram gives up height, a tall TB one width.
 *
 * P4: library gap — `fitView` has no "avoid these panels" option; CanvasShell could offer
 * one (proposed: `fitViewOptions.avoid: "panels"`). docs/findings/DG-12-editor-integration.md.
 */
import type { Node } from "@elabs-ai/components-flow";
// P4: library gap — flow does not re-export the `FitViewOptions` type (verified-apis.md → flow).
import type { FitViewOptions } from "@xyflow/react";

type Side = "top" | "right" | "bottom" | "left";
type Insets = Record<Side, number>;

/** Room between a panel and the nearest node, and around the diagram elsewhere (px). */
const GAP = 16;

/**
 * The laid-out diagram's box (flow units): top-level nodes carry absolute positions, so their
 * box is the diagram's. A zone's size is its laid-out `width`/`height`, never a stale `measured`.
 */
export function diagramBounds(
  nodes: readonly Node[],
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    if (node.parentId !== undefined || node.hidden) continue;
    const width = node.width ?? node.measured?.width ?? 0;
    const height = node.height ?? node.measured?.height ?? 0;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }
  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Each panel's two ways out of the diagram's way. */
function clearances(pane: HTMLElement): [Partial<Insets>, Partial<Insets>][] {
  const box = pane.getBoundingClientRect();
  return [...pane.querySelectorAll<HTMLElement>(".react-flow__panel")].flatMap((panel) => {
    const r = panel.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return [];
    const at = panel.classList;
    const vertical: Partial<Insets> = at.contains("top")
      ? { top: r.bottom - box.top + GAP }
      : { bottom: box.bottom - r.top + GAP };
    const horizontal: Partial<Insets> = at.contains("left")
      ? { left: r.right - box.left + GAP }
      : at.contains("right")
        ? { right: box.right - r.left + GAP }
        : vertical; // a centred panel can only be cleared vertically
    return [[vertical, horizontal]];
  });
}

/**
 * The per-side padding (px) for `fitView`/`fitBounds` that keeps every node clear of every panel in
 * `pane` (the `.react-flow` element) at the largest zoom. `nodes`: the laid-out graph.
 */
export function chromeFitPadding(
  pane: HTMLElement,
  nodes: readonly Node[],
): FitViewOptions["padding"] {
  const size = diagramBounds(nodes);
  const { width, height } = pane.getBoundingClientRect();
  const choices = clearances(pane);
  if (!size || size.width === 0 || size.height === 0) return GAP;
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
  return {
    top: `${best.top}px`,
    right: `${best.right}px`,
    bottom: `${best.bottom}px`,
    left: `${best.left}px`,
  };
}
