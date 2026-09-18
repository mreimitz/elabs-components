"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  Meter,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  COPILOT_NAME,
  duplicateVerdict,
  type ToolSide,
} from "@/components/agent-ops-parts/data/atlas-ops";
import { formatCount, formatMoney, formatShare } from "@/components/agent-ops-parts/format";

export interface VerdictSideBySideProps {
  verdict?: typeof duplicateVerdict;
  /** Fires with the side whose primary action ("Keep" / "Cancel") was chosen. */
  onDecide?: (side: ToolSide) => void;
  copilotName?: string;
  currency?: string;
  locale?: string;
  className?: string;
}

/**
 * A keep-vs-cancel verdict laid out side by side: two cards on the two
 * status washes (success = keep, destructive = cancel), each with the annual
 * cost, a segmented utilisation meter (one cell per licensed seat, the active
 * ones filled) and the three facts that decide it; a one-line reading of the
 * comparison under them; "If you cancel" as four consequence stats; and "How
 * the copilot knows" as a numbered evidence list. The refusal at the end is
 * the pattern’s signature: a contract is never cancelled by the copilot —
 * it prepares everything and a person signs.
 */
export function VerdictSideBySide({
  verdict = duplicateVerdict,
  onDecide,
  copilotName = COPILOT_NAME,
  currency = "USD",
  locale = "en-US",
  className,
}: VerdictSideBySideProps) {
  const [keep, cancel] = verdict.sides;
  const ratio = keep.costPerYear > 0 ? cancel.costPerYear / keep.costPerYear : 0;
  const cancelShare =
    keep.throughput > 0 ? cancel.throughput / (keep.throughput + cancel.throughput) : 0;

  return (
    <div className={cn("@container", className)} data-slot="verdict-side-by-side">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-title text-foreground">{verdict.headline}</h3>
          <p className="mt-1 text-body text-muted-foreground">{verdict.lede}</p>
        </div>
        <p className="shrink-0 text-end">
          <span className="block text-kpi-sm tabular-nums text-success-text">
            {formatMoney(cancel.costPerYear, currency, locale)}
          </span>
          <span className="text-caption text-muted-foreground">recoverable per year</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="p-5">
              <h4 className="mb-3 text-subtitle text-foreground">Side by side</h4>
              <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
                {verdict.sides.map((side) => (
                  <SideCard
                    currency={currency}
                    key={side.name}
                    locale={locale}
                    onDecide={onDecide}
                    side={side}
                  />
                ))}
              </div>
              <p className="mt-4 text-body text-muted-foreground">
                {cancel.name} costs{" "}
                <span className="tabular-nums text-foreground">
                  {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(ratio)}×
                </span>{" "}
                more and accounts for{" "}
                <span className="tabular-nums text-foreground">
                  {formatShare(cancelShare, locale)}
                </span>{" "}
                of the {cancel.throughputUnit}. The{" "}
                {formatCount(cancel.licensed - cancel.activeIn30Days, locale)} people who hold both
                licences have not opened {cancel.name} in 90 days.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h4 className="mb-3 text-subtitle text-foreground">How {copilotName} knows</h4>
              <ol className="divide-y divide-border rounded-lg border border-border">
                {verdict.howItKnows.map((e, i) => (
                  <li className="flex gap-3 px-3 py-2.5" key={e.label}>
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-meta tabular-nums text-muted-foreground"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-body text-foreground">{e.label}</p>
                      <p className="text-caption text-muted-foreground">{e.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="p-5">
              <h4 className="mb-3 text-subtitle text-foreground">If you cancel {cancel.name}</h4>
              <dl className="divide-y divide-border">
                {verdict.consequence.map((c) => (
                  <div className="py-3 first:pt-0 last:pb-0" key={c.label}>
                    <dt className="text-eyebrow uppercase text-muted-foreground">{c.label}</dt>
                    <dd>
                      <p
                        className={cn(
                          "text-kpi-sm tabular-nums",
                          c.unit === "currency" ? "text-success-text" : "text-foreground",
                        )}
                      >
                        {c.unit === "currency"
                          ? formatMoney(c.value, currency, locale)
                          : c.unit === "days"
                            ? `${formatCount(c.value, locale)} days`
                            : c.unit === "date"
                              ? new Intl.DateTimeFormat(locale, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  timeZone: "UTC",
                                }).format(new Date(c.value))
                              : formatCount(c.value, locale)}
                      </p>
                      <p className="text-caption text-muted-foreground">{c.note}</p>
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Alert variant="warning">
            <AlertTitle as="h4">{copilotName} will not do this for you</AlertTitle>
            <AlertDescription>{verdict.refusal}</AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}

function SideCard({
  side,
  currency,
  locale,
  onDecide,
}: {
  side: ToolSide;
  currency: string;
  locale: string;
  onDecide?: (side: ToolSide) => void;
}) {
  const keep = side.verdict === "keep";
  return (
    <div
      className={cn("rounded-lg p-4", keep ? "bg-success/10" : "bg-destructive/10")}
      data-slot="verdict-side-by-side-side"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-subtitle text-foreground">{side.name}</p>
        <Button
          onClick={() => onDecide?.(side)}
          size="sm"
          variant={keep ? "outline" : "destructive"}
        >
          {keep ? "Keep" : "Cancel"}
          <span className="sr-only"> {side.name}</span>
        </Button>
      </div>
      <p className="text-kpi-sm tabular-nums text-foreground">
        {formatMoney(side.costPerYear, currency, locale)}
        <span className="text-caption text-muted-foreground"> / year</span>
      </p>
      {/* One cell per licensed seat, the active ones filled — the unit is the seat. */}
      <Meter
        aria-label={`${side.name} seats active in 30 days`}
        aria-valuetext={`${formatCount(side.activeIn30Days, locale)} of ${formatCount(side.licensed, locale)} licensed seats active in 30 days`}
        className="my-3"
        max={side.licensed}
        segments={side.licensed}
        size="xs"
        value={side.activeIn30Days}
        variant={keep ? "success" : "destructive"}
      />
      <ul className="space-y-1 text-caption text-foreground">
        <li className="tabular-nums">{formatCount(side.licensed, locale)} licensed</li>
        <li className="tabular-nums">
          {formatCount(side.activeIn30Days, locale)} active in 30 days
        </li>
        <li className="tabular-nums">
          {formatCount(side.throughput, locale)} {side.throughputUnit}
        </li>
      </ul>
    </div>
  );
}
