/**
 * StatusBadge — the canonical execution-status vocabulary (#189, research 10 §B.1).
 *
 * One CLOSED 7-state enum unifies the five status idioms across the agent
 * trace components (`@elabs-ai/components-ai` Tool / ChainOfThought / Confirmation /
 * TestResults / Sandbox), so one agent run reads as one author and an agent
 * picks a status by MEANING — it cannot emit a color or a freeform string.
 *
 * Hybrid visual (research 08 "green deliberate / status sparingly"): the calm
 * states — including `complete` — render the quiet `bg-<status>/10` alpha-wash
 * or a neutral fill; ONLY the two attention states (`awaiting-approval`,
 * `failed`) get the solid status fill, so a settled transcript stays calm and
 * the states that need a human grab the eye.
 *
 * Builds ON the existing Badge cva (badge.tsx) — same pill geometry and
 * typography; status colors are semantic tokens only.
 *
 * BOUNDED ESCAPE HATCH (#363): a domain that genuinely has a state the 7
 * canonical values don't express (e.g. a run engine's `stopped_guardrail`) can
 * pass a `CustomStatus` object instead of a `Status` string. Three integrity
 * constraints keep it from eroding the anti-hallucination property above:
 *
 *   1. `tone` is reachable ONLY through the object form (which requires a
 *      `label`) — it is NOT an independent prop, so a canonical status can
 *      never be recolored (`status="failed" tone="success"` is unrepresentable).
 *   2. The hatch is CALM-ONLY: all five tones render the quiet alpha-wash/
 *      neutral treatments. The solid attention fill stays exclusive to the
 *      canonical `awaiting-approval` and `failed` — no consumer can mint a
 *      loud chip, or the loud/calm signal degrades to noise.
 *   3. No raw color, ever: `tone` maps to existing semantic tokens only
 *      (secondary / info / success / warning / destructive).
 *
 * Map a custom status ONCE, near your domain — not per call site. `StatusIcon`
 * stays canonical-only (the enum's own icon+color atom); there is no `emphasis`/
 * `loud` option on the hatch; `fromTimelineStatus()` is unchanged.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MinusCircle,
  XCircle,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { badgeVariants } from "../badge/badge";
import { cn } from "../../lib/cn";

/** The canonical, closed 7-state status enum (research 10 §B.1). */
export const STATUSES = [
  "pending",
  "running",
  "complete",
  "awaiting-approval",
  "denied",
  "failed",
  "skipped",
] as const;

export type Status = (typeof STATUSES)[number];

/** Closed tone set for the out-of-vocabulary escape hatch (CALM treatments only). */
export const STATUS_TONES = ["neutral", "info", "success", "warning", "destructive"] as const;

export type StatusTone = (typeof STATUS_TONES)[number];

/**
 * An out-of-vocabulary status. Prefer the canonical `Status` enum; reach for
 * this only when the domain genuinely has a state the 7 do not express (e.g. a
 * run engine's `stopped_guardrail`). Map it ONCE, near your domain — not per
 * call site.
 */
export interface CustomStatus {
  label: string;
  tone: StatusTone;
  /** Optional Lucide glyph. Omitted → label-only (no default glyph). */
  icon?: LucideIcon;
}

/** Narrows `Status | CustomStatus` — the object form is always the escape hatch. */
export function isCustomStatus(status: Status | CustomStatus): status is CustomStatus {
  return typeof status === "object" && status !== null;
}

/**
 * The tone each CANONICAL status maps to, for the informational `data-tone`
 * attribute only — canonical rendering always goes through the untouched
 * `status` cva branch below, never through `tone`.
 */
const STATUS_TONE_MAP: Record<Status, StatusTone> = {
  pending: "neutral",
  running: "info",
  complete: "success",
  "awaiting-approval": "warning",
  denied: "neutral",
  failed: "destructive",
  skipped: "neutral",
};

/**
 * The canonical semantic ROLE per status — the single source of truth for
 * status colour (#392). Any other status-keyed colour map in the repo
 * (`Timeline`'s `NODE_STYLE`, or a future one) must be TESTED against this,
 * not hand-authored — a second literal copy is exactly how `NODE_STYLE`
 * drifted (`running` rendered `--primary` while this map said `--info`).
 * Do NOT interpolate `bg-${STATUS_ROLE[status]}` into a class map: Tailwind
 * scans source statically, so a template-literal class emits no CSS. Keep
 * consuming maps as literal class strings, verified against this export by a
 * test.
 */
export const STATUS_ROLE = {
  pending: "secondary",
  running: "info",
  complete: "success",
  "awaiting-approval": "warning",
  denied: "muted",
  failed: "destructive",
  skipped: "secondary",
} as const satisfies Record<Status, string>;

/** Default human-readable label per status (override via `children`). */
export const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  running: "Running",
  complete: "Complete",
  "awaiting-approval": "Awaiting approval",
  denied: "Denied",
  failed: "Failed",
  skipped: "Skipped",
};

const STATUS_ICONS: Record<Status, LucideIcon> = {
  pending: Circle,
  running: Loader2,
  complete: CheckCircle2,
  "awaiting-approval": Clock,
  denied: XCircle,
  failed: AlertCircle,
  skipped: MinusCircle,
};

/**
 * Lucide glyph per out-of-vocabulary TONE — the same five-tone escape hatch
 * `CustomStatus` uses (`STATUS_TONES`). A consumer that encodes a bare TONE
 * with no fuller `Status` semantics (e.g. `@elabs-ai/components-flow`'s `FlowNode.tone`,
 * #387) derives its non-colour cue from here instead of inventing a second
 * icon vocabulary — each entry reuses the SAME icon `STATUS_ICONS` already
 * pairs with that tone's one canonical status (`success`→`complete`'s
 * `CheckCircle2`, `warning`→`awaiting-approval`'s `Clock`,
 * `destructive`→`failed`'s `AlertCircle`). `neutral`/`info` have no entry:
 * nothing consumes them yet, and reaching for a glyph on every neutral/
 * default-toned element would be assistive-tech noise on the common case —
 * extend this map, don't fork a new one, the day something needs them.
 */
export const STATUS_TONE_ICONS: Partial<Record<StatusTone, LucideIcon>> = {
  success: CheckCircle2,
  warning: Clock,
  destructive: AlertCircle,
};

/**
 * On-surface icon color per status for the standalone `StatusIcon` atom.
 * (Inside `StatusBadge` the icon inherits the badge foreground instead, so it
 * stays legible on the solid attention fills.)
 */
const STATUS_ICON_CLASSES: Record<Status, string> = {
  pending: "text-muted-foreground",
  running: "text-info-text",
  complete: "text-success-text",
  "awaiting-approval": "text-warning-text",
  denied: "text-muted-foreground",
  failed: "text-destructive-text",
  skipped: "text-muted-foreground",
};

/** `animate-spin` is a continuous loop (ease-linear is the allowed loop ease). */
const RUNNING_SPIN_CLASSES = "animate-spin motion-reduce:animate-none";

export interface StatusIconProps extends Omit<LucideProps, "ref"> {
  /** The canonical execution status (closed enum). */
  status: Status;
}

/**
 * The icon + status-color atom `StatusBadge` itself composes — for tight rows
 * (test-result rows, timeline/rail nodes) where a full badge is too heavy.
 * Decorative by default (`aria-hidden`); the adjacent row text must carry the
 * status name for AT users.
 */
export const StatusIcon = forwardRef<SVGSVGElement, StatusIconProps>(function StatusIcon(
  { status, className, ...props },
  ref,
) {
  const Icon = STATUS_ICONS[status];
  return (
    <Icon
      ref={ref}
      aria-hidden="true"
      data-status={status}
      className={cn(
        "size-4 shrink-0",
        STATUS_ICON_CLASSES[status],
        status === "running" && RUNNING_SPIN_CLASSES,
        className,
      )}
      {...props}
    />
  );
});

export const statusBadgeVariants = cva(
  // Builds on the Badge pill (geometry + typography from badge.tsx). The
  // `outline` variant carries no fill, so each status sets its own
  // border/bg/text — conflicts resolve via cn() (later utilities win).
  cn(badgeVariants({ variant: "outline" }), "[&_svg]:shrink-0"),
  {
    variants: {
      status: {
        // calm: neutral fill
        pending: "border-transparent bg-secondary text-secondary-foreground",
        // calm: status alpha-wash (escapes the decoration drawn-not-filled rule)
        running: "border-info/40 bg-info/10 text-info-text",
        complete: "border-success/40 bg-success/10 text-success-text",
        // ATTENTION: solid fill — must grab the eye
        "awaiting-approval": "border-transparent bg-warning text-warning-foreground",
        // calm: de-emphasized neutrals
        denied: "border-transparent bg-muted text-muted-foreground",
        // ATTENTION: solid fill — must grab the eye
        failed: "border-transparent bg-destructive text-destructive-foreground",
        skipped: "border-transparent bg-secondary text-muted-foreground",
      },
      /**
       * The out-of-vocabulary escape hatch (#363) — CALM treatments only (the
       * same alpha-wash/neutral technique as the calm `status` recipes above).
       * There is deliberately no solid/attention recipe here: the loud fill
       * stays exclusive to the canonical `awaiting-approval`/`failed` states
       * (integrity constraint 2, see the file docblock).
       */
      tone: {
        neutral: "border-transparent bg-secondary text-secondary-foreground",
        info: "border-info/40 bg-info/10 text-info-text",
        success: "border-success/40 bg-success/10 text-success-text",
        warning: "border-warning/40 bg-warning/10 text-warning-text",
        destructive: "border-destructive/40 bg-destructive/10 text-destructive-text",
      },
      /** `md` for inline use; `sm` for rail nodes / dense rows. */
      size: {
        sm: "px-2 [&_svg]:size-3",
        md: "[&_svg]:size-3.5",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface StatusBadgeProps
  extends
    HTMLAttributes<HTMLSpanElement>,
    Omit<VariantProps<typeof statusBadgeVariants>, "status" | "tone"> {
  /** The canonical execution status, or a mapped out-of-vocabulary one (#363). */
  status: Status | CustomStatus;
  /** Render label-only (no status icon). */
  hideIcon?: boolean;
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(function StatusBadge(
  { status, size, hideIcon = false, className, children, ...props },
  ref,
) {
  if (isCustomStatus(status)) {
    const { label, tone, icon: Icon } = status;
    return (
      <span
        ref={ref}
        data-slot="status-badge"
        data-status="custom"
        data-tone={tone}
        className={cn(statusBadgeVariants({ tone, size }), className)}
        {...props}
      >
        {hideIcon || !Icon ? null : <Icon aria-hidden="true" />}
        {children ?? label}
      </span>
    );
  }

  const Icon = STATUS_ICONS[status];
  return (
    <span
      ref={ref}
      data-slot="status-badge"
      data-status={status}
      data-tone={STATUS_TONE_MAP[status]}
      className={cn(statusBadgeVariants({ status, size }), className)}
      {...props}
    >
      {hideIcon ? null : (
        <Icon
          aria-hidden="true"
          className={status === "running" ? RUNNING_SPIN_CLASSES : undefined}
        />
      )}
      {children ?? STATUS_LABELS[status]}
    </span>
  );
});

/** The editor/markdown `Timeline` 3-state vocabulary (`@elabs-ai/components-editor`). */
export type TimelineStatus = "done" | "active" | "pending";

const TIMELINE_STATUS_MAP: Record<TimelineStatus, Status> = {
  done: "complete",
  active: "running",
  pending: "pending",
};

/**
 * Map the Timeline `done|active|pending` vocabulary onto the canonical
 * `Status` (research 10 §B.1 mapping b — lossless; the timeline only
 * expresses 3 of the 7 states). The AI-SDK `ToolUIPart` mapper lives in
 * `@elabs-ai/components-ai` (`statusFromToolState`, tool.tsx) so `@elabs-ai/components-ui` stays free of
 * the `ai` dependency (D6).
 */
export function fromTimelineStatus(status: TimelineStatus): Status {
  return TIMELINE_STATUS_MAP[status];
}
