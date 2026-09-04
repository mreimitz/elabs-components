/**
 * distribution-kind.ts — the contract every `kinds/*.tsx` file honours (RM-026).
 *
 * Four marks, one prop bag. A kind receives a group, a colour, the shared
 * geometry and two callbacks, and it may read NOTHING else — no container
 * context, no scale of its own. That is what makes `kind` a genuine switch
 * between readings of one picture rather than four charts wearing one name.
 */
import type { TooltipRow } from "../tooltip/tooltip-content";
import type { DistributionGeometry } from "./distribution-geometry";
import type { DistributionGroup, DistributionRow } from "./distribution-groups";

/**
 * Which mark the numeric variable is drawn as.
 *
 * The `SKILL` decision tree for a grouped continuous distribution reads in this
 * order: `strip` (show the records) → `box` (show the summary) → `violin` (show
 * the shape) — each step trading detail for legibility as n grows, and each
 * needing a written reason. `histogram` is the ungrouped/one-variable default.
 *
 * `"ridge"` is deliberately absent: ridgelines need occlusion ordering and a
 * per-row baseline that the shared band layout here does not model, so they are
 * a follow-up rather than a fifth string nobody implemented.
 */
export type DistributionKind = "histogram" | "box" | "violin" | "strip";

/** What a mark hands back when the pointer enters it. */
export interface DistributionTooltipPayload {
  /** Position in PLOT coordinates; the container adds its own margins. */
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

/** Fired when a mark is activated by pointer. */
export type DistributionActivateHandler = (
  row: DistributionRow,
  rowIndex: number,
  value: number,
  event: React.MouseEvent,
) => void;

/** The props every kind takes. */
export interface DistributionKindProps {
  /** The group this mark draws. */
  group: DistributionGroup;
  /** The resolved series colour (a `var(--chart-…)` reference, never a literal). */
  color: string;
  /** The shared scale + band layout. */
  geometry: DistributionGeometry;
  /** Draw the median flag / tick. */
  showMedian: boolean;
  /** Locale-aware value formatter from the container. */
  formatValue: (value: number) => string;
  /** Pointer entered / left a mark. `null` means "left". */
  onHover: (payload: DistributionTooltipPayload | null) => void;
  /** Pointer activation, when the container is interactive. */
  onActivate?: DistributionActivateHandler;
}
