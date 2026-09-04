import { EdgeLabelRenderer } from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface EdgeLabelPillProps {
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
 */
export function EdgeLabelPill({ label, secondaryLabel, x, y, selected }: EdgeLabelPillProps) {
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
          className={cn(
            "pointer-events-auto flex items-center gap-1 rounded-full border bg-flow-node px-2 py-0.5",
            "text-meta font-medium text-flow-node-foreground shadow-sm",
            "transition-colors duration-fast ease-standard",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selected ? "border-ring" : "border-flow-group-border",
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
