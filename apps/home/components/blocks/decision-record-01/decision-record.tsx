// registry: decision-record-01 — copied 2026-09-19
"use client";

import { Check, Minus } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Descriptions,
  DescriptionsItem,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { COPILOT_NAME, decisionRecord } from "../agent-ops-parts/data/atlas-ops";
import { formatClock, formatCount, formatDuration, formatMoney } from "../agent-ops-parts/format";
import { SourceChip } from "../agent-ops-parts/provenance";

export interface DecisionRecordProps {
  record?: typeof decisionRecord;
  /** Fires when the reader approves every proposed step, or dismisses the proposal. */
  onDecide?: (choice: "approve" | "dismiss") => void;
  copilotName?: string;
  locale?: string;
  className?: string;
}

/**
 * A decision record — every AI action expanded into the reason it happened.
 * The primary interface object of an audit trail, not an export you request:
 * append-only, timestamped to the millisecond, and answering five questions
 * in this order:
 *
 * - **What it did** — the action, in one sentence, plain language;
 * - **What it looked at** — every source, named and openable;
 * - **What rule applied** — the named policy clause (monospace), not a paraphrase;
 * - **How confident** — and where the system declined to state a confidence,
 *   it says so rather than inventing one;
 * - **How to reverse it** — written before you need it, not after.
 *
 * Below the record: the check list (confirmed / not confirmed, glyph + word)
 * and what the copilot PROPOSES — numbered, editable before it runs, nothing
 * actioned until a person approves.
 */
export function DecisionRecord({
  record = decisionRecord,
  onDecide,
  copilotName = COPILOT_NAME,
  locale = "en-US",
  className,
}: DecisionRecordProps) {
  const confirmed = record.checks.filter((c) => c.confirmed).length;

  return (
    <Card className={cn("@container", className)} data-slot="decision-record">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-subtitle text-foreground">Decision record</h3>
            <span className="font-mono text-code text-muted-foreground">{record.id}</span>
          </div>
          <p className="font-mono text-code tabular-nums text-muted-foreground">
            {formatClock(record.at, locale, true)}
            <span aria-hidden="true">
              .{String(record.at.getUTCMilliseconds()).padStart(3, "0")}
            </span>{" "}
            · entry {formatCount(record.entry, locale)} ·{" "}
            {formatDuration(record.durationMs, locale)}
          </p>
        </div>

        <Alert className="mb-4" variant="destructive">
          <AlertTitle as="h4">{record.verdict}</AlertTitle>
          <AlertDescription>{record.verdictDetail}</AlertDescription>
        </Alert>

        <Descriptions className="gap-y-3" labelWidth="1/5" data-slot="decision-record-fields">
          <DescriptionsItem label="What it did">
            <p className="text-body">{record.whatItDid}</p>
          </DescriptionsItem>
          <DescriptionsItem label="What it looked at">
            <div className="flex flex-wrap gap-2">
              {record.whatItLookedAt.map((e) => (
                <SourceChip evidence={e} key={`${e.kind}-${e.label}`} />
              ))}
            </div>
            <p className="mt-1.5 text-caption text-muted-foreground">{record.lookedAtDetail}</p>
          </DescriptionsItem>
          <DescriptionsItem label="What rule applied">
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-code text-foreground">
              {record.rule}
            </code>
            <p className="mt-1.5 text-caption text-muted-foreground">{record.ruleDetail}</p>
          </DescriptionsItem>
          <DescriptionsItem label="How confident">
            <p className="text-body">
              {record.confidence === null
                ? "Not applicable"
                : `${formatCount(Math.round(record.confidence * 100), locale)}%`}
            </p>
            <p className="mt-1.5 text-caption text-muted-foreground">{record.confidenceDetail}</p>
          </DescriptionsItem>
          <DescriptionsItem label="How to reverse it">
            <p className="text-body">{record.howToReverse}</p>
          </DescriptionsItem>
        </Descriptions>

        <div className="mt-5 grid grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
          <section data-slot="decision-record-checks">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h4 className="text-meta uppercase tracking-wide text-muted-foreground">
                What {copilotName} checked
              </h4>
              <span className="text-caption tabular-nums text-muted-foreground">
                {confirmed} of {record.checks.length} confirmed
              </span>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {record.checks.map((c) => (
                <li className="flex items-start justify-between gap-4 px-3 py-2.5" key={c.id}>
                  <div className="min-w-0">
                    <p className="text-body text-foreground">{c.label}</p>
                    <p className="text-caption text-muted-foreground">{c.detail}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 text-caption",
                      c.confirmed ? "text-success-text" : "text-muted-foreground",
                    )}
                  >
                    {c.confirmed ? (
                      <Check aria-hidden="true" className="size-3.5" />
                    ) : (
                      <Minus aria-hidden="true" className="size-3.5" />
                    )}
                    {c.confirmed ? "Confirmed" : "Not confirmed"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg bg-surface-muted p-4" data-slot="decision-record-proposal">
            <h4 className="mb-2 text-meta uppercase tracking-wide text-muted-foreground">
              {copilotName} proposes
            </h4>
            <ol className="space-y-2">
              {record.proposes.map((step, i) => (
                <li className="flex gap-2.5 text-body text-foreground" key={step}>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-info/10 text-meta tabular-nums text-info-text"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-caption text-muted-foreground">
              Every step is editable before it runs. Nothing has been actioned — this decision is
              held pending your approval.{" "}
              {formatMoney(Math.abs(record.amount), record.currency, locale, 2)} is not moving.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => onDecide?.("dismiss")} variant="outline">
                Dismiss
              </Button>
              <Button onClick={() => onDecide?.("approve")}>
                Approve all {formatCount(record.proposes.length, locale)}
              </Button>
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
