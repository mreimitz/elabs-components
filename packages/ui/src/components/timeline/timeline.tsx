/**
 * Timeline — THE rail/node/connector spine (#190, research 10 §B.2): an
 * ordered list of steps with a vertical connector and a status-colored node
 * per step. Moved from `@elabs-ai/components-editor` (which re-exports it for back-compat —
 * the ADR-0012 own/re-export model); the branded target for the editor's
 * `:::timeline` markdown directive, and reusable anywhere a process/sequence
 * needs showing. Token-driven, theme-safe, motion-free (animation belongs to
 * composing consumers, e.g. the `@elabs-ai/components-ai` agent grammar).
 *
 * One rail, two front doors:
 *   - compound `TimelineRoot` + `TimelineItem` — for composing consumers that
 *     interleave rich children per node. The node takes the CANONICAL 7-state
 *     `Status` (status-badge, #189) — closed enum, no freeform strings.
 *   - array `Timeline items={TimelineEntry[]}` — a thin map over the compound
 *     parts. Keeps the editor-facing `done|active|pending` API unchanged by
 *     mapping in via `fromTimelineStatus` at the boundary.
 *
 * Deliberately NOT on this rail (a different grammar, not an oversight —
 * RM-014, #133): `RevisionTimeline` (@elabs-ai/components-ui). Its rail is a
 * multi-lane commit DAG whose node colour is LANE IDENTITY (the chart ramp),
 * not `Status`, and whose fork/merge joins are cross-row beziers living in one
 * SVG coordinate space spanning the whole list — neither of which a
 * status-keyed node or an item-local `w-px` connector can express. Carrying
 * both grammars here would cost ~5 opt-in props, four of them switching this
 * rail's own node/connector/geometry/status announcement off. The four-point
 * reason is in that component's docblock; reopen #133 before converging them.
 */
import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
  type LiHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";
import { useLocale } from "../locale-provider";
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

export type TimelineVariant = "status" | "plain";
export type TimelineOrientation = "vertical" | "horizontal" | "responsive";
export type TimelineNodeSize = "dot" | "badge";

interface TimelineContextValue {
  variant: TimelineVariant;
  orientation: TimelineOrientation;
  nodeSize: TimelineNodeSize;
}

const TimelineContext = createContext<TimelineContextValue>({
  variant: "status",
  orientation: "vertical",
  nodeSize: "dot",
});

export interface TimelineRootProps extends HTMLAttributes<HTMLOListElement> {
  /**
   * `"status"` (default): every node carries the canonical 7-state `Status` —
   * a process rail (runs, approvals, steps). `"plain"`: a CHRONOLOGY — nodes
   * are neutral marks with no status semantics (milestones, releases, a
   * history); the one `current` item gets the accent node and
   * `aria-current="step"`. @default "status"
   */
  variant?: TimelineVariant;
  /**
   * `"vertical"` (default): the rail runs down the start edge. `"horizontal"`:
   * items sit side by side on one connector, node on top. `"responsive"`:
   * vertical below the root’s `@3xl` container width, horizontal from there —
   * the milestone strip that stacks on a phone. @default "vertical"
   */
  orientation?: TimelineOrientation;
  /**
   * `"dot"` (default): a 12px mark. `"badge"`: a 32px disc that can carry an
   * item's `node` content — a step number, a glyph — for a “how it works”
   * rail. The item padding and connector move with it. @default "dot"
   */
  nodeSize?: TimelineNodeSize;
}

/**
 * The `<ol>` that owns the rail geometry; compose `TimelineItem`s inside.
 * Declares `--timeline-label-width` (default `9rem`) — the gutter an item’s
 * `label` occupies at `@2xl`+ in the vertical orientation; retune it per
 * surface: `className="[--timeline-label-width:--spacing(28)]"`.
 */
export const TimelineRoot = forwardRef<HTMLOListElement, TimelineRootProps>(function TimelineRoot(
  { variant = "status", orientation = "vertical", nodeSize = "dot", className, ...props },
  ref,
) {
  return (
    <TimelineContext.Provider value={{ variant, orientation, nodeSize }}>
      <ol
        ref={ref}
        data-slot="timeline"
        data-orientation={orientation}
        data-variant={variant}
        data-node-size={nodeSize}
        className={cn(
          "relative @container [--timeline-label-width:9rem]",
          orientation === "horizontal" && "flex",
          orientation === "responsive" && "@3xl:flex",
          className,
        )}
        {...props}
      />
    </TimelineContext.Provider>
  );
});

/**
 * Per-orientation geometry for the item, its connector and its node. The
 * vertical set is byte-identical to the pre-variant rail; `responsive` is the
 * vertical set plus `@3xl:` overrides that re-lay the same three elements
 * horizontally — one item, one connector, one node, no duplicated markup.
 */
interface Geometry {
  item: string;
  itemLabelled: string;
  connector: string;
  node: string;
  label: string;
}

const DOT_GEOMETRY: Record<TimelineOrientation, Geometry> = {
  vertical: {
    item: "pb-5 ps-7 last:pb-0",
    itemLabelled: "@2xl:ps-[calc(var(--timeline-label-width)+1.75rem)]",
    connector: "start-[5px] top-2.5 h-full w-px",
    node: "start-0 top-1",
    label: "@2xl:top-0.5",
  },
  horizontal: {
    item: "min-w-0 flex-1 pe-6 pt-7 last:pe-0",
    itemLabelled: "",
    connector: "start-2.5 top-[5px] h-px w-full",
    node: "start-0 top-0",
    label: "",
  },
  responsive: {
    item: "pb-5 ps-7 last:pb-0 @3xl:min-w-0 @3xl:flex-1 @3xl:pb-0 @3xl:pe-6 @3xl:ps-0 @3xl:pt-7 @3xl:last:pe-0",
    itemLabelled: "@2xl:ps-[calc(var(--timeline-label-width)+1.75rem)] @3xl:ps-0",
    connector:
      "start-[5px] top-2.5 h-full w-px @3xl:start-2.5 @3xl:top-[5px] @3xl:h-px @3xl:w-full",
    node: "start-0 top-1 @3xl:top-0",
    label: "@2xl:top-0.5",
  },
};

/**
 * The 32px `badge` node: same three elements, the connector centred under a
 * `size-8` disc (`start-4`/`top-4`) and the content pushed clear of it.
 */
const BADGE_GEOMETRY: Record<TimelineOrientation, Geometry> = {
  vertical: {
    item: "pb-8 ps-12 last:pb-0",
    itemLabelled: "@2xl:ps-[calc(var(--timeline-label-width)+3rem)]",
    connector: "start-4 top-8 h-full w-px",
    node: "start-0 top-0",
    label: "@2xl:top-1.5",
  },
  horizontal: {
    item: "min-w-0 flex-1 pe-6 pt-12 last:pe-0",
    itemLabelled: "",
    connector: "start-8 top-4 h-px w-full",
    node: "start-0 top-0",
    label: "",
  },
  responsive: {
    item: "pb-8 ps-12 last:pb-0 @3xl:min-w-0 @3xl:flex-1 @3xl:pb-0 @3xl:pe-6 @3xl:ps-0 @3xl:pt-12 @3xl:last:pe-0",
    itemLabelled: "@2xl:ps-[calc(var(--timeline-label-width)+3rem)] @3xl:ps-0",
    connector: "start-4 top-8 h-full w-px @3xl:start-8 @3xl:top-4 @3xl:h-px @3xl:w-full",
    node: "start-0 top-0",
    label: "@2xl:top-1.5",
  },
};

const GEOMETRY: Record<TimelineNodeSize, Record<TimelineOrientation, Geometry>> = {
  dot: DOT_GEOMETRY,
  badge: BADGE_GEOMETRY,
};

/** Connector/node offsets that move with the label gutter (vertical only). */
const LABELLED_RAIL: Record<
  TimelineNodeSize,
  Record<TimelineOrientation, { connector: string; node: string }>
> = {
  dot: {
    vertical: {
      connector: "@2xl:start-[calc(var(--timeline-label-width)+5px)]",
      node: "@2xl:start-(--timeline-label-width)",
    },
    horizontal: { connector: "", node: "" },
    responsive: {
      connector: "@2xl:start-[calc(var(--timeline-label-width)+5px)] @3xl:start-2.5",
      node: "@2xl:start-(--timeline-label-width) @3xl:start-0",
    },
  },
  badge: {
    vertical: {
      connector: "@2xl:start-[calc(var(--timeline-label-width)+1rem)]",
      node: "@2xl:start-(--timeline-label-width)",
    },
    horizontal: { connector: "", node: "" },
    responsive: {
      connector: "@2xl:start-[calc(var(--timeline-label-width)+1rem)] @3xl:start-8",
      node: "@2xl:start-(--timeline-label-width) @3xl:start-0",
    },
  },
};

/** Ink for `node` content on a `badge` disc, per the disc's fill. */
const NODE_INK: Record<Status, string> = {
  pending: "text-foreground",
  running: "text-info-foreground",
  complete: "text-success-foreground",
  "awaiting-approval": "text-warning-foreground",
  denied: "text-muted-foreground",
  failed: "text-destructive-foreground",
  skipped: "text-muted-foreground",
};

/** Node look in the `plain` variant — a chronology has no status, only “now”. */
const PLAIN_NODE = {
  past: "border-border-strong bg-background text-foreground",
  current: "border-primary bg-primary text-primary-foreground ring-2 ring-primary/25",
};

export interface TimelineItemProps extends LiHTMLAttributes<HTMLLIElement> {
  /**
   * The canonical execution status (closed 7-state enum, status-badge #189).
   * Ignored by a `plain` root — use `current` there.
   */
  status?: Status;
  /**
   * `plain` variant only: this is the “now” step — accent node,
   * `aria-current="step"`, and an sr-only “(current)” after the title.
   */
  current?: boolean;
  /**
   * Leading meta (a date, a version) that sits in the label gutter beside the
   * node at `@2xl`+ when vertical, and above the title otherwise.
   */
  label?: ReactNode;
  /**
   * Content for the node when the root is `nodeSize="badge"` — a step number,
   * a glyph. Decorative (the disc is `aria-hidden`): put the step's number in
   * the title too if it matters (“Step 1: …”). Ignored by a `dot` root.
   */
  node?: ReactNode;
  /** Right-aligned meta (e.g. a date) on the title row. */
  timestamp?: ReactNode;
  /** Secondary line under the title. */
  description?: ReactNode;
  /**
   * Rich block content under the title/description, indented with the rail —
   * the slot composing consumers (e.g. `@elabs-ai/components-ai`'s `AgentStep`, #192)
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
  {
    status = "pending",
    current = false,
    label,
    node,
    timestamp,
    description,
    detail,
    className,
    children,
    ...props
  },
  ref,
) {
  const { variant, orientation, nodeSize } = useContext(TimelineContext);
  const { t } = useLocale();
  const plain = variant === "plain";
  const badge = nodeSize === "badge";
  const geometry = GEOMETRY[nodeSize][orientation];
  const labelled = label !== undefined && label !== null;
  const rail = labelled ? LABELLED_RAIL[nodeSize][orientation] : { connector: "", node: "" };
  const mutedTitle = plain ? false : MUTED_TITLE_STATUSES.has(status);
  // A `plain` item may carry its own heading inside `detail` (a release entry
  // whose title is an `<h2>`): with no `children` the inline title row is
  // skipped rather than rendered empty. The status rail always announces.
  const hasTitleRow = !plain || children != null || Boolean(timestamp);
  return (
    <li
      ref={ref}
      data-slot="timeline-item"
      aria-current={plain && current ? "step" : undefined}
      data-status={plain ? undefined : status}
      data-current={plain && current ? "" : undefined}
      className={cn(
        "group/timeline-item relative",
        geometry.item,
        labelled && geometry.itemLabelled,
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute bg-border group-last/timeline-item:hidden",
          geometry.connector,
          rail.connector,
        )}
      />
      <span
        aria-hidden="true"
        data-slot="timeline-item-node"
        className={cn(
          "absolute rounded-full border-2",
          badge
            ? "flex size-8 items-center justify-center text-meta font-semibold tabular-nums shadow-xs [&>svg]:size-4"
            : "size-3",
          geometry.node,
          rail.node,
          plain ? (current ? PLAIN_NODE.current : PLAIN_NODE.past) : NODE_STYLE[status],
          badge && !plain && NODE_INK[status],
        )}
      >
        {badge ? node : null}
      </span>
      {labelled ? (
        <div
          className={cn(
            "mb-1 text-meta text-muted-foreground tabular-nums",
            orientation !== "horizontal" &&
              "@2xl:absolute @2xl:start-0 @2xl:mb-0 @2xl:w-(--timeline-label-width) @2xl:pe-4",
            geometry.label,
            orientation === "responsive" && "@3xl:static @3xl:mb-1 @3xl:w-auto @3xl:pe-0",
          )}
          data-slot="timeline-item-label"
        >
          {label}
        </div>
      ) : null}
      {hasTitleRow ? (
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "text-body font-medium",
              mutedTitle ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {/* The dot is `aria-hidden` and `data-status` isn't AT-visible (#387) —
                this is the step's only announced status; kept inline so it reads
                naturally as "<Status>: <title>" instead of a second live region. */}
            {plain ? null : <span className="sr-only">{STATUS_LABELS[status]}: </span>}
            {children}
            {plain && current ? <span className="sr-only"> {t("ui.timeline.current")}</span> : null}
          </span>
          {timestamp ? (
            <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
              {timestamp}
            </span>
          ) : null}
        </div>
      ) : null}
      {description ? <p className="mt-0.5 text-body text-muted-foreground">{description}</p> : null}
      {detail ? <div className={cn("space-y-2", hasTitleRow && "mt-2")}>{detail}</div> : null}
    </li>
  );
});

/**
 * One step of the array-API `Timeline` (the editor's original item shape —
 * re-exported by `@elabs-ai/components-editor` as `TimelineItem` for back-compat).
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
