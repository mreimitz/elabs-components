/**
 * Timeline — THE rail/node/connector spine (#190, research 10 §B.2): an
 * ordered list of steps with a vertical connector and a status-colored node
 * per step. Moved from `@qlik-coe-emea/qlabs-components-editor` (which re-exports it for back-compat —
 * the ADR-0012 own/re-export model); the branded target for the editor's
 * `:::timeline` markdown directive, and reusable anywhere a process/sequence
 * needs showing. Token-driven, theme-safe, motion-free (animation belongs to
 * composing consumers, e.g. the `@qlik-coe-emea/qlabs-components-ai` agent grammar).
 *
 * One rail, two front doors:
 *   - compound `TimelineRoot` + `TimelineItem` — for composing consumers that
 *     interleave rich children per node. The node takes the CANONICAL 7-state
 *     `Status` (status-badge, #189) — closed enum, no freeform strings.
 *   - array `Timeline items={TimelineEntry[]}` — a thin map over the compound
 *     parts. Keeps the editor-facing `done|active|pending` API unchanged by
 *     mapping in via `fromTimelineStatus` at the boundary.
 *
 * Fork-prevention: a Timeline re-implementation outside this folder fails
 * `pnpm timeline-fork:check` (scripts/check-timeline-fork.mjs).
 */
import { forwardRef, type HTMLAttributes, type LiHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
  fromTimelineStatus,
  STATUS_LABELS,
  type Status,
  type TimelineStatus,
} from "../status-badge";

/**
 * Node visual per canonical status. This is a DUPLICATE of the status→role
 * mapping `status-badge.tsx` owns (`STATUS_ROLE`) — it exists because the rail
 * node is a filled dot, not a badge pill, so it can't share `statusBadgeVariants`
 * directly. A duplicate is only safe when it is TESTED against the source of
 * truth: `timeline.test.tsx` asserts every chromatic status here resolves to
 * the same role as `STATUS_ROLE`/`statusBadgeVariants` (#392 — `running` had
 * silently drifted to `--primary` here while the canonical map said `--info`,
 * because nothing checked the two agreed). Semantic tokens only.
 *
 * Every status ALSO carries a non-colour signature (#387, WCAG 1.4.1) — a
 * 12px dot can't host a legible glyph, so the cue is geometric. It took an
 * empirical (rendered) pass to find a signature that actually PAINTS
 * distinctly, not merely one that differs as a class string:
 *   - `denied`/`skipped` (hollow-ish `bg-muted`, `border-border`) get
 *     `border-dashed`/`border-dotted` — this WORKS because border and fill
 *     are different colours there, so the gaps in the dash/dot pattern show
 *     the (lighter) fill through the (darker) border.
 *   - `running`/`complete`/`awaiting-approval`/`failed` are all `bg-<status>
 *     border-<status>` — the vivid MARK rung, where border and fill are the
 *     SAME token. A `border-style` on a same-colour border is invisible (no
 *     colour boundary for the dash gaps to reveal), so this quartet is
 *     differentiated by `ring-*` WIDTH instead — the ring sits outside the
 *     dot, contrasting against the PAGE, not the fill, which is why
 *     `running`'s existing halo was legible in the first place. Widths
 *     `0 / 1 / 2 / 4` give four unmistakably different silhouettes:
 *     `complete` none (calm/settled, matches `StatusBadge`'s quiet
 *     treatment for `complete`) → `awaiting-approval` `ring-1` (a nudge) →
 *     `running` `ring-2` (active) → `failed` `ring-4` (the widest, most
 *     emphatic — the state that most needs to grab the eye).
 * `denied`/`skipped` were byte-identical before this; the ring-width
 * progression replaces an earlier border-style-only attempt that turned out
 * to be visually void on the vivid quartet — verified in `timeline.test.tsx`
 * (structural) and by rendered zoomed + greyscale screenshots (see #387
 * rendered proof) — don't reintroduce border-style there without re-checking
 * a render, it will look correct in code and disappear on screen.
 */
export const NODE_STYLE: Record<Status, string> = {
  pending: "border-border bg-background",
  running: "border-info bg-info ring-2 ring-info/25",
  complete: "border-success bg-success",
  "awaiting-approval": "border-warning bg-warning ring-1 ring-warning/40",
  denied: "border-border bg-muted border-dashed",
  failed: "border-destructive bg-destructive ring-4 ring-destructive/20",
  skipped: "border-border bg-muted border-dotted",
};

/** Statuses whose title reads de-emphasized (not-yet/never-run steps). */
const MUTED_TITLE_STATUSES: ReadonlySet<Status> = new Set(["pending", "skipped", "denied"]);

export type TimelineRootProps = HTMLAttributes<HTMLOListElement>;

/** The `<ol>` that owns the rail geometry; compose `TimelineItem`s inside. */
export const TimelineRoot = forwardRef<HTMLOListElement, TimelineRootProps>(function TimelineRoot(
  { className, ...props },
  ref,
) {
  return <ol ref={ref} className={cn("relative", className)} {...props} />;
});

export interface TimelineItemProps extends LiHTMLAttributes<HTMLLIElement> {
  /** The canonical execution status (closed 7-state enum, status-badge #189). */
  status?: Status;
  /** Right-aligned meta (e.g. a date) on the title row. */
  timestamp?: ReactNode;
  /** Secondary line under the title. */
  description?: ReactNode;
  /**
   * Rich block content under the title/description, indented with the rail —
   * the slot composing consumers (e.g. `@qlik-coe-emea/qlabs-components-ai`'s `AgentStep`, #192)
   * interleave per node. Block-level, so it must NOT ride the inline title
   * slot (`children`).
   */
  detail?: ReactNode;
}

/**
 * One `<li>`: status node + connector + the title row; `children` is the
 * title slot. The connector hides itself on the last item via CSS
 * (`group-last`), so streaming/compound consumers never track "is last".
 */
export const TimelineItem = forwardRef<HTMLLIElement, TimelineItemProps>(function TimelineItem(
  { status = "pending", timestamp, description, detail, className, children, ...props },
  ref,
) {
  return (
    <li
      ref={ref}
      data-status={status}
      className={cn("group/timeline-item relative pb-5 ps-7 last:pb-0", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute start-[5px] top-2.5 h-full w-px bg-border group-last/timeline-item:hidden"
      />
      <span
        aria-hidden="true"
        className={cn("absolute start-0 top-1 size-3 rounded-full border-2", NODE_STYLE[status])}
      />
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            "text-body font-medium",
            MUTED_TITLE_STATUSES.has(status) ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {/* The dot is `aria-hidden` and `data-status` isn't AT-visible (#387) —
              this is the step's only announced status; kept inline so it reads
              naturally as "<Status>: <title>" instead of a second live region. */}
          <span className="sr-only">{STATUS_LABELS[status]}: </span>
          {children}
        </span>
        {timestamp ? (
          <span className="shrink-0 text-meta text-muted-foreground">{timestamp}</span>
        ) : null}
      </div>
      {description ? <p className="mt-0.5 text-body text-muted-foreground">{description}</p> : null}
      {detail ? <div className="mt-2 space-y-2">{detail}</div> : null}
    </li>
  );
});

/**
 * One step of the array-API `Timeline` (the editor's original item shape —
 * re-exported by `@qlik-coe-emea/qlabs-components-editor` as `TimelineItem` for back-compat).
 */
export interface TimelineEntry {
  title: ReactNode;
  description?: ReactNode;
  /** The editor's 3-state vocabulary; mapped in via `fromTimelineStatus`. */
  status?: TimelineStatus;
  timestamp?: ReactNode;
}

export interface TimelineProps extends HTMLAttributes<HTMLOListElement> {
  items: TimelineEntry[];
}

/** Array convenience over the compound parts (data in, list out). */
export const Timeline = forwardRef<HTMLOListElement, TimelineProps>(function Timeline(
  { items, className, ...props },
  ref,
) {
  return (
    <TimelineRoot ref={ref} className={className} {...props}>
      {items.map((item, i) => (
        <TimelineItem
          key={i}
          status={fromTimelineStatus(item.status ?? "pending")}
          timestamp={item.timestamp}
          description={item.description}
        >
          {item.title}
        </TimelineItem>
      ))}
    </TimelineRoot>
  );
});
