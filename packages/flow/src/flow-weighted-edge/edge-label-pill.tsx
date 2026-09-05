import type { ComponentPropsWithoutRef } from "react";
import { EdgeLabelRenderer } from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface EdgeLabelPillProps extends ComponentPropsWithoutRef<"button"> {
  /** Primary label, e.g. a frequency count ("128×"). */
  label?: string;
  /** Secondary label rendered alongside the primary, e.g. a duration ("3.4d avg"). */
  secondaryLabel?: string;
  /** Label anchor, from `getBezierPath`/`getSmoothStepPath`'s `labelX`/`labelY`. */
  x: number;
  y: number;
  /** Matches the parent edge's `selected` state. */
  selected?: boolean;
}

/**
 * A small HTML pill (via `EdgeLabelRenderer`, not SVG `<text>`) anchored at an
 * edge's label point — so it can theme, wrap, and carry two values, unlike a
 * bare SVG text node. Renders nothing when neither label is set. Real
 * `<button>` so it is a genuine keyboard tab stop with a visible focus ring;
 * `pointer-events: auto` on an otherwise `nodrag nopan` wrapper so it doesn't
 * drag/pan the canvas, and doesn't block hovering the edge underneath it (the
 * wrapper is sized to the pill itself, not the whole edge).
 *
 * `className`/`...props` spread onto the root `<button>` (`data-slot="edge-label-pill"`)
 * so a consumer that composes this pill from outside `@elabs-ai/components-flow` —
 * `@elabs-ai/components-process`'s `ProcessTransitionEdge` is the reference caller —
 * can reach it directly (a dashed frame, a `data-selection` attribute) without a new
 * semantic prop on this component. `className` merges LAST via `cn()`, so a caller can
 * override any of the pill's own utility classes; omitting both leaves every existing
 * caller's rendered markup unchanged.
 */
export function EdgeLabelPill({
  label,
  secondaryLabel,
  x,
  y,
  selected,
  className,
  ...props
}: EdgeLabelPillProps) {
  if (!label && !secondaryLabel) return null;

  const accessibleName = [label, secondaryLabel].filter(Boolean).join(" · ");

  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          pointerEvents: "none",
        }}
        className="nodrag nopan"
        data-slot="edge-label-pill-anchor"
      >
        <button
          type="button"
          aria-label={accessibleName}
          data-slot="edge-label-pill"
          {...props}
          className={cn(
            "pointer-events-auto flex items-center gap-1 rounded-full border bg-flow-node px-2 py-0.5",
            "text-meta font-medium text-flow-node-foreground shadow-sm",
            "transition-colors duration-fast ease-standard",
            "focus-ring",
            selected ? "border-ring" : "border-flow-group-border",
            className,
          )}
        >
          {label ? <span aria-hidden="true">{label}</span> : null}
          {secondaryLabel ? (
            <span aria-hidden="true" className="text-flow-node-foreground/70 tabular-nums">
              {secondaryLabel}
            </span>
          ) : null}
        </button>
      </div>
    </EdgeLabelRenderer>
  );
}
