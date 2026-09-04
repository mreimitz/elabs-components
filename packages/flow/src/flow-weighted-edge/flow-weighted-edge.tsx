import { useMemo } from "react";
import {
  getBezierPath,
  getSmoothStepPath,
  useEdges,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { resolveTokenColor } from "@elabs-ai/components-tokens";
import { FlowEdgePath } from "../flow-edge-path";
import { EdgeLabelPill } from "./edge-label-pill";
import {
  computeEdgeWeightScale,
  DEFAULT_EDGE_WIDTH_RANGE,
  type WeightedEdgeLike,
} from "./weight-scale";

export interface FlowWeightedEdgeData extends Record<string, unknown> {
  /** Frequency/volume this edge carries. Scaled into stroke width — see `computeEdgeWeightScale`. */
  weight?: number;
  /** Edges sharing a `scaleGroup` share one min-max width domain. @default all edges in the flow */
  scaleGroup?: string;
  /** A second, continuous measure (e.g. average duration). Colours the stroke — needs `valueDomain` too. */
  value?: number;
  /** `[min, max]` domain `value` is interpolated across, from `--flow-edge-weak` to `--flow-edge-strong`. */
  valueDomain?: [number, number];
  /** Primary edge-label-pill text, e.g. a frequency count. */
  label?: string;
  /** Secondary edge-label-pill text, e.g. a duration. */
  secondaryLabel?: string;
  /** Path geometry. Ignored when `variant` is `"back"`, which always routes smoothstep. @default "bezier" */
  path?: "bezier" | "smoothstep";
  /**
   * Whether this edge advances the process (`"forward"`) or runs against the
   * layout direction (`"back"` — a rework/retry edge, as reported by
   * `layoutFlow`'s `backEdges`).
   *
   * `"back"` is distinguished by SHAPE, not colour: a dashed stroke, and a
   * smoothstep route pushed clear of the forward edge between the same pair of
   * nodes so the two never overlap. It also carries a real accessible name, so
   * the direction reaches assistive technology as text rather than only as a
   * `data-variant` attribute.
   *
   * @default "forward"
   */
  variant?: "forward" | "back";
  /**
   * Overrides the accessible name given to a `"back"` edge's graphic. Defaults
   * to "Back edge — runs against the process direction".
   */
  variantLabel?: string;
}

export type BrandFlowWeightedEdge = Edge<FlowWeightedEdgeData, "weighted">;

// Approximate hex fallbacks for `--flow-edge-weak`/`--flow-edge-strong`, used
// only when the CSS custom property can't be read (SSR, or the tokens
// stylesheet isn't loaded yet) — resolveTokenColor() reads the live theme
// value whenever a `document` is available.
const FALLBACK_WEAK = "#6085a1";
const FALLBACK_STRONG = "#496d89";

/**
 * Shape channel for `variant="back"`: a dash pattern plus a reduced stroke
 * opacity on the same `--flow-edge` token. Dashes are readable in greyscale
 * and under any theme, so the back edge never depends on hue (WCAG 1.4.1).
 */
const BACK_EDGE_DASHARRAY = "6 4";
const BACK_EDGE_OPACITY = 0.7;
/**
 * Horizontal clearance, in px, between a back edge and the forward edge
 * joining the same two nodes. Applied to `getSmoothStepPath`'s `offset` (how
 * far the path runs straight out of a handle) AND to `centerX` (where its
 * cross-segment sits), so the two never overlay each other.
 */
const BACK_EDGE_CLEARANCE = 40;

const DEFAULT_BACK_EDGE_LABEL = "Back edge — runs against the process direction";

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

function toHexByte(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, "0");
}

/** Linear RGB interpolation between two hex colors — pure, no DOM. */
function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = ar + (br - ar) * t;
  const g = ag + (bg - ag) * t;
  const bl = ab + (bb - ab) * t;
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(bl)}`;
}

/**
 * Resolve `data.value`/`data.valueDomain` into a stroke color interpolated
 * between the `--flow-edge-weak`/`--flow-edge-strong` tokens. Returns
 * `undefined` when either input is missing, so the caller can fall back to
 * the plain `--flow-edge` token (unweighted-looking) edge color.
 */
function resolveValueStrokeColor(
  value: number | undefined,
  domain: [number, number] | undefined,
): string | undefined {
  if (value === undefined || !domain) return undefined;
  const [lo, hi] = domain;
  const t = hi === lo ? 1 : clamp01((value - lo) / (hi - lo));
  const weak = resolveTokenColor("--flow-edge-weak", { fallback: FALLBACK_WEAK });
  const strong = resolveTokenColor("--flow-edge-strong", { fallback: FALLBACK_STRONG });
  return mixHex(weak, strong, t);
}

/**
 * Branded weighted edge: `data.weight` scales stroke width (min-maxed per
 * `data.scaleGroup` across every edge in the flow — see `computeEdgeWeightScale`,
 * exported so a sibling like a continuous `Legend` renders the same ramp);
 * `data.value` + `data.valueDomain` interpolate stroke colour between
 * `--flow-edge-weak` and `--flow-edge-strong`; `data.label`/`data.secondaryLabel`
 * render as an `EdgeLabelPill`. An edge with none of this data renders exactly
 * like `FlowEdge` (fixed 1.5px, `--flow-edge` token) — fully backward-compatible.
 * Register it in `edgeTypes={{ weighted: FlowWeightedEdge }}` and create edges
 * with `type: "weighted"` and `data: FlowWeightedEdgeData`.
 *
 * `data.variant: "back"` marks an edge that runs against the process direction
 * (dagre's reversed edges — see `layoutFlow`'s `backEdges`). It is dashed and
 * routed clear of the forward edge between the same two nodes, and carries a
 * real accessible name; the default `"forward"` renders exactly as before.
 *
 * Selected state uses `--ring` (matching the `ring-ring` treatment `FlowNode`/
 * `FlowGroupNode` use), overriding weight/value-derived width and colour so a
 * selected edge always reads clearly. No stroke-dasharray animation — reduced
 * motion is respected because there is no motion to reduce.
 *
 * KEYBOARD FOCUS is a separate state, drawn by `FlowEdgePath` (#286): selection
 * needs a consumer's `onEdgesChange` to ever become true, so it can never be the
 * indicator a tab stop owes its user.
 */
export function FlowWeightedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  data,
}: EdgeProps<BrandFlowWeightedEdge>) {
  const edges = useEdges();
  const widthByEdgeId = useMemo(
    () => computeEdgeWeightScale(edges as unknown as WeightedEdgeLike[]),
    [edges],
  );

  const variant = data?.variant ?? "forward";
  const isBack = variant === "back";
  const pathType = data?.path ?? "bezier";
  const [edgePath, labelX, labelY] = isBack
    ? getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        offset: BACK_EDGE_CLEARANCE,
        centerX: (sourceX + targetX) / 2 + BACK_EDGE_CLEARANCE,
      })
    : pathType === "smoothstep"
      ? getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
      : getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const scaledWidth = widthByEdgeId.get(id) ?? DEFAULT_EDGE_WIDTH_RANGE[0];
  const valueColor = useMemo(
    () => resolveValueStrokeColor(data?.value, data?.valueDomain),
    [data?.value, data?.valueDomain],
  );

  const stroke = selected ? "var(--ring)" : (valueColor ?? "var(--flow-edge)");
  const strokeWidth = selected ? scaledWidth + 1.5 : scaledWidth;

  const edge = (
    <FlowEdgePath
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      data-slot="flow-weighted-edge"
      data-variant={variant}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={isBack ? BACK_EDGE_DASHARRAY : undefined}
      strokeOpacity={isBack ? BACK_EDGE_OPACITY : undefined}
      style={style}
    />
  );

  return (
    <>
      {isBack ? (
        // A `data-variant` is invisible to assistive technology, so the back
        // edge's meaning is also published as a named graphic. Only the back
        // variant is wrapped — a forward edge's DOM is unchanged from before
        // this prop existed.
        <g role="img" aria-label={data?.variantLabel ?? DEFAULT_BACK_EDGE_LABEL}>
          {edge}
        </g>
      ) : (
        edge
      )}
      <EdgeLabelPill
        label={data?.label}
        secondaryLabel={data?.secondaryLabel}
        x={labelX}
        y={labelY}
        selected={selected}
      />
    </>
  );
}
