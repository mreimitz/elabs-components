"use client";

import { Button, Card, CardContent, STATUS_TONE_ICONS, StatusBadge } from "@elabs-ai/components-ui";
import type { StatusTone } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  COPILOT_NAME,
  findings,
  findingsTotals,
  type Finding,
  type FindingKind,
} from "@/components/agent-ops-parts/data/atlas-ops";
import { formatCount, formatMoney } from "@/components/agent-ops-parts/format";

/**
 * The kind of finding decides the tone of its recoverable figure — the one
 * coloured number on the card. Mapped ONCE, here: duplicate spend is the
 * cleanest win (info), idle seats a judgement call (warning), a price rise
 * a deadline (destructive).
 */
const KIND_TONE: Record<FindingKind, StatusTone> = {
  duplicate: "info",
  "unused-seats": "warning",
  "price-rise": "destructive",
};

const KIND_TEXT: Record<FindingKind, string> = {
  duplicate: "text-info-text",
  "unused-seats": "text-warning-text",
  "price-rise": "text-destructive-text",
};

export interface FindingCardsProps {
  items?: Finding[];
  totals?: typeof findingsTotals;
  /** Fires with the finding and which of its two actions was chosen. */
  onAction?: (finding: Finding, action: "primary" | "secondary") => void;
  copilotName?: string;
  currency?: string;
  locale?: string;
  className?: string;
}

/**
 * "Atlas found" — recoverable-spend findings as a row of cards: a status
 * badge naming the kind, a one-line title, the recoverable figure as the
 * only coloured number, a two-sentence summary, and a primary + secondary
 * action. The header states the programme (42 tools · $1.4M annualised) and
 * the total the cards add up to, so the row reads as a sum, not a list.
 *
 * The primary action is what a person signs; the secondary always opens the
 * evidence. The copilot never cancels a contract on its own.
 */
export function FindingCards({
  items = findings,
  totals = findingsTotals,
  onAction,
  copilotName = COPILOT_NAME,
  currency = "USD",
  locale = "en-US",
  className,
}: FindingCardsProps) {
  return (
    <section className={cn("@container", className)} data-slot="finding-cards">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-eyebrow uppercase text-muted-foreground">{copilotName} found</h3>
        <p className="text-caption tabular-nums text-muted-foreground">
          {formatCount(totals.activeTools, locale)} active tools ·{" "}
          {formatMoney(totals.annualised, currency, locale)} annualised ·{" "}
          <span className="text-foreground">
            {formatMoney(totals.recoverable, currency, locale)} recoverable
          </span>
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
        {items.map((f) => {
          const tone = KIND_TONE[f.kind];
          return (
            <li key={f.id}>
              <Card className="h-full" data-slot="finding-cards-card">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <StatusBadge
                    className="self-start"
                    status={{ label: "Recoverable", tone, icon: STATUS_TONE_ICONS[tone] }}
                  />
                  <div className="space-y-1">
                    <h4 className="text-subtitle text-foreground">{f.title}</h4>
                    <p className={cn("text-kpi-sm tabular-nums", KIND_TEXT[f.kind])}>
                      {formatMoney(f.recoverablePerYear, currency, locale)}
                      <span className="text-caption text-muted-foreground"> / year</span>
                    </p>
                  </div>
                  <p className="text-body text-muted-foreground">{f.summary}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button onClick={() => onAction?.(f, "primary")} size="sm">
                      {f.primaryAction}
                    </Button>
                    <Button onClick={() => onAction?.(f, "secondary")} size="sm" variant="outline">
                      {f.secondaryAction}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
