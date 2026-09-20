// registry: handoff-inspector-01 — copied 2026-09-19
"use client";

import { ArrowRight, Bot, Check, CircleX, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  Meter,
  STATUS_TONE_ICONS,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";
import type { CustomStatus } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  handoff,
  type HandoffField,
  type HandoffFieldStatus,
} from "../agent-ops-parts/data/atlas-ops";
import { formatCount, formatDuration, formatShare } from "../agent-ops-parts/format";

function statusOf(f: HandoffField): HandoffFieldStatus {
  if (f.expected === "not used") return "unused";
  if (f.expected === "required" && !f.sent) return "missing";
  return "match";
}

/** The three field outcomes mapped ONCE to `StatusBadge`’s tone hatch. */
const FIELD_STATUS: Record<HandoffFieldStatus, CustomStatus> = {
  match: { label: "Match", tone: "success", icon: STATUS_TONE_ICONS.success },
  missing: { label: "Missing", tone: "destructive", icon: STATUS_TONE_ICONS.destructive },
  unused: { label: "Unused", tone: "neutral" },
};

export interface HandoffInspectorProps {
  data?: typeof handoff;
  locale?: string;
  className?: string;
}

/**
 * A handoff inspector — one edge of a multi-agent run, opened because it
 * failed (or to prove it did not). Three parts, in reading order:
 *
 * 1. The handoff path: sender → a metric pill on the arrow (context size,
 *    latency, tokens, fields present of required) → receiver. The pill sits
 *    ON the edge because those numbers belong to the hop, not to either end.
 * 2. Context comparison: one row per field, what the sender sent against
 *    what the receiver expects, and a status badge (glyph + word). A
 *    required field that was not sent is the row the reader came for.
 * 3. Payload size against the workflow baseline as a meter, and the edge’s
 *    24-hour health — so a single failed hop is read against how the same
 *    edge usually behaves.
 */
export function HandoffInspector({
  data = handoff,
  locale = "en-US",
  className,
}: HandoffInspectorProps) {
  const required = data.fields.filter((f) => f.expected === "required");
  const present = required.filter((f) => f.sent).length;
  const complete = present === required.length;
  const missing = data.fields.filter((f) => statusOf(f) === "missing");

  return (
    <div className={cn("@container space-y-4", className)} data-slot="handoff-inspector">
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-title text-foreground">
              {data.from.agent}{" "}
              <ArrowRight aria-hidden="true" className="inline size-5 align-[-3px]" />{" "}
              <span className="sr-only">to </span>
              {data.to.agent}
            </h3>
            <StatusBadge
              status={
                complete
                  ? { label: "Context complete", tone: "success", icon: STATUS_TONE_ICONS.success }
                  : {
                      label: "Context dropped",
                      tone: "destructive",
                      icon: STATUS_TONE_ICONS.destructive,
                    }
              }
            />
            <p className="basis-full text-caption text-muted-foreground">
              Handoff inspector · trace <span className="font-mono">{data.traceId}</span> ·{" "}
              <span className="font-mono tabular-nums">
                {new Intl.DateTimeFormat(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  fractionalSecondDigits: 3,
                  hour12: false,
                  timeZone: "UTC",
                }).format(data.at)}
              </span>
            </p>
          </div>

          <p className="mb-2 text-eyebrow uppercase text-muted-foreground">Handoff path</p>
          <ol
            className="grid grid-cols-1 items-center gap-3 @3xl:grid-cols-[minmax(12rem,1fr)_auto_minmax(12rem,1fr)]"
            data-slot="handoff-inspector-path"
          >
            <Endpoint agent={data.from.agent} note={data.from.note} />
            <li className="relative flex items-center justify-center py-2 @3xl:px-4">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 top-1/2 hidden h-0.5 @3xl:block",
                  complete ? "bg-success" : "bg-destructive",
                )}
              />
              <dl className="relative grid grid-cols-4 gap-x-4 rounded-lg border border-border bg-card px-3 py-2 text-center">
                <Metric
                  label="context"
                  value={`${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(data.contextKb)} KB`}
                />
                <Metric label="latency" value={formatDuration(data.latencyMs, locale)} />
                <Metric label="tokens" value={formatCount(data.tokens, locale)} />
                <Metric
                  label="fields"
                  tone={complete ? undefined : "destructive"}
                  value={`${present} of ${required.length}`}
                />
              </dl>
            </li>
            <Endpoint agent={data.to.agent} failed={!complete} note={data.to.note} />
          </ol>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,1fr)_16rem]">
        <Card className="min-w-0">
          <CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-subtitle text-foreground">Context comparison</h4>
              <span
                className={cn(
                  "text-caption tabular-nums",
                  complete ? "text-success-text" : "text-destructive-text",
                )}
              >
                {present} of {required.length} required fields present
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Context field</TableHead>
                  <TableHead>Sent by {data.from.agent.split(" ")[0]}</TableHead>
                  <TableHead>Expected by {data.to.agent.split(" ")[0]}</TableHead>
                  <TableHead className="text-end">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.fields.map((f) => {
                  const status = statusOf(f);
                  return (
                    <TableRow
                      className={cn(status === "missing" && "bg-destructive/5")}
                      data-slot="handoff-inspector-field"
                      key={f.name}
                    >
                      <TableCell className="font-mono text-code text-foreground">
                        {f.name}
                      </TableCell>
                      <TableCell>
                        <Presence present={f.sent} word={f.sent ? "present" : "absent"} />
                      </TableCell>
                      <TableCell>
                        <Presence present={f.expected !== "not used"} word={f.expected} />
                      </TableCell>
                      <TableCell className="text-end">
                        <StatusBadge status={FIELD_STATUS[status]} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {missing.length > 0 ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-caption text-destructive-text">
                <CircleX aria-hidden="true" className="size-3.5" />
                {missing.map((f) => f.name).join(", ")} required by {data.to.agent} and not sent —
                the contract was violated on this hop.
              </p>
            ) : null}

            <div className="mt-5">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-eyebrow uppercase text-muted-foreground">Context payload size</p>
                <p className="text-caption tabular-nums text-muted-foreground">
                  {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                    data.contextKb,
                  )}{" "}
                  KB ·{" "}
                  {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                    data.contextKb / data.baselineKb,
                  )}
                  × workflow baseline
                </p>
              </div>
              <Meter
                aria-label="Context payload against the workflow baseline"
                aria-valuetext={`${data.contextKb} KB, baseline ${data.baselineKb} KB`}
                marker={data.baselineKb}
                markerLabel={`baseline ${data.baselineKb} KB`}
                max={Math.max(data.contextKb, data.baselineKb) * 1.5}
                value={data.contextKb}
                variant={data.contextKb > data.baselineKb * 1.5 ? "warning" : "default"}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-eyebrow uppercase text-muted-foreground">Edge health · 24 h</p>
            <dl className="space-y-3">
              <div>
                <dt className="text-caption text-muted-foreground">Runs on this edge</dt>
                <dd className="text-kpi-sm tabular-nums text-foreground">
                  {formatCount(data.edge.runs24h, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Avg latency</dt>
                <dd className="text-kpi-sm tabular-nums text-foreground">
                  {formatDuration(data.edge.avgLatencyMs, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Context complete</dt>
                <dd className="text-kpi-sm tabular-nums text-foreground">
                  {formatShare(data.edge.completeShare, locale)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-border pt-3 text-caption text-muted-foreground">
              {data.analysis}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Endpoint({ agent, note, failed }: { agent: string; note: string; failed?: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg p-3",
        failed ? "border border-dashed border-destructive" : "bg-surface-muted",
      )}
      data-slot="handoff-inspector-endpoint"
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-md",
          failed ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
        )}
      >
        <Bot className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-body text-foreground">{agent}</p>
        <p className="truncate text-caption text-muted-foreground">{note}</p>
      </div>
    </li>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "destructive" }) {
  return (
    // dt precedes dd in the DOM (a valid <dl> group); the value reads first
    // visually via flex-col-reverse.
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd
        className={cn("text-body tabular-nums", tone ? "text-destructive-text" : "text-foreground")}
      >
        {value}
      </dd>
    </div>
  );
}

function Presence({ present, word }: { present: boolean; word: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-body",
        present ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {present ? (
        <Check aria-hidden="true" className="size-3.5 text-success" />
      ) : (
        <Minus aria-hidden="true" className="size-3.5" />
      )}
      {word}
    </span>
  );
}
