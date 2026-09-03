"use client";

/**
 * ChangeReview — AI-edit trust gate.
 *
 * When an agent proposes edits, the human reviews them hunk-by-hunk and accepts
 * or rejects each before they apply. Feeling: calm, scannable, trustworthy —
 * "I can see exactly what changed, who proposed it, and nothing lands without
 * my say-so."
 *
 * Design references: GitHub PR file-review (per-hunk viewed/comment),
 * Cursor/Copilot "review changes" panel, Graphite/Linear review UIs.
 *
 * NOT a diff-line renderer, and deliberately never becoming one. A hunk's
 * `before`/`after` are ordinary `ReactNode` prose, drawn as a quiet no-fill
 * comparison; the `−`/`+` markers below mean "previous content"/"proposed
 * content", which is not the same idea as `DiffLine`'s "removed line"/"added
 * line" even though the glyphs coincide. Do NOT reach for `diffLineMarker` here:
 * a coincidence stays a literal (theming.md, intentional-mirror rule).
 *
 * Structured `DiffLine[]` hunks reach this component by INJECTION, which is a
 * binding decision, not an unfinished merge — see
 * `docs/decisions/2026-09-01-brainless-adoption-architecture.md` § 3:
 *   - `ChangeHunk` gains NO `lines` field and `DiffLine` never moves here.
 *   - The app that depends on both packages passes a `<DiffView>`
 *     (`@elabs-ai/components-ai`, Shiki-backed) through `renderHunk` or a hunk's
 *     `after` slot. Neither package imports the other, in either direction.
 *   - Re-litigated and re-ratified 2026-09-03: moving this component into
 *     `@elabs-ai/components-ai` was rejected because it would push a
 *     dependency-free component into a layer-2 leaf that `terminal`, `editor`
 *     and `viewer` could then never reach.
 * See the `InjectedHunkRenderer` story here, and `ChangeReviewComposition` in
 * `packages/ai/src/diff-view.stories.tsx` for the real two-package wiring.
 *
 * State grid: empty (no hunks → StatePanel), single hunk, mixed, all-approved,
 * all-rejected, very long hunk content. Approval state is signalled with color
 * AND icon/label (colorblind + high-decoration/high-contrast safe).
 *
 * Compound structure (named exports, the Card/CardHeader convention — NOT dot
 * notation). Use the `ChangeReview` root for the default layout, or compose the
 * parts for a custom one:
 *   <ChangeReviewProvider>     — lifted state (approved set + actions interface)
 *     <ChangeReviewHeader>     — count summary + Approve all / Reject all
 *     <ChangeReviewProvenance> — who/what proposed (quiet attribution)
 *     <ChangeReviewList>       — the hunk list
 *       <ChangeReviewHunk>     — per-hunk row (title, rails, before/after, toggle)
 */

import {
  createContext,
  forwardRef,
  use,
  useCallback,
  useId,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Check, X, CheckCheck, User, Bot, Clock, ChevronDown } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { type CheckResult } from "../../lib/check-result";
import { formatElapsed } from "../../lib/format-duration";
import { Button } from "../button/button";
import { Badge } from "../badge/badge";
import { StatePanel } from "../state-panel/state-panel";
import { StatusIcon } from "../status-badge/status-badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible/collapsible";

// ─── Public types ─────────────────────────────────────────────────────────────

/** Who / what proposed the change set (presentational only; never fetches). */
export interface ChangeProvenance {
  /** Display name of the person or agent author. */
  author?: string;
  /** Model or tool identifier (e.g. "claude-sonnet-4-6"). */
  model?: string;
  /** ISO-8601 or human-readable timestamp. */
  timestamp?: string;
  /** Free-form note, e.g. commit hash or run ID. */
  note?: string;
}

/** Status of a single change hunk. Drives the accent-rail colour and icon. */
export type ChangeHunkStatus = "added" | "removed" | "modified";

/** A single proposed change in the review set. */
export interface ChangeHunk {
  /** Unique identifier for this hunk (used in the approved set). */
  id: string;
  /** Short title shown in the hunk header (e.g. filename or section label). */
  title?: string;
  /** The content before the proposed edit. */
  before?: ReactNode;
  /** The content after the proposed edit (the proposal). */
  after?: ReactNode;
  /** Change type — drives accent rail + icon. @default "modified" */
  status?: ChangeHunkStatus;
  /** Per-hunk provenance override (overrides the review-level provenance). */
  provenance?: ChangeProvenance;
  /**
   * Verification results for this hunk (lint / types / tests / policy hooks).
   * Purely informational — a failing check never blocks approval, it only
   * informs the reviewer's decision. Grouped into "Before" / "After" sections
   * when both phases are present.
   */
  checks?: CheckResult[];
}

/** State surface exposed by the ChangeReview context. */
export interface ChangeReviewState {
  /** Set of currently-approved hunk IDs. */
  approved: ReadonlySet<string>;
  /** Total number of hunks. */
  totalCount: number;
  /** Number of approved hunks. */
  approvedCount: number;
  /** True when every hunk is approved. */
  allApproved: boolean;
  /** True when no hunk is approved. */
  noneApproved: boolean;
}

/** Actions exposed by the ChangeReview context. */
export interface ChangeReviewActions {
  /** Toggle the approval state of a single hunk. */
  toggle: (id: string, next: boolean) => void;
  /** Approve all hunks. */
  approveAll: () => void;
  /** Reject (un-approve) all hunks. */
  rejectAll: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ChangeReviewContextValue {
  state: ChangeReviewState;
  actions: ChangeReviewActions;
  hunks: ChangeHunk[];
  headingId: string;
}

const ChangeReviewContext = createContext<ChangeReviewContextValue | null>(null);

function useChangeReview(): ChangeReviewContextValue {
  const ctx = use(ChangeReviewContext);
  if (!ctx) {
    throw new Error("ChangeReview sub-components must be rendered inside ChangeReview.Provider");
  }
  return ctx;
}

// ─── Variants ─────────────────────────────────────────────────────────────────

/**
 * Hunk-status accent rail — the separation grammar's accent-rail channel: ONE
 * focal gesture (the status rail) on a neutral card ground (`bg-card` + the
 * subtle, redundant-exempt `border-border` hairline). NO colored wash and NO
 * redundant colored border — the slop the "AI card" look is built from. Status
 * reads from the rail + the header icon + the StatusBadge (never color alone).
 * Approval is signalled by the StatusBadge + the filled toggle (no ring wash).
 */
export const hunkVariants = cva(
  [
    "relative rounded-md border border-border bg-card text-card-foreground",
    "transition-colors duration-fast ease-standard motion-reduce:transition-none",
  ],
  {
    variants: {
      status: {
        added: "border-s-4 border-s-success",
        removed: "border-s-4 border-s-destructive",
        modified: "border-s-4 border-s-info",
      },
    },
    defaultVariants: { status: "modified" },
  },
);

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface ChangeReviewProviderProps {
  hunks: ChangeHunk[];
  /**
   * Controlled approved set. Pass `Set<string>` or a string array.
   * When provided, the component is controlled and `onToggle` / `onApproveAll` /
   * `onRejectAll` are the only way to update the state.
   */
  approved?: Set<string> | string[];
  onToggle?: (id: string, next: boolean) => void;
  onApproveAll?: () => void;
  onRejectAll?: () => void;
  children: ReactNode;
}

/**
 * Lifts the approval state. Can be controlled (pass `approved`) or uncontrolled.
 * Derive `isControlled = approved !== undefined`.
 */
export function ChangeReviewProvider({
  hunks,
  approved: approvedProp,
  onToggle,
  onApproveAll,
  onRejectAll,
  children,
}: ChangeReviewProviderProps) {
  const headingId = useId();

  const isControlled = approvedProp !== undefined;

  // Uncontrolled internal state.
  const [internalApproved, setInternalApproved] = useState<Set<string>>(() => new Set());

  const resolvedApproved: ReadonlySet<string> = isControlled
    ? approvedProp instanceof Set
      ? approvedProp
      : new Set(approvedProp)
    : internalApproved;

  const hunkIds = useMemo(() => hunks.map((h) => h.id), [hunks]);

  const toggle = useCallback(
    (id: string, next: boolean) => {
      onToggle?.(id, next);
      if (!isControlled) {
        setInternalApproved((prev) => {
          const next_ = new Set(prev);
          if (next) next_.add(id);
          else next_.delete(id);
          return next_;
        });
      }
    },
    [isControlled, onToggle],
  );

  const approveAll = useCallback(() => {
    onApproveAll?.();
    if (!isControlled) {
      setInternalApproved(new Set(hunkIds));
    }
  }, [isControlled, hunkIds, onApproveAll]);

  const rejectAll = useCallback(() => {
    onRejectAll?.();
    if (!isControlled) {
      setInternalApproved(new Set());
    }
  }, [isControlled, onRejectAll]);

  const approvedCount = hunkIds.filter((id) => resolvedApproved.has(id)).length;
  const totalCount = hunkIds.length;

  const state: ChangeReviewState = {
    approved: resolvedApproved,
    totalCount,
    approvedCount,
    allApproved: totalCount > 0 && approvedCount === totalCount,
    noneApproved: approvedCount === 0,
  };

  const actions: ChangeReviewActions = { toggle, approveAll, rejectAll };

  const value = useMemo(
    () => ({ state, actions, hunks, headingId }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.approved, state.totalCount, state.approvedCount, hunks, headingId],
  );

  return <ChangeReviewContext.Provider value={value}>{children}</ChangeReviewContext.Provider>;
}

// ─── Header ───────────────────────────────────────────────────────────────────

export type ChangeReviewHeaderProps = HTMLAttributes<HTMLDivElement>;

/**
 * Count summary ("3 of 5 approved") + Approve all / Reject all bulk actions.
 * `aria-controls` is intentionally omitted — screen readers reach the list
 * naturally in DOM order.
 */
export const ChangeReviewHeader = forwardRef<HTMLDivElement, ChangeReviewHeaderProps>(
  function ChangeReviewHeader({ className, ...props }, ref) {
    const { state, actions, headingId } = useChangeReview();
    const { approvedCount, totalCount, allApproved, noneApproved } = state;

    return (
      <div
        ref={ref}
        className={cn("flex flex-wrap items-center justify-between gap-3 pb-3", className)}
        {...props}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span id={headingId} className="text-subtitle font-semibold text-foreground truncate">
            Review changes
          </span>
          <Badge variant={allApproved ? "success" : approvedCount > 0 ? "info" : "secondary"}>
            {approvedCount} of {totalCount} approved
          </Badge>
        </div>

        {totalCount > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline-subtle"
              disabled={noneApproved}
              onClick={actions.rejectAll}
              aria-label="Reject all changes"
            >
              <X aria-hidden="true" />
              Reject all
            </Button>
            <Button
              size="sm"
              variant={allApproved ? "secondary" : "default"}
              disabled={allApproved}
              onClick={actions.approveAll}
              aria-label="Approve all changes"
            >
              <CheckCheck aria-hidden="true" />
              Approve all
            </Button>
          </div>
        )}
      </div>
    );
  },
);

// ─── Provenance ───────────────────────────────────────────────────────────────

export interface ChangeReviewProvenanceProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Structured provenance object OR any ReactNode for custom rendering.
   * When a `ChangeProvenance` object is passed, a default attribution line
   * is rendered. Pass a ReactNode for full control.
   */
  provenance: ReactNode | ChangeProvenance;
}

function isChangeProvenance(v: unknown): v is ChangeProvenance {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    ("author" in v || "model" in v || "timestamp" in v || "note" in v)
  );
}

/**
 * Quiet attribution line showing who/what proposed the change set.
 * Uses `text-muted-foreground` and small typography — it should not compete
 * with the hunks themselves.
 */
export const ChangeReviewProvenance = forwardRef<HTMLDivElement, ChangeReviewProvenanceProps>(
  function ChangeReviewProvenance({ provenance, className, ...props }, ref) {
    if (isChangeProvenance(provenance)) {
      const { author, model, timestamp, note } = provenance;
      return (
        <div
          ref={ref}
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground pb-3",
            className,
          )}
          aria-label="Change provenance"
          {...props}
        >
          {author && (
            <span className="flex items-center gap-1">
              <User aria-hidden="true" className="size-3" />
              <span>{author}</span>
            </span>
          )}
          {model && (
            <span className="flex items-center gap-1">
              <Bot aria-hidden="true" className="size-3" />
              <span translate="no">{model}</span>
            </span>
          )}
          {timestamp && (
            <span className="flex items-center gap-1">
              <Clock aria-hidden="true" className="size-3" />
              <time>{timestamp}</time>
            </span>
          )}
          {note && <span className="text-muted-foreground/70">{note}</span>}
        </div>
      );
    }

    // Custom ReactNode provenance
    return (
      <div
        ref={ref}
        className={cn("pb-3 text-caption text-muted-foreground", className)}
        aria-label="Change provenance"
        {...props}
      >
        {provenance as ReactNode}
      </div>
    );
  },
);

// ─── List ─────────────────────────────────────────────────────────────────────

export type ChangeReviewListProps = HTMLAttributes<HTMLOListElement>;

/**
 * Ordered list of change hunks. Uses `<ol>` so AT users can navigate by
 * item number ("item 2 of 5"). Renders a StatePanel when the list is empty.
 */
export const ChangeReviewList = forwardRef<HTMLOListElement, ChangeReviewListProps>(
  function ChangeReviewList({ className, children, ...props }, ref) {
    const { hunks, headingId } = useChangeReview();

    if (hunks.length === 0) {
      return (
        <StatePanel
          kind="empty"
          title="No changes to review"
          description="When an agent proposes edits, they'll appear here for your approval."
          className="my-2"
        />
      );
    }

    return (
      <ol
        ref={ref}
        aria-labelledby={headingId}
        className={cn("flex flex-col gap-3", className)}
        {...props}
      >
        {children}
      </ol>
    );
  },
);

// ─── Hunk ─────────────────────────────────────────────────────────────────────

const HUNK_STATUS_ICONS: Record<ChangeHunkStatus, ReactNode> = {
  added: (
    <span className="text-success-text font-bold text-meta" aria-hidden="true">
      +
    </span>
  ),
  removed: (
    // #124: sibling of `added`/`modified` above — this glyph is a decorative
    // aria-hidden marker beside a labelled span (see HUNK_STATUS_LABELS), and
    // reads as running text at the type scale, so it takes the ink rung the
    // other two already use.
    <span className="text-destructive-text font-bold text-meta" aria-hidden="true">
      −
    </span>
  ),
  modified: (
    <span className="text-info-text font-bold text-meta" aria-hidden="true">
      ~
    </span>
  ),
};

const HUNK_STATUS_LABELS: Record<ChangeHunkStatus, string> = {
  added: "added",
  removed: "removed",
  modified: "modified",
};

// ─── Checks (verification evidence) ────────────────────────────────────────────

/**
 * A check's `detail` collapses behind a disclosure once it's long enough that
 * showing it inline would dominate the hunk row. Short details always render
 * in place.
 */
const CHECK_DETAIL_COLLAPSE_THRESHOLD = 80;

function isLongCheckDetail(detail: string): boolean {
  return detail.length > CHECK_DETAIL_COLLAPSE_THRESHOLD || detail.includes("\n");
}

const CHECK_PHASE_LABELS: Record<"before" | "after", string> = {
  before: "Before",
  after: "After",
};

/**
 * Group checks for display. Phase headers ("Before" / "After") appear ONLY
 * when both phases are present in the same hunk — a single-phase or
 * unphased list of checks renders flat, with no header noise.
 */
function groupChecksByPhase(
  checks: CheckResult[],
): { phase?: "before" | "after"; items: CheckResult[] }[] {
  const before = checks.filter((c) => c.phase === "before");
  const after = checks.filter((c) => c.phase === "after");
  const showPhaseLabels = before.length > 0 && after.length > 0;

  if (!showPhaseLabels) {
    return [{ items: checks }];
  }

  const rest = checks.filter((c) => c.phase !== "before" && c.phase !== "after");
  const groups: { phase?: "before" | "after"; items: CheckResult[] }[] = [];
  if (rest.length > 0) groups.push({ items: rest });
  groups.push({ phase: "before", items: before });
  groups.push({ phase: "after", items: after });
  return groups;
}

/**
 * A single verification result row: icon + label + accessible status word +
 * optional duration, with an optional collapsed detail line below.
 *
 * The pass/fail signal is carried by TWO non-color cues — the icon (distinct
 * glyph per `StatusIcon`'s canonical vocabulary) and the visible "Passed"/
 * "Failed" text — so it survives in greyscale (WCAG 1.4.1). `StatusIcon` is
 * decorative (`aria-hidden`); the status word is what reaches assistive tech.
 */
function ChangeCheckRow({ check }: { check: CheckResult }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { label, ok, detail, durationMs } = check;
  const statusWord = ok ? "Passed" : "Failed";
  const hasDetail = detail !== undefined && detail !== "";
  const longDetail = hasDetail && isLongCheckDetail(detail);

  return (
    <div data-slot="change-review-hunk-check" data-ok={ok} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
        <StatusIcon status={ok ? "complete" : "failed"} className="size-3.5 shrink-0" />
        <span className="text-caption font-medium text-foreground truncate">{label}</span>
        <span className={cn("text-caption", ok ? "text-success-text" : "text-destructive-text")}>
          {statusWord}
        </span>
        {durationMs !== undefined && (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {formatElapsed(durationMs)}
          </span>
        )}
      </div>

      {hasDetail &&
        (longDetail ? (
          <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
            <CollapsibleTrigger
              className={cn(
                "flex items-center gap-1 self-start rounded-sm pl-5 text-caption text-muted-foreground",
                "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-3 transition-transform duration-fast motion-reduce:transition-none",
                  detailOpen ? "rotate-180" : "rotate-0",
                )}
              />
              {detailOpen ? "Hide detail" : "Show detail"}
            </CollapsibleTrigger>
            <CollapsibleContent data-slot="change-review-hunk-check-detail">
              <p className="pl-5 pt-1 text-caption text-muted-foreground break-words">{detail}</p>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p
            data-slot="change-review-hunk-check-detail"
            className="pl-5 text-caption text-muted-foreground break-words"
          >
            {detail}
          </p>
        ))}
    </div>
  );
}

/** The full checks section for one hunk — grouped by phase when applicable. */
function ChangeReviewChecks({ checks }: { checks: CheckResult[] }) {
  const groups = groupChecksByPhase(checks);
  const showPhaseLabels = groups.some((g) => g.phase !== undefined);

  return (
    <div
      data-slot="change-review-hunk-checks"
      className="flex flex-col gap-2 border-t border-border pt-3"
    >
      {groups.map((group, index) => (
        <div
          key={group.phase ?? `_${index}`}
          data-slot="change-review-hunk-checks-phase"
          className="flex flex-col gap-1.5"
        >
          {showPhaseLabels && group.phase && (
            <span className="text-meta font-medium text-muted-foreground">
              {CHECK_PHASE_LABELS[group.phase]}
            </span>
          )}
          <div className="flex flex-col gap-1.5">
            {group.items.map((check, itemIndex) => (
              <ChangeCheckRow key={`${check.label}-${itemIndex}`} check={check} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface ChangeReviewHunkProps
  extends
    Omit<HTMLAttributes<HTMLLIElement>, "children">,
    Omit<VariantProps<typeof hunkVariants>, "approved"> {
  hunk: ChangeHunk;
  /**
   * Override the default before/after layout. Receives the hunk data and
   * current approval state. Return `null` to suppress the default content area.
   */
  renderHunk?: (hunk: ChangeHunk, state: { approved: boolean }) => ReactNode;
}

/**
 * A single change hunk row.
 *
 * Approval state is signalled with TWO non-color cues:
 * - icon: Check (approved) vs plain toggle (pending)
 * - label: "Approved" badge vs "Approve" button text
 * This ensures the state is clear in every theme including the low-chroma
 * monochrome surfaces (colorblind-safe).
 */
export const ChangeReviewHunk = forwardRef<HTMLLIElement, ChangeReviewHunkProps>(
  function ChangeReviewHunk({ hunk, renderHunk, className, ...props }, ref) {
    const { state, actions } = useChangeReview();
    const { id, title, before, after, status = "modified", provenance, checks } = hunk;
    const approved = state.approved.has(id);

    const statusLabel = HUNK_STATUS_LABELS[status];
    const toggleLabel = approved ? `Reject hunk: ${title ?? id}` : `Approve hunk: ${title ?? id}`;

    // Quiet, no-fill diff: before = struck muted text with a "−" marker, after =
    // foreground text with a "+" marker — separated by space, NOT colored
    // fill+border boxes. The hunk's status rail (added/removed/modified) carries
    // the polarity; the markers + tone are the second, non-color cue.
    const defaultContent = renderHunk
      ? renderHunk(hunk, { approved })
      : (before !== undefined || after !== undefined) && (
          <div className="flex flex-col gap-1.5 text-body">
            {before !== undefined && (
              <div className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="shrink-0 select-none font-mono text-muted-foreground"
                >
                  −
                </span>
                <span className="sr-only">Before: </span>
                <div className="min-w-0 break-words text-muted-foreground line-through decoration-muted-foreground/30">
                  {before}
                </div>
              </div>
            )}
            {after !== undefined && (
              <div className="flex gap-2">
                <span aria-hidden="true" className="shrink-0 select-none font-mono text-foreground">
                  +
                </span>
                <span className="sr-only">After: </span>
                <div className="min-w-0 break-words text-foreground">{after}</div>
              </div>
            )}
          </div>
        );

    return (
      <li
        ref={ref}
        data-hunk-id={id}
        data-approved={approved}
        className={cn(hunkVariants({ status }), "flex flex-col gap-3 p-4", className)}
        {...props}
      >
        {/* Hunk header: status icon + title + per-hunk provenance + approve toggle */}
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Status indicator: NON-color cue via symbol + color together */}
            <span
              role="img"
              aria-label={`Change type: ${statusLabel}`}
              className="shrink-0 inline-flex items-center justify-center size-5"
            >
              {HUNK_STATUS_ICONS[status]}
            </span>

            <span className="text-body font-medium text-foreground truncate">{title ?? id}</span>

            {/* Per-hunk provenance (quiet, only when it differs from review-level) */}
            {provenance?.author && (
              <span className="text-caption text-muted-foreground hidden sm:inline truncate">
                {provenance.author}
              </span>
            )}
          </div>

          {/* Approval toggle — must be a real button with accessible name */}
          <Button
            size="icon-sm"
            variant={approved ? "default" : "outline-subtle"}
            aria-label={toggleLabel}
            aria-pressed={approved}
            onClick={() => actions.toggle(id, !approved)}
            className={cn(
              "shrink-0 transition-colors duration-fast motion-reduce:transition-none",
              approved && "bg-primary text-primary-foreground",
            )}
          >
            {approved ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Check aria-hidden="true" className="size-4 opacity-40" />
            )}
          </Button>
        </div>

        {/* Visual approved badge — second non-color cue (icon alone is not enough) */}
        {approved && (
          <div className="flex items-center gap-1.5">
            <Badge variant="success" className="animate-in fade-in-0 duration-fast ease-entrance">
              <Check aria-hidden="true" className="size-3" />
              Approved
            </Badge>
          </div>
        )}

        {/* Content area: before / after or custom renderHunk */}
        {defaultContent && <div>{defaultContent}</div>}

        {/* Verification evidence — informational only, never blocks approval */}
        {checks && checks.length > 0 && <ChangeReviewChecks checks={checks} />}
      </li>
    );
  },
);

// ─── Root (convenience wrapper) ───────────────────────────────────────────────

export interface ChangeReviewProps
  // Omit "children" and "onToggle" from div attrs — "onToggle" is a React 19
  // native ToggleEvent handler that conflicts with our review onToggle prop.
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onToggle"> {
  /** The proposed changes to review. */
  hunks: ChangeHunk[];
  /**
   * Controlled approved set. Pass `Set<string>` or a string array.
   * When omitted the component manages approval state internally (uncontrolled).
   */
  approved?: Set<string> | string[];
  /** Called when the user toggles a single hunk's approval state. */
  onToggle?: (id: string, next: boolean) => void;
  /** Called when the user clicks "Approve all". */
  onApproveAll?: () => void;
  /** Called when the user clicks "Reject all". */
  onRejectAll?: () => void;
  /**
   * Provenance to show above the hunk list. Accepts a `ChangeProvenance`
   * object (renders default attribution) or any ReactNode.
   */
  provenance?: ReactNode | ChangeProvenance;
  /**
   * Override the per-hunk body renderer (passed through to each `ChangeReviewHunk`).
   */
  renderHunk?: ChangeReviewHunkProps["renderHunk"];
}

/**
 * Convenience composition that wires Provider → Header → Provenance → List → Hunks.
 * For custom layouts compose the parts manually via `ChangeReview.Provider`,
 * `ChangeReview.Header`, etc.
 */
export const ChangeReview = forwardRef<HTMLDivElement, ChangeReviewProps>(function ChangeReview(
  {
    hunks,
    approved,
    onToggle,
    onApproveAll,
    onRejectAll,
    provenance,
    renderHunk,
    className,
    ...props
  },
  ref,
) {
  return (
    <ChangeReviewProvider
      hunks={hunks}
      approved={approved}
      onToggle={onToggle}
      onApproveAll={onApproveAll}
      onRejectAll={onRejectAll}
    >
      <div ref={ref} className={cn("flex flex-col w-full", className)} {...props}>
        <ChangeReviewHeader />
        {provenance != null && <ChangeReviewProvenance provenance={provenance} />}
        <ChangeReviewList>
          {hunks.map((hunk) => (
            <ChangeReviewHunk key={hunk.id} hunk={hunk} renderHunk={renderHunk} />
          ))}
        </ChangeReviewList>
      </div>
    </ChangeReviewProvider>
  );
});
