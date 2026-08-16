import { type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/**
 * Per-pane surface tone — the ground-offset tiering axis (research 08 §H, #193).
 * `plain` keeps the ambient ground (default; non-breaking). `card` RAISES the pane as
 * a white `bg-card` + `shadow-sm` and is robust across all three themes — a card is
 * lighter than the page ground in BOTH light and dark, so it always reads as raised.
 * `muted` (`bg-surface-muted`) reads as a recessed well ONLY in light themes; in dark
 * themes `--surface-muted` is lighter than `--card`, so a `muted` pane reads as a faint
 * raised tint, not a recess (dark-mode layering only goes UP — there is no surface below
 * the page ground). For a guaranteed cross-theme raise/recess contrast, raise the focus
 * pane with `card` and leave the other `plain`.
 */
const paneToneVariants = cva("min-h-0 min-w-0 overflow-auto", {
  variants: {
    tone: {
      plain: "",
      muted: "bg-surface-muted",
      card: "bg-card shadow-sm",
    },
  },
  defaultVariants: { tone: "plain" },
});

export type SplitPanelTone = NonNullable<VariantProps<typeof paneToneVariants>["tone"]>;

export interface SplitPanelProps {
  start: ReactNode;
  end: ReactNode;
  /** Layout axis. Defaults to "horizontal" (side-by-side). */
  direction?: "horizontal" | "vertical";
  /**
   * Size of the START pane as a CSS grid track (e.g. "320px", "40%", "1fr").
   * The END pane fills the remainder. Defaults to "1fr" (equal split).
   */
  startSize?: string;
  /** Show a thin divider between panes. Defaults to true. */
  divider?: boolean;
  /** Surface tone of the START pane (ground-offset tiering). Defaults to "plain". */
  startTone?: SplitPanelTone;
  /** Surface tone of the END pane (ground-offset tiering). Defaults to "plain". */
  endTone?: SplitPanelTone;
  className?: string;
  startClassName?: string;
  endClassName?: string;
}

/**
 * Two-pane layout for master/detail, editor/preview and inspector workflows.
 * Static sizing by design (predictable in tests/SSR); for drag-to-resize wrap
 * with a resize hook or compose `react-resizable-panels` at the app level.
 *
 * For a master/detail surface where the detail should read as a raised card on a
 * recessed list, use `startTone="muted" endTone="card"` (ground-offset tiering).
 */
export function SplitPanel({
  start,
  end,
  direction = "horizontal",
  startSize = "1fr",
  divider = true,
  startTone = "plain",
  endTone = "plain",
  className,
  startClassName,
  endClassName,
}: SplitPanelProps) {
  const isHorizontal = direction === "horizontal";
  const style = isHorizontal
    ? { gridTemplateColumns: `${startSize} minmax(0, 1fr)` }
    : { gridTemplateRows: `${startSize} minmax(0, 1fr)` };
  return (
    <div
      className={cn(
        "grid h-full w-full",
        isHorizontal ? "grid-flow-col" : "grid-flow-row",
        className,
      )}
      style={style}
    >
      <div className={cn(paneToneVariants({ tone: startTone }), startClassName)}>{start}</div>
      <div
        className={cn(
          paneToneVariants({ tone: endTone }),
          divider && (isHorizontal ? "border-s" : "border-t"),
          endClassName,
        )}
      >
        {end}
      </div>
    </div>
  );
}
