// registry: insight-feed-01 — copied 2026-09-19
"use client";

import { TriangleAlert } from "lucide-react";
import { Button, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  COPILOT_NAME,
  derivationLoad,
  heldItems,
  insights,
  type HeldItem,
  type Insight,
} from "../agent-ops-parts/data/atlas-ops";
import { formatCount } from "../agent-ops-parts/format";
import { ConfidenceBar, SourceChip } from "../agent-ops-parts/provenance";

export interface InsightFeedProps {
  /** Defaults to the shared Atlas dataset. */
  items?: Insight[];
  /** The "needs a person" rail. Defaults to the shared dataset; pass `[]` to hide the rail. */
  held?: HeldItem[];
  /** Counts for the "derivation load" summary. */
  load?: typeof derivationLoad;
  /** Fires with the insight and which of its two actions was chosen. */
  onAction?: (insight: Insight, action: "primary" | "secondary") => void;
  copilotName?: string;
  locale?: string;
  /** Renders layout-shaped skeleton content instead of the real items. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * "What changed while you were away" — the AI-ops briefing pattern: a numbered
 * feed of things the copilot did or noticed, each a one-sentence FACT, a
 * paragraph of WHY (what it read, what it left alone), the evidence it read,
 * its confidence, and two actions. A conflict item is the exception that
 * proves the rule: it carries no confidence — "No verdict — a person decides".
 *
 * Beside it, "Needs a person" lists what stopped and is waiting, and
 * "Derivation load" states the split between applied / sent to you /
 * pinned by people. The three regions are one card + two, never a grid of
 * six tiles.
 */
export function InsightFeed({
  items = insights,
  held = heldItems,
  load = derivationLoad,
  onAction,
  copilotName = COPILOT_NAME,
  locale = "en-US",
  loading = false,
  className,
}: InsightFeedProps) {
  const applied = load.appliedAutomatically;
  const sent = load.sentToAPerson;

  return (
    // The outer div is the container; the grid is its child — an element
    // cannot answer a container query about its OWN size.
    <div className={cn("@container", className)} data-slot="insight-feed">
      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <Card aria-busy={loading || undefined} className="min-w-0" data-slot="insight-feed-main">
          <CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-subtitle text-foreground">What changed while you were away</h2>
              <p className="text-caption tabular-nums text-muted-foreground">
                {formatCount(applied, locale)} applied · {formatCount(sent, locale)} sent to you
              </p>
            </div>
            {loading ? (
              <div aria-live="polite" className="divide-y divide-border" role="status">
                <span className="sr-only">Loading changes…</span>
                {items.map((item) => (
                  <div className="space-y-3 py-4 first:pt-0 last:pb-0" key={item.id}>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-6 w-56" />
                  </div>
                ))}
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {items.map((item, i) => (
                  <InsightRow
                    copilotName={copilotName}
                    index={i + 1}
                    item={item}
                    key={item.id}
                    locale={locale}
                    onAction={onAction}
                  />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {held.length > 0 || load ? (
          <div className="flex min-w-0 flex-col gap-4" data-slot="insight-feed-rail">
            {held.length > 0 ? (
              <Card>
                <CardContent className="p-5">
                  <h2 className="mb-3 text-subtitle text-foreground">Needs a person</h2>
                  <ul className="space-y-3">
                    {held.map((h) => (
                      <li className="flex gap-2.5" key={h.id}>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-2 size-1.5 shrink-0 rounded-full",
                            h.tone === "destructive" ? "bg-destructive" : "bg-warning",
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-body text-foreground">
                            <span className="sr-only">
                              {h.tone === "destructive" ? "Blocked: " : "Held: "}
                            </span>
                            {h.title}
                          </p>
                          <p className="text-caption text-muted-foreground">{h.note}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 border-t border-border pt-3 text-caption text-muted-foreground">
                    {copilotName} never resolves a conflict, contacts a customer, or closes a deal
                    on its own. Those conditions always stop here.
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="p-5">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h2 className="text-subtitle text-foreground">Derivation load</h2>
                  <span className="text-caption text-muted-foreground">last 24 h</span>
                </div>
                <dl className="space-y-2">
                  <LoadRow
                    dot="bg-info"
                    label="fields updated automatically"
                    locale={locale}
                    value={load.appliedAutomatically}
                  />
                  <LoadRow
                    dot="bg-foreground"
                    label="sent to you"
                    locale={locale}
                    value={load.sentToAPerson}
                  />
                  <LoadRow
                    dot="bg-border-strong"
                    label="pinned by people — these override derivation"
                    locale={locale}
                    value={load.pinnedByPeople}
                  />
                </dl>
                <p className="mt-4 border-t border-border pt-3 text-caption text-muted-foreground">
                  A pinned value is never overwritten by a derivation. {copilotName} will tell you
                  when it disagrees, and then leave it alone.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LoadRow({
  dot,
  value,
  label,
  locale,
}: {
  dot: string;
  value: number;
  label: string;
  locale: string;
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span aria-hidden="true" className={cn("size-2 shrink-0 self-center rounded-full", dot)} />
      <dt className="order-2 min-w-0 text-body text-muted-foreground">{label}</dt>
      <dd className="order-1 text-subtitle tabular-nums text-foreground">
        {formatCount(value, locale)}
      </dd>
    </div>
  );
}

function InsightRow({
  item,
  index,
  copilotName,
  locale,
  onAction,
}: {
  item: Insight;
  index: number;
  copilotName: string;
  locale: string;
  onAction?: InsightFeedProps["onAction"];
}) {
  const isConflict = item.kind === "conflict";
  return (
    <li
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-4 first:pt-0 last:pb-0"
      data-slot="insight-feed-item"
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 inline-flex size-6 items-center justify-center rounded-md text-meta tabular-nums",
          isConflict ? "bg-warning/10 text-warning-text" : "bg-info/10 text-info-text",
        )}
      >
        {isConflict ? <TriangleAlert className="size-3.5" /> : index}
      </span>
      <div className="min-w-0 space-y-2">
        <h3 className="text-subtitle text-foreground">
          <span className="sr-only">{isConflict ? "Conflict: " : `Change ${index}: `}</span>
          {item.headline}
        </h3>
        <p className="text-body text-muted-foreground">{item.explanation}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.evidence.map((e) => (
              <SourceChip evidence={e} key={`${e.kind}-${e.label}`} />
            ))}
            {typeof item.confidence === "number" ? (
              <ConfidenceBar
                className="ms-1"
                label={`${copilotName}’s confidence`}
                locale={locale}
                value={item.confidence}
              />
            ) : (
              <span className="ms-1 text-caption text-warning-text">
                No verdict — a person decides
              </span>
            )}
          </div>
          <div className="ms-auto flex items-center gap-1">
            <Button onClick={() => onAction?.(item, "primary")} size="sm" variant="outline">
              {item.primaryAction}
            </Button>
            <Button onClick={() => onAction?.(item, "secondary")} size="sm" variant="ghost">
              {item.secondaryAction}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
