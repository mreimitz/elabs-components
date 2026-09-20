import * as React from "react";
import { cn } from "../../lib/cn";

/** Which corner of the host the drawing grows out of. Logical: `start`/`end` follow the text direction. */
export type DraftingMarksAnchor = "top-start" | "top-end" | "bottom-start" | "bottom-end";

export interface DraftingMarksProps extends Omit<React.SVGAttributes<SVGSVGElement>, "children"> {
  /** The corner the construction grows out of, and fades away from. Default `"top-start"`. */
  anchor?: DraftingMarksAnchor;
  /**
   * Ink the two small accents — a `--primary` station point and a `--chart-2` tinted plate.
   * `false` keeps the whole drawing in rule ink. Default `true`.
   */
  accent?: boolean;
}

/** The drawing's own size, in px. Fixed, so every hairline stays one device-crisp pixel. */
export const DRAFTING_MARKS_WIDTH = 560;
export const DRAFTING_MARKS_HEIGHT = 360;

// The drawing is authored ONCE, growing out of the top-left corner; the other three anchors
// are the same drawing mirrored. `start`/`end` are logical, so the mirror itself flips under RTL.
const ANCHOR_CLASS: Record<DraftingMarksAnchor, string> = {
  "top-start": "top-0 start-0 rtl:-scale-x-100",
  "top-end": "top-0 end-0 -scale-x-100 rtl:scale-x-100",
  "bottom-start": "bottom-0 start-0 -scale-y-100 rtl:-scale-x-100",
  "bottom-end": "bottom-0 end-0 -scale-100 rtl:scale-x-100",
};

/**
 * DraftingMarks — a quiet construction drawing in one corner of a header or hero band: two
 * guides that cross at a station point, the arcs struck from it, a dimension tick, a field of
 * dots and a few registration crosses. It is the hairline family's one ILLUSTRATION: where the
 * `hairline-*` utilities rule edges, this gives an empty corner the look of a sheet someone
 * measured on.
 *
 * Decorative and inert: `aria-hidden`, `pointer-events: none`, absolutely positioned in the
 * corner named by `anchor` and faded out away from it, so it never reaches the text in the
 * middle of the band (`--drafting-marks-fade` swaps the falloff — e.g.
 * `var(--deco-fade-corner-tight)` where the copy comes close). Put it first inside a positioned (`relative`) host that clips
 * (`overflow-hidden`). Lines take the theme's `--hairline-ink-strong`; the two accents take
 * `--primary` and `--chart-2` — no literal colour, so it re-inks with the theme.
 *
 * One per band, in a corner the content leaves empty. It is a ground gesture like the paper
 * utilities — never behind body text, never inside a control.
 */
export const DraftingMarks = React.forwardRef<SVGSVGElement, DraftingMarksProps>(
  function DraftingMarks({ anchor = "top-start", accent = true, className, style, ...props }, ref) {
    const dotsId = `drafting-dots-${React.useId().replace(/:/g, "")}`;
    return (
      <svg
        ref={ref}
        aria-hidden="true"
        data-slot="drafting-marks"
        data-anchor={anchor}
        fill="none"
        height={DRAFTING_MARKS_HEIGHT}
        width={DRAFTING_MARKS_WIDTH}
        viewBox={`0 0 ${DRAFTING_MARKS_WIDTH} ${DRAFTING_MARKS_HEIGHT}`}
        stroke="var(--hairline-ink-strong)"
        strokeWidth={1}
        className={cn("pointer-events-none absolute max-w-none", ANCHOR_CLASS[anchor], className)}
        style={{
          // Fades away from its own corner (authored top-left; the mirror carries the mask along).
          maskImage: "var(--drafting-marks-fade, var(--deco-fade-corner))",
          WebkitMaskImage: "var(--drafting-marks-fade, var(--deco-fade-corner))",
          ...style,
        }}
        {...props}
      >
        <defs>
          <pattern id={dotsId} width={12} height={12} patternUnits="userSpaceOnUse">
            <circle cx={6} cy={6} r={0.75} fill="var(--hairline-ink-strong)" stroke="none" />
          </pattern>
        </defs>

        {/* The dot field, tucked between the guides. */}
        <rect x={132} y={36} width={216} height={48} fill={`url(#${dotsId})`} stroke="none" />

        {/* The tinted plate, hung from the horizontal guide. */}
        {accent ? (
          <rect
            x={40}
            y={96.5}
            width={56}
            height={44}
            fill="var(--chart-2)"
            fillOpacity={0.16}
            stroke="none"
          />
        ) : null}

        {/* Guides: they cross at the station point (96.5, 96.5). Half-pixel centres keep a
            1px stroke on one device row. */}
        <path d="M0 96.5H520M520 90.5v12" />
        <path d="M96.5 0v300M90.5 300.5h12" />
        <path d="M72.5 24v250M0 140.5h210" strokeDasharray="1 4" />

        {/* Arcs struck from the station point. */}
        <path d="M252.5 96.5A156 156 0 0 1 40 241.8" />
        <path d="M96.5 40.5A56 56 0 0 0 40.5 96.5V241.8" />
        <path d="M40.5 222.5h78M118.5 218.5v8" />

        {/* A dimension tick and the registration crosses. */}
        <path d="M18.5 40v28M14.5 40.5h8M14.5 67.5h8" />
        <path d="M52 322.5h12M58.5 316v12M404 44.5h12M410.5 38v12M236 292.5h12M242.5 286v12" />

        {/* A door-swing of three concentric arcs, further along the floor line. */}
        <path d="M300.5 300.5H470M300.5 300.5V236M300.5 244.5A56 56 0 0 1 356.5 300.5M300.5 252.5A48 48 0 0 1 348.5 300.5M300.5 260.5A40 40 0 0 1 340.5 300.5" />

        {accent ? (
          <>
            <rect x={289} y={222} width={7} height={12} fill="var(--primary)" stroke="none" />
            <circle cx={96.5} cy={96.5} r={3} fill="var(--primary)" stroke="none" />
          </>
        ) : null}
      </svg>
    );
  },
);
