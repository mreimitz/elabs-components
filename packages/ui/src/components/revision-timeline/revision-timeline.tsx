"use client";

/**
 * RevisionTimeline — a presentational git-history timeline.
 *
 * Renders revisions (newest-first) with:
 *   - Day grouping by calendar day from `timestamp`
 *   - An SVG lane gutter for branch-graph lanes and merge joins
 *   - Churn indicators (+additions / -deletions)
 *   - A selection rail (controlled + uncontrolled)
 *
 * The APP computes the graph layout (lane indices, edges). This component
 * only renders what it receives. Heavy graph-math stays out.
 *
 * GATE NOTES:
 *   - No identifier starting with `Timeline` (timeline-fork class 1).
 *   - Lanes/connectors drawn with SVG <line> / <path>, NOT `absolute w-px`
 *     hairlines (timeline-fork class 2 avoidance).
 */

import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useMemo,
  useState,
  type HTMLAttributes,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronRight, GitBranch, GitCommitHorizontal, GitMerge, Plus, Minus } from "lucide-react";
import { cn } from "../../lib/cn";

// ─── Public data types ────────────────────────────────────────────────────────

/**
 * A single revision entry. The APP assigns `lane` (0-based column index),
 * computes `additions`/`deletions`, and orders revisions newest-first.
 */
export interface Revision {
  /** Unique identifier — used for selection + edge references. */
  id: string;
  /** Commit message (may be long; the component truncates). */
  message: string;
  /** Display name of the commit author. */
  author?: string;
  /** Avatar image URL for the author. */
  authorAvatar?: string;
  /** When the commit was authored. Accepts Date, ISO string, or epoch ms. */
  timestamp: Date | string | number;
  /** Short commit hash (e.g. "a1b2c3d"). */
  shortSha?: string;
  /** Lines added (churn indicator). */
  additions?: number;
  /** Lines deleted (churn indicator). */
  deletions?: number;
  /**
   * Column index assigned by the app (0-based). Lane 0 = main branch (leftmost).
   * Used to position the node dot and draw the lane spine in the SVG gutter.
   */
  lane: number;
  /** Branch or tag labels rendered as chips on this revision. */
  refs?: string[];
  /**
   * Branch identity for the collapse/expand mode. Opt-in: only takes effect when
   * a matching `branches` entry is supplied to `RevisionTimeline`. When omitted
   * (or unmatched), the revision renders as a normal, never-collapsible row.
   */
  branchId?: string;
}

/**
 * A parent link between two revisions, for the lane graph.
 * Used to draw merge joins (curves / angled lines) in the SVG gutter.
 */
export interface RevisionEdge {
  /** Id of the child revision (newer, higher in the list). */
  from: string;
  /** Id of the parent revision (older, lower in the list). */
  to: string;
}

/**
 * A collapsible branch in the history. The APP supplies these (it already
 * computes lanes + edges); listing a branch here makes it collapsible. Nesting
 * via `parentBranchId` lets a parent branch's collapse also fold its descendants
 * (multi-level). Omitting a branch from this list keeps its commits permanently
 * visible (e.g. the trunk).
 */
export interface RevisionBranch {
  /** Stable id, referenced by `Revision.branchId` and other branches' `parentBranchId`. */
  id: string;
  /** Human label for the collapsed summary row. Defaults to `id`. */
  name?: string;
  /** Parent branch id — enables multi-level nesting in the collapse hierarchy. */
  parentBranchId?: string;
}

// ─── Variants ────────────────────────────────────────────────────────────────

/** Visual density variants for the timeline. */
export const revisionTimelineVariants = cva("flex flex-col", {
  variants: {
    density: {
      comfortable: "gap-0",
      compact: "gap-0",
    },
  },
  defaultVariants: { density: "comfortable" },
});

export type RevisionTimelineDensity = NonNullable<
  VariantProps<typeof revisionTimelineVariants>["density"]
>;

// ─── Lane geometry helpers ────────────────────────────────────────────────────

/**
 * The number of chart palette colors. Lane index is wrapped modulo this count,
 * so `lane % LANE_PALETTE_SIZE` never exceeds the token range 1-5.
 */
const LANE_PALETTE_SIZE = 5;

/** Lane index → CSS token string (`var(--chart-1)` … `var(--chart-5)`). */
export function laneColor(lane: number): string {
  return `var(--chart-${(lane % LANE_PALETTE_SIZE) + 1})`;
}

/** Width of one lane column in the SVG gutter (px). */
const LANE_W = 16;
/** Row height in the SVG gutter — must match the rendered row height. */
const ROW_H_COMFORTABLE = 48;
const ROW_H_COMPACT = 36;
/**
 * Fixed height of a day-group header. MUST match the rendered `DayHeader`'s box
 * so the SVG gutter's node dots stay aligned with their list rows once a header
 * inserts vertical space between groups (otherwise the graph desyncs from the
 * rows — the gutter and the list share one coordinate space).
 */
const DAY_HEADER_H = 32;
/** Radius of the node dot. */
const NODE_R = 4;
/**
 * Vertical length (px) the connector runs straight along a lane before turning
 * into the adjacent lane. A FIXED corner length (not a proportion of the row
 * span) makes a cross-lane join read as "leave the lane → short elbow → arrive",
 * so a branch clearly leads down into its parent lane instead of meandering
 * across the whole gap with a lazy midpoint S-curve.
 */
const EDGE_TURN = 16;
/**
 * One opacity for BOTH lane spines and cross-lane connectors so a fork/merge join
 * reads as one continuous line — a mismatch here leaves a visible seam exactly
 * where a branch should be leading into the previous level.
 */
const LANE_STROKE_OPACITY = 0.75;

/** X centre of a lane column in the SVG. */
function laneX(lane: number): number {
  return lane * LANE_W + LANE_W / 2;
}

// ─── Branch collapse model ────────────────────────────────────────────────────

/**
 * The minimal node shape the SVG gutter needs (lane position + id). Both real
 * revisions and synthetic collapsed-branch summary nodes satisfy this.
 */
interface GutterNode {
  id: string;
  lane: number;
}

/**
 * A list/gutter render item. Either a real revision row or a single summary row
 * standing in for a collapsed branch (placed at the branch's tip position).
 */
type RenderItem =
  | {
      kind: "revision";
      revision: Revision;
      /** True iff this row is the tip of an expanded, collapsible branch. */
      canCollapse: boolean;
      branchId?: string;
    }
  | {
      kind: "summary";
      branch: RevisionBranch;
      /** Hidden revisions in this branch's subtree (no double counting). */
      count: number;
      /** Lane the summary node sits on (the tip's lane). */
      lane: number;
      /** Synthetic, collision-free id (`summary:<branchId>`). */
      id: string;
      /** Tip timestamp — used for day grouping so the summary lands in the tip's day. */
      tipTimestamp: Date | string | number;
    };

interface BranchMaps {
  branchById: Map<string, RevisionBranch>;
  parentOf: Map<string, string | undefined>;
}

/** Index `branches` for O(1) lookup + parent-chain walks. Pure. */
function buildBranchMaps(branches: RevisionBranch[]): BranchMaps {
  const branchById = new Map<string, RevisionBranch>();
  const parentOf = new Map<string, string | undefined>();
  for (const b of branches) {
    branchById.set(b.id, b);
    parentOf.set(b.id, b.parentBranchId);
  }
  return { branchById, parentOf };
}

/**
 * Returns a memoised lookup: branch id → the TOP-MOST collapsed ancestor on its
 * parent chain (itself included), or `undefined` if nothing in the chain is
 * collapsed. Walking leaf→root and keeping the last collapsed hit yields the
 * highest collapsed ancestor, which is the branch whose summary absorbs the row.
 * Cycle-guarded (defensive against malformed app data).
 */
function makeTopCollapsed(parentOf: Map<string, string | undefined>, collapsedSet: Set<string>) {
  const cache = new Map<string, string | undefined>();
  return function topCollapsed(branchId: string): string | undefined {
    const cached = cache.get(branchId);
    if (cached !== undefined || cache.has(branchId)) return cached;
    let topMost: string | undefined;
    const visited = new Set<string>();
    let cur: string | undefined = branchId;
    while (cur !== undefined && !visited.has(cur)) {
      visited.add(cur);
      if (collapsedSet.has(cur)) topMost = cur;
      cur = parentOf.get(cur);
    }
    cache.set(branchId, topMost);
    return topMost;
  };
}

interface ComputeResult {
  items: RenderItem[];
  /** Hidden revision id → the summary item id that absorbed it (for edge remap). */
  summaryOf: Map<string, string>;
}

/**
 * Single newest-first pass over `revisions` → the visible render-item list.
 *
 * A revision is hidden when its branch (or any ancestor branch) is collapsed; the
 * FIRST hidden revision of a collapsed subtree (the tip, since order is
 * newest-first) is replaced by ONE summary row at its slot, and the rest are
 * dropped. Each hidden revision is counted against its top-most collapsed
 * ancestor only, so nested collapse never double-counts. Light: Map/Set lookups
 * and a shallow parent-chain walk — no graph math.
 */
function computeRenderItems(
  revisions: Revision[],
  collapsedSet: Set<string>,
  maps: BranchMaps,
): ComputeResult {
  const items: RenderItem[] = [];
  const summaryOf = new Map<string, string>();
  const summaryCount = new Map<string, number>();
  const summaryEmitted = new Set<string>();
  const seenVisibleBranch = new Set<string>();
  const topCollapsed = makeTopCollapsed(maps.parentOf, collapsedSet);

  for (const rev of revisions) {
    const bid = rev.branchId;
    // Unknown branch ids (not in `branches`) are never hidden / never collapsible.
    if (bid !== undefined && maps.branchById.has(bid)) {
      const top = topCollapsed(bid);
      if (top !== undefined) {
        const summaryId = `summary:${top}`;
        summaryOf.set(rev.id, summaryId);
        summaryCount.set(top, (summaryCount.get(top) ?? 0) + 1);
        if (!summaryEmitted.has(top)) {
          summaryEmitted.add(top);
          const branch = maps.branchById.get(top) ?? { id: top };
          items.push({
            kind: "summary",
            branch,
            count: 0,
            lane: rev.lane,
            id: summaryId,
            tipTimestamp: rev.timestamp,
          });
        }
        continue;
      }
      const canCollapse = !seenVisibleBranch.has(bid);
      seenVisibleBranch.add(bid);
      items.push({ kind: "revision", revision: rev, canCollapse, branchId: bid });
      continue;
    }

    items.push({ kind: "revision", revision: rev, canCollapse: false, branchId: bid });
  }

  for (const it of items) {
    if (it.kind === "summary") it.count = summaryCount.get(it.branch.id) ?? 0;
  }

  return { items, summaryOf };
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface RevisionTimelineCtx {
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

const RevisionTimelineContext = createContext<RevisionTimelineCtx | null>(null);

function useRevisionTimelineCtx(): RevisionTimelineCtx {
  const ctx = use(RevisionTimelineContext);
  if (!ctx) throw new Error("RevisionTimeline sub-parts must be inside <RevisionTimeline>");
  return ctx;
}

// ─── SVG lane gutter ─────────────────────────────────────────────────────────

interface LaneGutterProps {
  revisions: GutterNode[];
  edges: RevisionEdge[];
  /**
   * Map of revision id → vertical centre (px) in the gutter's coordinate space.
   * Computed by the parent so the gutter shares ONE coordinate space with the
   * list — it already accounts for day-header heights, so dots line up with
   * their rows even when `groupBy="day"` inserts headers between groups.
   */
  rowCenterY: Map<string, number>;
  /** Total gutter height (px) — equals the rendered list height. */
  height: number;
  className?: string;
}

/**
 * Renders the branch-graph SVG gutter. Draws:
 *   - A vertical spine per lane (coloured via chart tokens)
 *   - A filled circle node at each revision's lane position
 *   - Merge-join cubic-bezier curves between a child revision and its parent
 *     revision when they are in different lanes (cross-lane edges)
 *
 * All Y positions come from `rowCenterY` (header-aware), NOT `index * ROW_H`,
 * so the graph stays aligned with day-grouped rows. No `absolute w-px`
 * connectors — all drawing is SVG (timeline-fork safe).
 */
function LaneGutter({ revisions, edges, rowCenterY, height, className }: LaneGutterProps) {
  const maxLane = revisions.reduce((m, r) => Math.max(m, r.lane), 0);
  const svgW = (maxLane + 1) * LANE_W;

  const idToRev = useMemo(() => {
    const m = new Map<string, GutterNode>();
    for (const r of revisions) m.set(r.id, r);
    return m;
  }, [revisions]);

  // Each lane's first + last revision (in list order) bound its spine.
  const laneSpan = useMemo(() => {
    const first = new Map<number, string>();
    const last = new Map<number, string>();
    for (const r of revisions) {
      if (!first.has(r.lane)) first.set(r.lane, r.id);
      last.set(r.lane, r.id);
    }
    return { first, last };
  }, [revisions]);

  // Pre-count incoming edges per revision → merge detection.
  const incomingCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of edges) m.set(e.to, (m.get(e.to) ?? 0) + 1);
    return m;
  }, [edges]);

  if (height === 0 || revisions.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      width={svgW}
      height={height}
      className={cn("shrink-0 self-stretch", className)}
      style={{ minWidth: svgW }}
    >
      {/* Lane spines — one vertical line per lane from first to last revision */}
      {Array.from(laneSpan.last.entries()).map(([lane, lastId]) => {
        const firstId = laneSpan.first.get(lane);
        const y1 = firstId ? rowCenterY.get(firstId) : undefined;
        const y2 = rowCenterY.get(lastId);
        if (y1 === undefined || y2 === undefined) return null;
        const x = laneX(lane);
        return (
          <line
            key={`spine-${lane}`}
            x1={x}
            y1={y1}
            x2={x}
            y2={y2}
            stroke={laneColor(lane)}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={LANE_STROKE_OPACITY}
          />
        );
      })}

      {/* Edge connectors — cross-lane merge / fork joins. The line stays in its
          source lane for a fixed length (EDGE_TURN), turns through a short elbow,
          then runs straight into the target lane — so it leads cleanly into the
          previous level instead of drifting across the whole gap. */}
      {edges.map((edge, ei) => {
        const fromRev = idToRev.get(edge.from);
        const toRev = idToRev.get(edge.to);
        if (!fromRev || !toRev) return null;
        if (fromRev.lane === toRev.lane) return null; // covered by the spine
        const y1 = rowCenterY.get(fromRev.id);
        const y2 = rowCenterY.get(toRev.id);
        if (y1 === undefined || y2 === undefined) return null;
        const x1 = laneX(fromRev.lane);
        const x2 = laneX(toRev.lane);
        const dir = y2 >= y1 ? 1 : -1;
        // Tangent the curve to BOTH lanes (vertical at each end) with a fixed
        // corner length, capped so short joins don't overshoot.
        const k = Math.min(Math.abs(y2 - y1) / 2, EDGE_TURN);
        return (
          <path
            key={`edge-${ei}`}
            d={`M ${x1} ${y1} C ${x1} ${y1 + dir * k}, ${x2} ${y2 - dir * k}, ${x2} ${y2}`}
            stroke={laneColor(fromRev.lane)}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            opacity={LANE_STROKE_OPACITY}
          />
        );
      })}

      {/* Node dots — one circle per revision */}
      {revisions.map((rev) => {
        const x = laneX(rev.lane);
        const y = rowCenterY.get(rev.id);
        if (y === undefined) return null;
        const isMerge = (incomingCount.get(rev.id) ?? 0) >= 2;
        return (
          <g key={`node-${rev.id}`}>
            {isMerge ? (
              <>
                <circle
                  cx={x}
                  cy={y}
                  r={NODE_R + 2}
                  fill="var(--background)"
                  stroke={laneColor(rev.lane)}
                  strokeWidth={2}
                />
                <circle cx={x} cy={y} r={NODE_R - 1} fill={laneColor(rev.lane)} />
              </>
            ) : (
              <circle cx={x} cy={y} r={NODE_R} fill={laneColor(rev.lane)} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Day group header ─────────────────────────────────────────────────────────

interface DayHeaderProps {
  label: string;
}

function DayHeader({ label }: DayHeaderProps) {
  // Fixed height (DAY_HEADER_H) so the SVG gutter's coordinate space stays in
  // lockstep with the rendered rows — see LaneGutter / rowCenterY.
  return (
    <div
      role="separator"
      aria-label={label}
      style={{ height: DAY_HEADER_H }}
      className="box-border flex items-center gap-3 px-3"
    >
      <span className="text-meta font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

// ─── Churn indicator ──────────────────────────────────────────────────────────

interface ChurnProps {
  additions?: number;
  deletions?: number;
}

function Churn({ additions, deletions }: ChurnProps) {
  const hasAdditions = additions !== undefined && additions > 0;
  const hasDeletions = deletions !== undefined && deletions > 0;
  if (!hasAdditions && !hasDeletions) return null;

  return (
    <span
      className="flex shrink-0 items-center gap-1 tabular-nums text-meta text-muted-foreground"
      aria-label={`${additions ?? 0} additions, ${deletions ?? 0} deletions`}
    >
      {hasAdditions && (
        <span className="flex items-center gap-0.5 text-success-text" aria-hidden="true">
          <Plus aria-hidden="true" className="size-2.5" />
          {additions}
        </span>
      )}
      {hasDeletions && (
        <span className="flex items-center gap-0.5 text-destructive" aria-hidden="true">
          <Minus aria-hidden="true" className="size-2.5" />
          {deletions}
        </span>
      )}
    </span>
  );
}

// ─── Ref chip ─────────────────────────────────────────────────────────────────

function RefChip({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0.5 text-meta text-muted-foreground">
      {label}
    </span>
  );
}

// ─── Branch collapse UI ───────────────────────────────────────────────────────

/** A right-chevron that rotates 90° to point down when its branch is expanded. */
function BranchChevron({ expanded }: { expanded: boolean }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn(
        "size-3.5 shrink-0 text-muted-foreground transition-transform duration-fast ease-standard motion-reduce:transition-none",
        expanded && "rotate-90",
      )}
    />
  );
}

/**
 * The collapse toggle shown on an expanded branch's tip row. A standalone button
 * (a sibling of the row's select button — never nested inside it) so there are no
 * nested interactive elements.
 */
function BranchToggle({ branchName, onToggle }: { branchName: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={true}
      aria-label={`Collapse branch ${branchName}`}
      onClick={onToggle}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground",
        "transition-colors duration-fast ease-standard motion-reduce:transition-none",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <BranchChevron expanded />
    </button>
  );
}

interface CollapsedBranchRowProps {
  branchId: string;
  branchName: string;
  /** Pre-formatted trailing label, e.g. "3 commits" (default) or "3 steps". */
  summaryLabel: string;
  density: RevisionTimelineDensity;
  /** Left indent (px), proportional to the collapsed branch's lane depth. */
  indent: number;
  onExpand: () => void;
}

/**
 * The single summary row that stands in for a collapsed branch, placed at the
 * branch's tip position. The whole row IS the expand button (no nested
 * interactives), so it offers exactly one keyboard/AT target.
 */
function CollapsedBranchRow({
  branchId,
  branchName,
  summaryLabel,
  density,
  indent,
  onExpand,
}: CollapsedBranchRowProps) {
  const ROW_H = density === "compact" ? ROW_H_COMPACT : ROW_H_COMFORTABLE;

  return (
    <li
      role="listitem"
      data-summary-branch-id={branchId}
      style={{ height: ROW_H, paddingInlineStart: indent }}
      className="relative flex items-center"
    >
      <button
        type="button"
        aria-expanded={false}
        aria-label={`Collapsed branch ${branchName}, ${summaryLabel}, expand`}
        onClick={onExpand}
        className={cn(
          "flex h-full w-full min-w-0 items-center gap-2 px-2 text-start",
          "transition-colors duration-fast ease-standard motion-reduce:transition-none",
          "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <BranchChevron expanded={false} />
        <GitBranch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-body text-foreground" title={branchName}>
          {branchName}
        </span>
        <span className="shrink-0 tabular-nums text-meta text-muted-foreground">
          {summaryLabel}
        </span>
      </button>
    </li>
  );
}

// ─── Revision row ────────────────────────────────────────────────────────────

interface RevisionRowProps {
  revision: Revision;
  isMerge: boolean;
  density: RevisionTimelineDensity;
  /**
   * Left indent (px) for this row's content, proportional to its lane depth, so
   * the row text staircases alongside the branch graph instead of all rows
   * starting at the same point.
   */
  indent: number;
  /**
   * When set, this row is the tip of an expanded collapsible branch: render a
   * collapse toggle as a sibling of the select button (never nested).
   */
  collapseToggle?: { branchName: string; onToggle: () => void };
}

function RevisionRow({ revision, isMerge, density, indent, collapseToggle }: RevisionRowProps) {
  const { selectedId, onSelect } = useRevisionTimelineCtx();
  const isSelected = selectedId === revision.id;
  const ROW_H = density === "compact" ? ROW_H_COMPACT : ROW_H_COMFORTABLE;

  const formattedTimestamp = useMemo(() => {
    const d =
      revision.timestamp instanceof Date ? revision.timestamp : new Date(revision.timestamp);
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }, [revision.timestamp]);

  const fullTimestamp = useMemo(() => {
    const d =
      revision.timestamp instanceof Date ? revision.timestamp : new Date(revision.timestamp);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
      timeStyle: "medium",
    }).format(d);
  }, [revision.timestamp]);

  return (
    <li
      role="listitem"
      data-revision-id={revision.id}
      data-selected={isSelected || undefined}
      style={{ height: ROW_H, paddingInlineStart: indent }}
      className="relative flex items-center"
    >
      {collapseToggle && (
        <BranchToggle branchName={collapseToggle.branchName} onToggle={collapseToggle.onToggle} />
      )}
      <button
        type="button"
        aria-label={`Select revision: ${revision.message}`}
        aria-pressed={isSelected}
        onClick={() => onSelect(revision.id)}
        className={cn(
          collapseToggle
            ? "flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-start"
            : "flex h-full w-full min-w-0 items-center gap-2 px-2 text-start",
          "transition-colors duration-fast ease-standard motion-reduce:transition-none",
          "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "hover:bg-accent hover:text-accent-foreground",
          isSelected && "border-s-2 border-s-primary bg-accent text-accent-foreground",
        )}
      >
        {/* Merge icon (non-color visual cue for merge commits) */}
        <span className="shrink-0 text-muted-foreground" aria-hidden="true">
          {isMerge ? (
            <GitMerge className="size-3.5" aria-hidden="true" />
          ) : (
            <GitCommitHorizontal className="size-3.5" aria-hidden="true" />
          )}
        </span>

        {/* Commit message — truncates with min-w-0 */}
        <span
          className="min-w-0 flex-1 truncate text-body text-foreground"
          title={revision.message}
        >
          {revision.message}
        </span>

        {/* Ref chips (branch / tag labels) */}
        {revision.refs && revision.refs.length > 0 && (
          <span className="hidden shrink-0 items-center gap-1 sm:flex">
            {revision.refs.map((ref) => (
              <RefChip key={ref} label={ref} />
            ))}
          </span>
        )}

        {/* Churn indicators */}
        <Churn additions={revision.additions} deletions={revision.deletions} />

        {/* Author */}
        {revision.author && (
          <span
            className="hidden shrink-0 text-caption text-muted-foreground md:block"
            title={revision.author}
          >
            {revision.author}
          </span>
        )}

        {/* Short SHA */}
        {revision.shortSha && (
          <span
            className="hidden shrink-0 font-mono text-meta text-muted-foreground sm:block"
            title={`Full SHA: ${revision.shortSha}`}
          >
            {revision.shortSha}
          </span>
        )}

        {/* Timestamp */}
        <time
          dateTime={
            revision.timestamp instanceof Date
              ? revision.timestamp.toISOString()
              : new Date(revision.timestamp).toISOString()
          }
          className="shrink-0 text-meta text-muted-foreground"
          title={fullTimestamp}
        >
          {formattedTimestamp}
        </time>
      </button>
    </li>
  );
}

// ─── Collapse state hook ──────────────────────────────────────────────────────

/**
 * Controlled/uncontrolled collapsed-branch state — mirrors the selection pattern.
 * Internally a `Set`; the controlled API stays array-shaped. `toggleBranch`
 * fires `onBranchToggle(id, next)` and only mutates internal state when
 * uncontrolled.
 */
function useBranchCollapse(opts: {
  collapsedBranchIds?: string[];
  defaultCollapsedBranchIds?: string[];
  onBranchToggle?: (branchId: string, collapsed: boolean) => void;
}) {
  const { collapsedBranchIds, defaultCollapsedBranchIds, onBranchToggle } = opts;
  const isControlled = collapsedBranchIds !== undefined;
  const [internal, setInternal] = useState<Set<string>>(
    () => new Set(defaultCollapsedBranchIds ?? []),
  );
  const collapsedSet = useMemo(
    () => (isControlled ? new Set(collapsedBranchIds) : internal),
    [isControlled, collapsedBranchIds, internal],
  );
  const toggleBranch = useCallback(
    (branchId: string) => {
      const next = !collapsedSet.has(branchId);
      onBranchToggle?.(branchId, next);
      if (!isControlled) {
        setInternal((prev) => {
          const s = new Set(prev);
          if (next) s.add(branchId);
          else s.delete(branchId);
          return s;
        });
      }
    },
    [collapsedSet, isControlled, onBranchToggle],
  );
  return { collapsedSet, toggleBranch };
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface RevisionTimelineProps
  extends
    Omit<HTMLAttributes<HTMLDivElement>, "onSelect">,
    VariantProps<typeof revisionTimelineVariants> {
  /** Ordered revisions, newest → oldest. */
  revisions: Revision[];
  /**
   * Parent-link edges for drawing the branch graph.
   * Each edge connects a child revision (`from`) to its parent (`to`).
   */
  edges?: RevisionEdge[];
  /**
   * How to group revisions. `"day"` inserts day headers; `"none"` renders a
   * flat list. @default "day"
   */
  groupBy?: "day" | "none";
  /** Format the day-group header label. Defaults to `Intl.DateTimeFormat` long date. */
  formatDay?: (d: Date) => string;
  /**
   * Controlled selection: the id of the currently-selected revision.
   * Omit to use uncontrolled selection (`defaultSelectedId`).
   */
  selectedId?: string;
  /** Initial selected revision id for uncontrolled usage. */
  defaultSelectedId?: string;
  /** Called when the user selects a revision row. */
  onSelect?: (id: string) => void;
  /**
   * Collapsible branch registry. **Supplying this opts in to the collapse/expand
   * mode.** Each listed branch becomes collapsible; a branch's commits fold into a
   * single summary row at its tip. `parentBranchId` nests branches so collapsing a
   * parent also folds its descendants (multi-level). A revision whose `branchId`
   * is not listed here (e.g. the trunk) stays permanently visible. Omit entirely
   * for the classic, non-collapsible timeline.
   */
  branches?: RevisionBranch[];
  /** Controlled set of collapsed branch ids. */
  collapsedBranchIds?: string[];
  /** Uncontrolled initial set of collapsed branch ids. */
  defaultCollapsedBranchIds?: string[];
  /** Called when a branch is collapsed or expanded. `collapsed` is the NEXT state. */
  onBranchToggle?: (branchId: string, collapsed: boolean) => void;
  /**
   * Trailing summary text on a collapsed branch row. Defaults to
   * `"<n> commit(s)"`; override to re-vocabulary the timeline (e.g. `"<n> steps"`
   * when modelling a process flow rather than git history).
   */
  formatBranchSummary?: (count: number, branch: RevisionBranch) => string;
}

/**
 * RevisionTimeline — presentational git-history timeline.
 *
 * Renders revisions in a scrollable list with:
 *   - Day grouping (collapsible via `groupBy`)
 *   - SVG branch-graph lanes + merge joins in the left gutter
 *   - Churn indicators, ref chips, author, SHA, timestamp
 *   - Accessible selection (real `<button>` elements in an `<ol>`)
 *
 * Self-contained: no required Provider ancestor. Use `selectedId` +
 * `onSelect` for controlled selection, or `defaultSelectedId` for uncontrolled.
 *
 * Pass `branches` to enable the collapse/expand mode: a branch's commits fold
 * into a single summary row at its tip (multi-level via `parentBranchId`).
 */
export const RevisionTimeline = forwardRef<HTMLDivElement, RevisionTimelineProps>(
  function RevisionTimeline(
    {
      revisions,
      edges = [],
      groupBy = "day",
      formatDay,
      selectedId: controlledSelectedId,
      defaultSelectedId,
      onSelect,
      branches,
      collapsedBranchIds,
      defaultCollapsedBranchIds,
      onBranchToggle,
      formatBranchSummary,
      density,
      className,
      ...props
    },
    ref,
  ) {
    const resolvedDensity: RevisionTimelineDensity = density ?? "comfortable";

    // Collapse/expand mode is opt-in: active only when `branches` are supplied.
    const collapseEnabled = !!branches && branches.length > 0;
    const branchMaps = useMemo(() => buildBranchMaps(branches ?? []), [branches]);
    const { collapsedSet, toggleBranch } = useBranchCollapse({
      collapsedBranchIds,
      defaultCollapsedBranchIds,
      onBranchToggle,
    });

    // Controlled / uncontrolled selection
    const isControlled = controlledSelectedId !== undefined;
    const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(
      defaultSelectedId,
    );
    const resolvedSelectedId = isControlled ? controlledSelectedId : internalSelectedId;

    const handleSelect = useCallback(
      (id: string) => {
        onSelect?.(id);
        if (!isControlled) {
          setInternalSelectedId(id);
        }
      },
      [isControlled, onSelect],
    );

    // Default day formatter
    const defaultFormatDay = useCallback(
      (d: Date) =>
        new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(d),
      [],
    );
    const resolvedFormatDay = formatDay ?? defaultFormatDay;

    // Merge detection: revision is a merge if ≥2 incoming edges target it
    const mergeIds = useMemo(() => {
      const incoming = new Map<string, number>();
      for (const e of edges) {
        incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
      }
      return new Set([...incoming.entries()].filter(([, n]) => n >= 2).map(([id]) => id));
    }, [edges]);

    // Visible render items (revisions + collapsed-branch summaries). With no
    // `branches`, `branchMaps` is empty → every item is a plain revision and
    // `summaryOf` is empty, so the legacy render path is reproduced exactly.
    const { items: renderItems, summaryOf } = useMemo(
      () => computeRenderItems(revisions, collapsedSet, branchMaps),
      [revisions, collapsedSet, branchMaps],
    );

    // Group the VISIBLE render items by day. A summary inherits its tip's
    // timestamp, so it lands in the tip's day; a fully-hidden day drops out.
    const groups = useMemo<Array<{ dayKey: string; dayLabel: string; items: RenderItem[] }>>(() => {
      const itemTime = (it: RenderItem) =>
        it.kind === "revision" ? it.revision.timestamp : it.tipTimestamp;
      if (groupBy === "none") {
        return [{ dayKey: "all", dayLabel: "", items: renderItems }];
      }
      const result: Array<{ dayKey: string; dayLabel: string; items: RenderItem[] }> = [];
      for (const it of renderItems) {
        const ts = itemTime(it);
        const d = ts instanceof Date ? ts : new Date(ts);
        // YYYY-MM-DD in local time for grouping key
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const last = result[result.length - 1];
        if (last && last.dayKey === key) {
          last.items.push(it);
        } else {
          result.push({ dayKey: key, dayLabel: resolvedFormatDay(d), items: [it] });
        }
      }
      return result;
    }, [renderItems, groupBy, resolvedFormatDay]);

    // Shared gutter↔list coordinate space: a per-row vertical centre keyed by
    // render-item id (revision id OR `summary:<branchId>`), accounting for
    // day-header height, so the SVG dots line up with their rows.
    const ROW_H = resolvedDensity === "compact" ? ROW_H_COMPACT : ROW_H_COMFORTABLE;
    const { rowCenterY, gutterHeight } = useMemo(() => {
      const map = new Map<string, number>();
      let y = 0;
      for (const group of groups) {
        if (groupBy === "day") y += DAY_HEADER_H;
        for (const it of group.items) {
          const id = it.kind === "revision" ? it.revision.id : it.id;
          map.set(id, y + ROW_H / 2);
          y += ROW_H;
        }
      }
      return { rowCenterY: map, gutterHeight: y };
    }, [groups, groupBy, ROW_H]);

    // Gutter nodes: one per visible revision + one synthetic node per summary
    // (on the collapsed branch's own lane = its tip's lane).
    const gutterRevisions = useMemo<GutterNode[]>(
      () =>
        renderItems.map((it) =>
          it.kind === "revision"
            ? { id: it.revision.id, lane: it.revision.lane }
            : { id: it.id, lane: it.lane },
        ),
      [renderItems],
    );

    // Remap edges whose endpoints were hidden onto the summary that absorbed
    // them, so merge/fork curves still connect to the summary node.
    const visibleEdges = useMemo<RevisionEdge[]>(() => {
      if (!collapseEnabled || summaryOf.size === 0) return edges;
      const seen = new Set<string>();
      const out: RevisionEdge[] = [];
      for (const e of edges) {
        const from = summaryOf.get(e.from) ?? e.from;
        const to = summaryOf.get(e.to) ?? e.to;
        if (from === to) continue; // collapsed into a single node
        const key = `${from} ${to}`;
        if (seen.has(key)) continue; // de-dup coincident remaps
        seen.add(key);
        out.push({ from, to });
      }
      return out;
    }, [collapseEnabled, edges, summaryOf]);

    const ctx: RevisionTimelineCtx = useMemo(
      () => ({
        selectedId: resolvedSelectedId,
        onSelect: handleSelect,
      }),
      [resolvedSelectedId, handleSelect],
    );

    const branchLabel = (branch: RevisionBranch) => branch.name ?? branch.id;
    const summaryText =
      formatBranchSummary ?? ((count: number) => `${count} ${count === 1 ? "commit" : "commits"}`);

    return (
      <RevisionTimelineContext.Provider value={ctx}>
        <div
          ref={ref}
          className={cn(revisionTimelineVariants({ density: resolvedDensity }), className)}
          {...props}
        >
          {/* Lane gutter + list side-by-side */}
          <div className="flex min-w-0">
            {/* SVG branch-graph gutter */}
            <LaneGutter
              revisions={gutterRevisions}
              edges={visibleEdges}
              rowCenterY={rowCenterY}
              height={gutterHeight}
              className="mr-1"
            />

            {/* Revision list */}
            <div className="min-w-0 flex-1">
              {groups.map((group) => (
                <div key={group.dayKey}>
                  {groupBy === "day" && <DayHeader label={group.dayLabel} />}
                  <ol role="list" aria-label={groupBy === "day" ? group.dayLabel : "Revisions"}>
                    {group.items.map((it) => {
                      if (it.kind === "summary") {
                        return (
                          <CollapsedBranchRow
                            key={it.id}
                            branchId={it.branch.id}
                            branchName={branchLabel(it.branch)}
                            summaryLabel={summaryText(it.count, it.branch)}
                            density={resolvedDensity}
                            indent={it.lane * LANE_W}
                            onExpand={() => toggleBranch(it.branch.id)}
                          />
                        );
                      }
                      const branch = it.branchId
                        ? branchMaps.branchById.get(it.branchId)
                        : undefined;
                      const collapseToggle =
                        it.canCollapse && branch
                          ? {
                              branchName: branchLabel(branch),
                              onToggle: () => toggleBranch(branch.id),
                            }
                          : undefined;
                      return (
                        <RevisionRow
                          key={it.revision.id}
                          revision={it.revision}
                          isMerge={mergeIds.has(it.revision.id)}
                          density={resolvedDensity}
                          indent={it.revision.lane * LANE_W}
                          collapseToggle={collapseToggle}
                        />
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevisionTimelineContext.Provider>
    );
  },
);
