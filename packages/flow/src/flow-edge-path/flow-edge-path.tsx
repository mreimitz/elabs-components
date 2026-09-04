import type { CSSProperties, SVGProps } from "react";
import { BaseEdge } from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/**
 * Extra stroke width, in px, of the `--ring` band drawn around a focused edge.
 * The band sits *outside* the edge's own stroke, so it is visible whatever the
 * edge's resting width is.
 */
export const FLOW_EDGE_FOCUS_RING_WIDTH = 3;

/**
 * Extra stroke width, in px, of the neutral contour drawn outside the `--ring`
 * band. This is the layer that carries the WCAG 1.4.11 bar: `--foreground`
 * measures 12.50:1 against `--canvas` in `light` and 16.25:1 in `dark`, where
 * `--ring` alone measures 1.30:1 in `light` (issue #286).
 */
export const FLOW_EDGE_FOCUS_CONTOUR_WIDTH = 6;

export interface FlowEdgePathProps extends Omit<
  SVGProps<SVGPathElement>,
  "path" | "stroke" | "strokeWidth" | "style" | "ref"
> {
  /** SVG path `d` for this edge, from `getBezierPath`/`getSmoothStepPath`/… */
  path: string;
  /** Resting stroke paint — a `var(--token)` reference or a resolved colour. */
  stroke: string;
  /** Resting stroke width in px. The focus layers are drawn wider than this. */
  strokeWidth: number;
  /** Dash pattern, applied to the edge AND to both focus layers so a dashed edge keeps its shape when focused. */
  strokeDasharray?: string;
  /** Stroke opacity for the edge itself. Never applied to the focus layers. */
  strokeOpacity?: number;
  /** React Flow marker url, e.g. from `EdgeProps.markerEnd`. */
  markerEnd?: string;
  /** React Flow marker url, e.g. from `EdgeProps.markerStart`. */
  markerStart?: string;
  /** Width of the invisible pointer-target path React Flow draws over the edge. */
  interactionWidth?: number;
  /** Merged onto the edge path, last — so a consumer's `style.stroke` still wins. */
  style?: CSSProperties;
}

/**
 * The edge path every brand edge type draws, with the keyboard focus indicator
 * built in. **Use this instead of React Flow's `BaseEdge`** — a custom edge that
 * reaches for `BaseEdge` directly ships with no focus indicator at all, which is
 * the defect issue #286 records (and `no-raw-base-edge.test.ts` fails on).
 *
 * ## Why the indicator is drawn rather than restyled
 *
 * React Flow zeroes the native outline on a focused edge
 * (`.react-flow__edge:focus-visible { outline: none }`) and substitutes a stroke
 * recolour on `.react-flow__edge-path`. Every brand edge passes its stroke as an
 * **inline style** on that exact path — `BaseEdge` spreads `style` onto it — and
 * an inline declaration beats any stylesheet rule, so the substitute never
 * painted. Focusing an edge changed nothing on screen: WCAG 2.4.7 failed on
 * every edge of every canvas, in both themes.
 *
 * The obvious repair — move the stroke into a custom property so a stylesheet
 * rule can reach it — does **not** work here, and that was measured rather than
 * assumed: React Flow's own `.react-flow__edge-path { stroke: … }` ships
 * **unlayered**, and unlayered CSS outranks anything in `@layer utilities`,
 * where Tailwind puts every utility. A `stroke-[var(--flow-edge-stroke)]` class
 * would therefore lose to React Flow's `#b1b1b7` default and repaint every edge
 * in the library. `!important` and setting `--xy-edge-stroke-selected` were both
 * rejected in the issue.
 *
 * So the indicator is drawn on two paths this component owns, under the edge and
 * on the same geometry. Nothing can shadow them: not React Flow's stylesheet,
 * not a consumer's inline `style.stroke`, not a future edge type's own painting.
 * They are hidden (`opacity-0`) until the ancestor `g.react-flow__edge` matches
 * `:focus-visible`, which is a plain descendant selector on classes only this
 * component uses.
 *
 * ## Compound, because one colour is not enough
 *
 * The indicator is two layers, per the compound-indicator recipe in
 * `.claude/rules/theming.md`: a neutral `--foreground` contour at
 * `strokeWidth + 6`, and the `--ring` band at `strokeWidth + 3` over it. The
 * contour is the layer that clears WCAG 1.4.11's 3:1 bar against `--canvas` in
 * both reference themes (12.50:1 `light`, 16.25:1 `dark`); a bare `--ring`
 * stroke would not (1.30:1 in `light`). It is opacity + stroke only — no
 * shadow — so it survives `data-decoration="8|9|10"`, which goes shadowless.
 */
export function FlowEdgePath({
  path,
  stroke,
  strokeWidth,
  strokeDasharray,
  strokeOpacity,
  markerEnd,
  markerStart,
  interactionWidth,
  className,
  style,
  ...props
}: FlowEdgePathProps) {
  // The focus layers repeat the edge's own dash pattern so a dashed edge (the
  // `"back"` variant) does not gain a solid halo. `"none"` is explicit rather
  // than omitted because React Flow's `.react-flow__edge.animated path` rule
  // sets a dasharray on *every* path inside an animated edge, ours included.
  const focusDash = strokeDasharray ?? "none";

  return (
    <>
      {/* Outer neutral contour — the layer that carries the 3:1 bar. */}
      <path
        d={path}
        fill="none"
        aria-hidden="true"
        data-slot="flow-edge-focus-contour"
        className="pointer-events-none stroke-foreground opacity-0 [.react-flow\_\_edge:focus-visible_&]:opacity-100"
        strokeWidth={strokeWidth + FLOW_EDGE_FOCUS_CONTOUR_WIDTH}
        strokeDasharray={focusDash}
        strokeLinecap="round"
      />
      {/* Inner --ring band, drawn over the contour and under the edge. */}
      <path
        d={path}
        fill="none"
        aria-hidden="true"
        data-slot="flow-edge-focus-ring"
        className="pointer-events-none stroke-ring opacity-0 [.react-flow\_\_edge:focus-visible_&]:opacity-100"
        strokeWidth={strokeWidth + FLOW_EDGE_FOCUS_RING_WIDTH}
        strokeDasharray={focusDash}
        strokeLinecap="round"
      />
      <BaseEdge
        {...props}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
        className={cn(
          "transition-[stroke,stroke-width] duration-fast ease-standard motion-reduce:transition-none",
          className,
        )}
        style={{
          stroke,
          strokeWidth,
          ...(strokeDasharray ? { strokeDasharray } : null),
          ...(strokeOpacity !== undefined ? { strokeOpacity } : null),
          ...style,
        }}
      />
    </>
  );
}
