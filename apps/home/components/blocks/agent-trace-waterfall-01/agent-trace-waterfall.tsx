// registry: agent-trace-waterfall-01 — copied 2026-09-19
"use client";

import { ArrowRight, Bot, CircleX } from "lucide-react";
import { Gantt, type GanttStatus, type GanttTask } from "@elabs-ai/components-charts";
import { Card, CardContent, STATUS_TONE_ICONS, StatusBadge } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { trace, type SpanState, type TraceSpan } from "../agent-ops-parts/data/atlas-ops";
import { formatCount, formatDuration, formatMoney } from "../agent-ops-parts/format";

const SPAN_STATUS: Record<SpanState, GanttStatus> = {
  ok: "success",
  retry: "warning",
  failed: "destructive",
  skipped: "neutral",
};

export interface AgentTraceWaterfallProps {
  run?: typeof trace;
  /** Row height for the waterfall, px. Default 36. */
  rowHeight?: number;
  locale?: string;
  className?: string;
}

/**
 * An execution waterfall for one multi-agent run — the observability view an
 * agent-management product opens a trace on. Three parts, one order:
 *
 * 1. A stat strip (duration vs p95, agents invoked + retries, tokens in/out,
 *    cost vs the workflow average, where it failed) — every tile carries the
 *    comparison that makes its number readable.
 * 2. The waterfall itself: the charts package’s `Gantt` at sub-second
 *    granularity, one row per agent span, nested under its caller, status
 *    on the bar (glyph + label in the row, never colour alone), retries as
 *    their own rows so the timeline stays honest about wall-clock.
 * 3. "Context flow across the run" — a chain of the spans in call order,
 *    each stating the fields it carried in, so a dropped field (5 → 4) is
 *    visible at the hop where it was lost, not only in the error string.
 */
export function AgentTraceWaterfall({
  run = trace,
  rowHeight = 36,
  locale = "en-US",
  className,
}: AgentTraceWaterfallProps) {
  const t0 = run.startedAt.getTime();
  const tasks: GanttTask[] = run.spans.map((s) => ({
    id: s.id,
    name: <SpanName span={s} />,
    start: t0 + s.startMs,
    end: t0 + s.endMs,
    parentId: s.parentId,
    status: SPAN_STATUS[s.state],
    progress: s.state === "skipped" ? 0 : 1,
  }));
  const failed = run.spans.find((s) => s.state === "failed");
  const rootIds = run.spans.map((s) => s.id);
  // The chain: call order, retries folded into their parent, skipped spans kept
  // so the reader sees what never ran.
  const chain = run.spans.filter((s) => s.state !== "retry");

  return (
    <div className={cn("@container space-y-4", className)} data-slot="agent-trace-waterfall">
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-title text-foreground">
                Trace <span className="font-mono">{run.id}</span>
              </h3>
              <StatusBadge
                status={
                  failed
                    ? { label: "Failed", tone: "destructive", icon: STATUS_TONE_ICONS.destructive }
                    : { label: "Success", tone: "success", icon: STATUS_TONE_ICONS.success }
                }
              />
            </div>
            <p className="text-caption text-muted-foreground">
              {run.workflow} · started{" "}
              <span className="font-mono tabular-nums">
                {new Intl.DateTimeFormat(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  fractionalSecondDigits: 3,
                  hour12: false,
                  timeZone: "UTC",
                }).format(run.startedAt)}
              </span>
            </p>
          </div>

          <dl
            className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @4xl:grid-cols-5"
            data-slot="agent-trace-waterfall-stats"
          >
            <StatTile
              label="Duration"
              note={`p95 = ${formatDuration(run.p95Ms, locale)}`}
              tone={run.durationMs > run.p95Ms ? "warning" : undefined}
              value={formatDuration(run.durationMs, locale)}
            />
            <StatTile
              label="Agents invoked"
              note={`${formatCount(run.retries, locale)} ${run.retries === 1 ? "retry" : "retries"}`}
              tone={run.retries > 0 ? "warning" : undefined}
              value={formatCount(run.agentsInvoked, locale)}
            />
            <StatTile
              label="Tokens"
              note={`in ${formatCount(run.tokensIn, locale)} · out ${formatCount(run.tokensOut, locale)}`}
              value={formatCount(run.tokensIn + run.tokensOut, locale)}
            />
            <StatTile
              label="Cost"
              note={`${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(run.costUsd / run.workflowAvgCostUsd)}× workflow avg`}
              tone={run.costUsd > run.workflowAvgCostUsd * 2 ? "destructive" : undefined}
              value={formatMoney(run.costUsd, "USD", locale, 2)}
            />
            {failed ? (
              <StatTile
                label="Failed at"
                note={`invocation ${run.failedInvocation}`}
                tone="destructive"
                value={run.failedAt}
              />
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-subtitle text-foreground">Execution waterfall</h3>
            <p className="text-caption text-muted-foreground">
              one row per agent span · nested under its caller · retries as their own rows
            </p>
          </div>
          <Gantt
            aria-label={`Execution waterfall for trace ${run.id}`}
            defaultExpandedIds={rootIds}
            // 12 960 000 px/day == 150 px per second: a ~5 s run fills a
            // card-width canvas instead of huddling in its first third.
            defaultPixelsPerDay={12_960_000}
            defaultViewMode="auto"
            density="compact"
            labelColumnWidth={220}
            locale={locale}
            rowHeight={rowHeight}
            style={{ height: run.spans.length * rowHeight + 96 }}
            tasks={tasks}
            viewModes={["millisecond", "second"]}
          />
          {failed ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-caption text-destructive-text">
              <CircleX aria-hidden="true" className="size-3.5" />
              {run.spans
                .filter((s) => s.state === "skipped")
                .map((s) => s.agent)
                .join(" and ")}{" "}
              were never reached — the run terminated at {failed.agent.toLowerCase()} retry{" "}
              {run.retries > 0 ? 1 : 0}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-meta uppercase tracking-wide text-muted-foreground">
            Context flow across the run
          </h3>
          <ol
            className="flex flex-wrap items-stretch gap-2"
            data-slot="agent-trace-waterfall-chain"
          >
            {chain.map((s, i) => {
              const dropped = s.state !== "skipped" && s.fieldsPresent < s.fieldsExpected;
              return (
                <li className="flex items-center gap-2" key={s.id}>
                  <div
                    className={cn(
                      "flex min-w-40 items-center gap-2.5 rounded-lg p-3",
                      s.state === "failed"
                        ? "border border-dashed border-destructive"
                        : s.state === "skipped"
                          ? "border border-dashed border-border"
                          : "bg-surface-muted",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
                        s.state === "failed"
                          ? "bg-destructive/10 text-destructive"
                          : s.state === "skipped"
                            ? "bg-muted text-muted-foreground"
                            : "bg-success/10 text-success",
                      )}
                    >
                      <Bot className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-body",
                          s.state === "skipped" ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {s.agent}
                      </p>
                      <p
                        className={cn(
                          "text-caption tabular-nums",
                          dropped ? "text-destructive-text" : "text-muted-foreground",
                        )}
                      >
                        {s.state === "skipped"
                          ? "not reached"
                          : `${s.fieldsPresent} of ${s.fieldsExpected} fields · ${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(s.contextKb)} KB`}
                      </p>
                    </div>
                  </div>
                  {i < chain.length - 1 ? (
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
          {failed ? (
            <p className="mt-3 text-caption text-muted-foreground">
              <span className="font-mono text-code text-foreground">{run.error}</span> —{" "}
              {run.errorDetail}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SpanName({ span }: { span: TraceSpan }) {
  const tone =
    span.state === "failed"
      ? "text-destructive"
      : span.state === "retry"
        ? "text-warning"
        : span.state === "skipped"
          ? "text-border-strong"
          : "text-success";
  const word =
    span.state === "failed"
      ? "failed"
      : span.state === "retry"
        ? "retry"
        : span.state === "skipped"
          ? "not reached"
          : "ok";
  return (
    // `flex` (not `inline-flex`): an inline-flex box sizes to its full text and
    // spills past the Gantt label pill, so the name never truncates and axe reads
    // it against the bar fill instead of the pill.
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full bg-current", tone)} />
      <span className="truncate">{span.agent}</span>
      <span className="sr-only">, {word}</span>
    </span>
  );
}

function StatTile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "warning" | "destructive";
}) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-muted p-3" data-slot="agent-trace-waterfall-stat">
      <dt className="truncate text-caption text-muted-foreground">{label}</dt>
      <dd>
        <p className="truncate text-subtitle tabular-nums text-foreground">{value}</p>
        <p
          className={cn(
            "truncate text-caption",
            tone === "destructive"
              ? "text-destructive-text"
              : tone === "warning"
                ? "text-warning-text"
                : "text-muted-foreground",
          )}
        >
          {note}
        </p>
      </dd>
    </div>
  );
}
