"use client";

import { forwardRef, type ReactNode, type SVGProps } from "react";
import { HaloText } from "./halo-text";
import { Leader, type LeaderDash, type LeaderKind, type LeaderPoint } from "./leader";

/**
 * Average advance of one italic glyph, as a fraction of the font size. SVG text
 * cannot be measured without a layout pass (jsdom and SSR have none), so line
 * breaks use this estimate. 0.6em is deliberately generous for a proportional
 * sans: a line that breaks one word early is fine, a line that clips is not.
 */
const GLYPH_ADVANCE_EM = 0.6;

/** Line pitch for a wrapped note, as a multiple of the font size. */
const LINE_HEIGHT_EM = 1.25;

/** Gap in px between the leader's tip and the first glyph of the note. */
const NOTE_GAP = 3;

/** One wrapped line, keyed by where it starts in the note. */
interface NoteLine {
  text: string;
  offset: number;
}

/**
 * Break a note into lines no wider than `maxWidth` (estimated), greedily by
 * word. A single word longer than the line gets a line of its own rather than
 * being split mid-word.
 */
export function wrapNote(text: string, maxWidth: number, fontSize: number): NoteLine[] {
  const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * GLYPH_ADVANCE_EM)));
  const lines: NoteLine[] = [];
  let line: NoteLine | null = null;
  // `**` bold markers take no room on the line, so they never count.
  const visible = (s: string) => s.replace(/\*\*/g, "").length;
  for (const match of text.matchAll(/\S+/g)) {
    const word = match[0];
    const offset = match.index ?? 0;
    if (line === null) {
      line = { text: word, offset };
    } else if (visible(line.text) + 1 + visible(word) > maxChars) {
      lines.push(line);
      line = { text: word, offset };
    } else {
      line = { text: `${line.text} ${word}`, offset: line.offset };
    }
  }
  if (line !== null) lines.push(line);
  return lines;
}

/** How many lines `wrapNote` breaks a note into — for callers that place the block. */
export function estimateNoteLines(text: string, maxWidth: number, fontSize: number): number {
  return Math.max(1, wrapNote(text, maxWidth, fontSize).length);
}

/** The line pitch of a wrapped note, in px, at `fontSize`. */
export function noteLineHeight(fontSize: number): number {
  return fontSize * LINE_HEIGHT_EM;
}

/**
 * Render one wrapped line, turning the inline `**bold**` subset into bold
 * `<tspan>`s. `boldOpen` carries a bold run across a line break; returns the
 * nodes and whether bold is still open after this line.
 */
function renderInlineBold(text: string, boldOpen: boolean): [ReactNode[], boolean] {
  if (!text.includes("**")) {
    return [
      [
        boldOpen ? (
          <tspan fontWeight="bold" key="0">
            {text}
          </tspan>
        ) : (
          text
        ),
      ],
      boldOpen,
    ];
  }
  const nodes: ReactNode[] = [];
  let bold = boldOpen;
  text.split("**").forEach((part, i) => {
    if (i > 0) bold = !bold;
    if (!part) return;
    nodes.push(
      bold ? (
        <tspan fontWeight="bold" key={i}>
          {part}
        </tspan>
      ) : (
        <tspan key={i}>{part}</tspan>
      ),
    );
  });
  return [nodes, bold];
}

/** The wrapped lines as `<tspan>`s, with a bold run carried across breaks. */
function renderLines(lines: NoteLine[], x: number, fontSize: number): ReactNode[] {
  let bold = false;
  return lines.map((line, i) => {
    const [nodes, open] = renderInlineBold(line.text, bold);
    bold = open;
    return (
      <tspan
        data-slot="marginalia-line"
        dy={i === 0 ? 0 : fontSize * LINE_HEIGHT_EM}
        key={line.offset}
        x={x}
      >
        {nodes}
      </tspan>
    );
  });
}

export interface MarginaliaProps extends Omit<SVGProps<SVGGElement>, "x" | "y"> {
  /**
   * The mark the note is about — where the leader starts. Omit it for a free
   * note with no leader (a declarative `text` annotation without a connector).
   */
  anchor?: LeaderPoint;
  /** Where the note itself sits — where the leader ends and the text begins. */
  x: number;
  /** Note y — the vertical middle of its first line. */
  y: number;
  /**
   * The note. A plain string wraps onto `<tspan>` lines when `maxWidth` is set;
   * any other node (your own `<tspan>`s) is rendered as given.
   */
  children: ReactNode;
  /**
   * The widest a line of the note may run, in the parent SVG's user units —
   * normally the distance from `x` to the plot's edge. A string note longer than
   * this wraps onto further lines instead of running off the canvas and being
   * clipped. Omit it and the note is a single line.
   */
  maxWidth?: number;
  /**
   * Halo colour, forwarded to the note's `HaloText`. Defaults to the plot ground
   * (`var(--chart-background)`); override it with another semantic token when the
   * note crosses something other than the plot ground — a filled zone, a plate.
   */
  halo?: string;
  /** Leader shape (default `curve` — a marginal note is not part of the plot). */
  leaderKind?: LeaderKind;
  /** Leader dash rhythm (default `1 3`). */
  dash?: LeaderDash;
  /** Solid arrow head at `anchor`, pointing at the mark (RM-111). Default `false`. */
  arrow?: boolean;
  /**
   * Note ink (default `var(--chart-foreground-muted)`). A declarative annotation
   * passes the resolved series stroke here to tie the note to its series.
   */
  noteFill?: string;
  /** Leader ink (default: the `Leader` default, `var(--chart-foreground-muted)`). */
  leaderStroke?: string;
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
 * build (see `.claude/rules/charts.md`).
 *
 * SVG `<text>` does not wrap, so the component does: pass `maxWidth` and a string
 * note breaks onto `<tspan>` lines at an estimated glyph width. Without
 * `maxWidth` the note is one line, and a note placed near an edge WILL clip.
 *
 * ## Composition
 *
 * A `Leader` from `anchor` to just before the note, and a `HaloText` — italic,
 * muted, one step below body size — so the note stays readable where it crosses
 * the plot and still reads as commentary rather than as a label the chart
 * produced.
 *
 * ## Accessibility
 *
 * `aria-hidden` on its own root, like every mark in this layer, so it never
 * depends on an ancestor happening to be hidden. The note is therefore NOT read
 * to assistive tech: a chart that renders one must carry the same remark in its
 * accessible label, description or summary (`.claude/rules/charts.md` § Marks).
 */
export const Marginalia = forwardRef<SVGGElement, MarginaliaProps>(function Marginalia(
  {
    anchor,
    x,
    y,
    children,
    maxWidth,
    halo,
    leaderKind = "curve",
    dash = "1 3",
    arrow = false,
    noteFill = "var(--chart-foreground-muted)",
    leaderStroke,
    fontSize = 10,
    textAnchor = "start",
    ...props
  },
  ref,
) {
  const lines =
    typeof children === "string" && maxWidth !== undefined
      ? wrapNote(children, maxWidth, fontSize)
      : null;
  // The leader stops just short of the note, so it points AT the text instead
  // of running into its first glyph.
  const tipX = textAnchor === "start" ? x - NOTE_GAP : textAnchor === "end" ? x + NOTE_GAP : x;

  return (
    <g aria-hidden="true" data-slot="marginalia" ref={ref} {...props}>
      {anchor ? (
        <Leader
          arrow={arrow}
          dash={dash}
          from={anchor}
          kind={leaderKind}
          stroke={leaderStroke}
          to={[tipX, y]}
        />
      ) : null}
      <HaloText
        data-slot="marginalia-note"
        dominantBaseline="middle"
        fill={noteFill}
        fontSize={fontSize}
        fontStyle="italic"
        halo={halo}
        textAnchor={textAnchor}
        x={x}
        y={y}
      >
        {lines ? renderLines(lines, x, fontSize) : children}
      </HaloText>
    </g>
  );
});
