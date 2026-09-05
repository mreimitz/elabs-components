/**
 * The flagship shell's optional third zone — a narrow, filterable list that
 * SCOPES the content pane (pick a pipeline, the console pane answers for it).
 *
 * It is deliberately not a second copy of the runs table: the list answers
 * "which thing am I looking at", the content pane answers "what is happening to
 * it". If your app has nothing to scope by, drop the zone — `AppShellPage`
 * takes `showList={false}` and the geometry closes up on its own.
 *
 * Status here is never colour alone: every row pairs the `StatusIcon` glyph
 * with the status WORD, so the row survives greyscale and reaches assistive
 * tech through its accessible name rather than through a `data-` attribute.
 */
"use client";

import { useId, useMemo, useState, type ComponentProps } from "react";
import {
  cn,
  Skeleton,
  StatePanel,
  StatusIcon,
  STATUS_LABELS,
  type Status,
} from "@elabs-ai/components-ui";
import { SearchInput } from "@elabs-ai/components-data";

/** One row of the list — the smallest thing worth scoping the content pane by. */
export interface PipelineSummary {
  id: string;
  name: string;
  /** Canonical execution status (`@elabs-ai/components-ui`'s closed 7-state enum). */
  status: Status;
  /** Runs in the current window — the number the row is sorted and judged by. */
  runCount: number;
  owner: string;
}

/** Demo fixture — replace with your own data. */
export const DEMO_PIPELINES: PipelineSummary[] = [
  {
    id: "orders-ingest",
    name: "Orders ingest",
    status: "failed",
    runCount: 42,
    owner: "Ada Okonkwo",
  },
  {
    id: "customer-sync",
    name: "Customer sync",
    status: "running",
    runCount: 128,
    owner: "Ada Okonkwo",
  },
  {
    id: "inventory-rollup",
    name: "Inventory rollup",
    status: "awaiting-approval",
    runCount: 31,
    owner: "Mara Lindqvist",
  },
  {
    id: "billing-export",
    name: "Billing export",
    status: "complete",
    runCount: 90,
    owner: "Tomas Rey",
  },
  {
    id: "telemetry-rollup",
    name: "Telemetry rollup",
    status: "complete",
    runCount: 214,
    owner: "Tomas Rey",
  },
  {
    id: "vendor-feed",
    name: "Vendor feed",
    status: "pending",
    runCount: 7,
    owner: "Mara Lindqvist",
  },
  {
    id: "archive-sweep",
    name: "Archive sweep",
    status: "skipped",
    runCount: 3,
    owner: "Ada Okonkwo",
  },
];

export interface AppListColumnProps extends Omit<ComponentProps<"aside">, "onSelect"> {
  items: PipelineSummary[];
  /** Id of the row the content pane is currently scoped to. */
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** No renderable content yet — renders layout-shaped skeleton rows. */
  loading?: boolean;
  /** Zone heading. @default "Pipelines" */
  heading?: string;
}

export function AppListColumn({
  items,
  selectedId,
  onSelect,
  loading = false,
  heading = "Pipelines",
  className,
  ...props
}: AppListColumnProps) {
  const headingId = useId();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) || item.owner.toLowerCase().includes(needle),
    );
  }, [items, query]);

  return (
    <aside
      data-slot="app-list-column"
      // A real landmark, labelled by its own visible heading: the zone sits
      // OUTSIDE `<main>`, so without one its content belongs to no region a
      // screen-reader user can jump to.
      aria-labelledby={headingId}
      // Below `md` the zone folds away entirely rather than stacking: two
      // scrolling columns on a phone is worse than one. The trailing rule is the
      // only cue between this zone and the canvas, so it takes the strong rung.
      className={cn(
        "hidden w-(--shell-list-w) shrink-0 flex-col border-e border-border-strong bg-background md:flex",
        className,
      )}
      {...props}
    >
      {/* Matches the top bar's 3.5rem row so the two zones share one horizon. */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border-strong px-3">
        <h2 id={headingId} className="min-w-0 truncate text-subtitle text-foreground">
          {heading}
        </h2>
        <span className="ms-auto shrink-0 text-meta tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </div>

      <div className="shrink-0 px-3 py-2">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          label="Filter pipelines"
          placeholder="Filter pipelines…"
        />
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-2 pb-2"
        >
          <span className="sr-only">Loading pipelines…</span>
          {/* Layout-shaped: the same 3.25rem box a real row occupies, so nothing
              jumps when the data lands. */}
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-13 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <StatePanel
            kind="empty"
            title={query ? "Nothing matches that filter" : "No pipelines yet"}
            description={
              query
                ? "Try a shorter word, or clear the filter to see every pipeline."
                : "Pipelines you create or are given access to show up here."
            }
          />
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {filtered.map((item) => {
            const selected = item.id === selectedId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  // The selection is announced, not merely tinted — `aria-current`
                  // is the non-colour channel that survives greyscale and AT.
                  aria-current={selected ? "true" : undefined}
                  onClick={() => onSelect?.(item.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-start",
                    // Clipped by the scroll port above, so the inset rung.
                    "focus-ring-inset",
                    // The rail is reserved on EVERY row (transparent when the
                    // row is not the selection) so lighting it up shifts no
                    // text. Without it, hover and selection paint the same
                    // fill and a pointer makes every row look chosen.
                    "border-s-2 border-s-transparent",
                    "hover:bg-accent hover:text-accent-foreground",
                    selected && "border-s-primary bg-accent font-medium text-accent-foreground",
                  )}
                >
                  <span className="flex w-full items-center gap-2">
                    <StatusIcon status={item.status} />
                    <span className="min-w-0 flex-1 truncate text-body">{item.name}</span>
                    <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
                      {item.runCount}
                    </span>
                  </span>
                  <span className="ps-6 text-meta text-muted-foreground">
                    {STATUS_LABELS[item.status]} · {item.owner}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
