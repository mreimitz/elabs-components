"use client";

/**
 * ToolResultCard — an artifact the agent PRODUCED, presented as the headline
 * (#192, research 10 §B.4).
 *
 * The elevation channel of the surface-separation system (research 08 §H):
 * raised fill + shadow, NO border (elevation is the separation gesture — a
 * border here would be the redundant-border anti-pattern). A separate
 * component from `Tool` by design: `Tool` owns the rail/inspect idiom (a step
 * that ran, JSON behind disclosure); `ToolResultCard` hosts the produced
 * chart/table/file as `children` — so an agent picks the channel by NAME,
 * not by a behavioural mode flag.
 *
 * Presentational and dependency-light: it does NOT import `@qlik-coe-emea/qlabs-components-charts` or
 * `@qlik-coe-emea/qlabs-components-data` (one-way dep graph) — the consumer passes the artifact (an
 * `<AutoChart>`, `<DataTable>`, file preview, …) as children, and maps an
 * AI-SDK tool state to `status` via `statusFromToolState` (tool.tsx).
 *
 * **The card owns artifact-scoped chrome in its header row** — `title |
 * actions | status`, matching `ArtifactActions`, `DialogSection.actions` and
 * `SectionHeader.actions` elsewhere in the system. `actions` is scoped to the
 * artifact AS A WHOLE (expand it, download it, open it somewhere else); the
 * payload's own controls — a chart's flip-to-table, a table's sort — stay in
 * the payload's own frame, in the body. A card that hoisted them would present
 * one row of buttons that act on two different things.
 */
import { StatusBadge, type Status } from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export interface ToolResultCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Headline of the produced artifact (`text-subtitle`). */
  title?: ReactNode;
  /** The business summary line under the title (`text-meta`), not JSON. */
  summary?: ReactNode;
  /** Canonical execution status (closed enum); renders a `StatusBadge`. */
  status?: Status;
  /**
   * Controls scoped to the whole artifact — expand, download, open. Rendered in
   * the header row between the title and the status.
   *
   * A `ReactNode` slot, not a `role="toolbar"`: that role promises roving-tabindex
   * traversal, which this row does not implement. Keep the payload's own controls
   * out of here (see the note at the top of this file).
   */
  actions?: ReactNode;
  /**
   * The technical view, kept behind disclosure — pass a default-collapsed
   * `<ToolDetails>` holding `ToolInput`/`ToolOutput` (research 10 §B.5).
   */
  details?: ReactNode;
}

/** The produced artifact IS the headline; pass it as `children`. */
export const ToolResultCard = forwardRef<HTMLDivElement, ToolResultCardProps>(
  function ToolResultCard(
    { title, summary, status, actions, details, className, children, ...props },
    ref,
  ) {
    const hasHeader = title != null || summary != null || status != null || actions != null;
    return (
      <div
        ref={ref}
        className={cn(
          "not-prose w-full space-y-3 rounded-lg bg-surface-elevated p-4 shadow-sm",
          className,
        )}
        {...props}
      >
        {hasHeader ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-3">
              {title ? <h3 className="min-w-0 truncate text-subtitle">{title}</h3> : null}
              {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
              {status ? <StatusBadge className="shrink-0" size="sm" status={status} /> : null}
            </div>
            {summary ? <p className="text-meta text-muted-foreground">{summary}</p> : null}
          </div>
        ) : null}
        {children}
        {details}
      </div>
    );
  },
);
