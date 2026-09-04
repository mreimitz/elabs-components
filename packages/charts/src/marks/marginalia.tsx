"use client";

import { forwardRef, type ReactNode, type SVGProps } from "react";
import { HaloText } from "./halo-text";
import { Leader, type LeaderDash, type LeaderKind, type LeaderPoint } from "./leader";

export interface MarginaliaProps extends Omit<SVGProps<SVGGElement>, "x" | "y"> {
  /** The mark the note is about — where the leader starts. */
  anchor: LeaderPoint;
  /** Where the note itself sits — where the leader ends and the text baseline begins. */
  x: number;
  /** Note baseline y. */
  y: number;
  /** The note. Plain text, or `<tspan>`s for more than one line. */
  children: ReactNode;
  /** Leader shape (default `curve` — a marginal note is not part of the plot). */
  leaderKind?: LeaderKind;
  /** Leader dash rhythm (default `1 3`). */
  dash?: LeaderDash;
  /** Note font size in px (default 10). */
  fontSize?: number;
  /** Text anchor for the note (default `start`). */
  textAnchor?: "start" | "middle" | "end";
}

/**
 * Marginalia — an italic note in the margin, tied to its mark by a `Leader`.
 *
 * Provenance: `L2 Weather Almanac` and `L4 Thread Ledger` in the lieflat gallery,
 * where the analyst's own remark ("first frost", "the week the queue cleared")
 * sits beside the plot in the hand of a reader who has annotated a printed chart.
 *
 * ## The one hard rule: SVG `<text>`, never `foreignObject`
 *
 * It is tempting to drop an HTML paragraph in with `<foreignObject>` and get
 * wrapping, ellipsis and the type scale for free. Do not. A `foreignObject`
 * subtree does not survive `ChartFrame`'s download-as-image path, is rendered
 * inconsistently across engines, and — the reason that matters most here — it
 * would smuggle focusable, AT-visible HTML inside the `aria-hidden` chart body,
 * which is the axe `aria-hidden-focus` violation this package treats as a red
 * build (see `.claude/rules/chart-components.md`). Pass `<tspan>`s for a second
 * line.
 *
 * ## Composition
 *
 * A `Leader` from `anchor` to the note, and a `HaloText` — italic, muted, one
 * step below body size — so the note stays readable where it crosses the plot
 * and still reads as commentary rather than as a label the chart produced.
 */
export const Marginalia = forwardRef<SVGGElement, MarginaliaProps>(function Marginalia(
  {
    anchor,
    x,
    y,
    children,
    leaderKind = "curve",
    dash = "1 3",
    fontSize = 10,
    textAnchor = "start",
    ...props
  },
  ref,
) {
  return (
    <g data-slot="marginalia" ref={ref} {...props}>
      <Leader dash={dash} from={anchor} kind={leaderKind} to={[x, y]} />
      <HaloText
        data-slot="marginalia-note"
        dominantBaseline="middle"
        fill="var(--chart-foreground-muted)"
        fontSize={fontSize}
        fontStyle="italic"
        textAnchor={textAnchor}
        x={x}
        y={y}
      >
        {children}
      </HaloText>
    </g>
  );
});
