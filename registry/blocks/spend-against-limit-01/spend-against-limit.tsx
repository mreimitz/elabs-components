"use client";

import { Button, Card, CardContent, STATUS_TONE_ICONS, StatusBadge } from "@elabs-ai/components-ui";
import type { StatusTone } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  NOW,
  agentEnvelopes,
  type AgentEnvelope,
  type Autonomy,
} from "@/components/agent-ops-parts/data/atlas-ops";
import {
  formatCount,
  formatMoney,
  formatRelative,
  formatShare,
} from "@/components/agent-ops-parts/format";

const AUTONOMY_TONE: Record<Autonomy, StatusTone> = {
  auto: "neutral",
  review: "warning",
  hold: "destructive",
};

const AUTONOMY_LABEL: Record<Autonomy, string> = {
  auto: "Auto",
  review: "Review",
  hold: "Hold",
};

/** Where the ceiling mark sits on the track — leaves room to SHOW an over-limit bar. */
const CEILING_AT = 0.8;

export interface SpendAgainstLimitProps {
  /** Defaults to the shared Atlas dataset. Rows are sorted by share of ceiling, highest first. */
  agents?: AgentEnvelope[];
  /** Snapshot moment "last action" times are relative to. */
  now?: Date;
  /** Show the three autonomy-band tiles above the list. Default true. */
  showBands?: boolean;
  onRevoke?: (agent: AgentEnvelope) => void;
  currency?: string;
  locale?: string;
  className?: string;
}

/**
 * "Spend against limit" — every non-human spender on the card programme,
 * sorted by how close each is to its ceiling. Per row: the agent (monospace
 * id, purpose · operator), its autonomy band as a status badge (glyph + word,
 * never a dot alone), a bar whose length is spend as a SHARE of that agent’s
 * own ceiling with the ceiling drawn as a vertical mark, and the literal
 * "$612 of $500". An agent over its ceiling paints the destructive rung and
 * says so in text.
 *
 * Above the list, three autonomy-band tiles (Auto / Review / Hold) total the
 * envelopes per band, so the reader sees the shape of the programme before
 * the rows. Autonomy is a spend envelope, not a permission level.
 */
export function SpendAgainstLimit({
  agents = agentEnvelopes,
  now = NOW,
  showBands = true,
  onRevoke,
  currency = "USD",
  locale = "en-US",
  className,
}: SpendAgainstLimitProps) {
  const sorted = [...agents].sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  const totalSpent = agents.reduce((s, a) => s + a.spent, 0);
  const totalLimit = agents.reduce((s, a) => s + a.limit, 0);

  return (
    <div className={cn("@container space-y-4", className)} data-slot="spend-against-limit">
      {showBands ? <AutonomyBands agents={agents} currency={currency} locale={locale} /> : null}

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-subtitle text-foreground">Spend against limit</h3>
              <p className="text-caption text-muted-foreground">
                Card spend this month, sorted by how close each agent is to its ceiling
              </p>
            </div>
            <p className="text-caption tabular-nums text-muted-foreground">
              mark = the agent’s ceiling · {formatMoney(totalSpent, currency, locale)} of{" "}
              {formatMoney(totalLimit, currency, locale)} authorised
            </p>
          </div>

          <ol className="space-y-3.5" data-slot="spend-against-limit-list">
            {sorted.map((a) => (
              <AgentRow
                agent={a}
                currency={currency}
                key={a.id}
                locale={locale}
                now={now}
                onRevoke={onRevoke}
              />
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentRow({
  agent,
  now,
  currency,
  locale,
  onRevoke,
}: {
  agent: AgentEnvelope;
  now: Date;
  currency: string;
  locale: string;
  onRevoke?: (agent: AgentEnvelope) => void;
}) {
  const share = agent.spent / agent.limit;
  const over = share > 1;
  const tone = AUTONOMY_TONE[agent.autonomy];
  // Track: the ceiling sits at CEILING_AT; the bar is share × CEILING_AT,
  // clamped to the track so a runaway agent cannot paint outside the card.
  const fill = Math.min(1, share * CEILING_AT);

  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @2xl:grid-cols-[minmax(10rem,14rem)_5.5rem_minmax(0,1fr)_9rem_auto]"
      data-slot="spend-against-limit-row"
    >
      <div className="min-w-0">
        <p className="truncate font-mono text-code text-foreground">{agent.name}</p>
        <p className="truncate text-caption text-muted-foreground">
          {agent.purpose} · {agent.operator.name}
        </p>
      </div>

      <StatusBadge
        className="justify-self-end @2xl:justify-self-start"
        status={{ label: AUTONOMY_LABEL[agent.autonomy], tone, icon: STATUS_TONE_ICONS[tone] }}
      />

      <div
        aria-label={`${formatMoney(agent.spent, currency, locale)} of ${formatMoney(agent.limit, currency, locale)}, ${formatShare(share, locale, 0)} of ceiling${over ? ", over limit" : ""}`}
        className="relative col-span-2 h-2 rounded-full bg-muted @2xl:col-span-1"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={agent.limit}
        aria-valuenow={agent.spent}
      >
        <span
          className={cn(
            "absolute inset-y-0 start-0 rounded-full",
            over ? "bg-destructive" : "bg-foreground",
          )}
          data-slot="spend-against-limit-fill"
          style={{ width: `${fill * 100}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          data-slot="spend-against-limit-ceiling"
          style={{ insetInlineStart: `${CEILING_AT * 100}%` }}
        />
      </div>

      <p
        className={cn(
          "col-span-2 whitespace-nowrap text-caption tabular-nums @2xl:col-span-1 @2xl:text-end",
          over ? "text-destructive-text" : "text-muted-foreground",
        )}
      >
        <span className={cn("text-body", over ? "text-destructive-text" : "text-foreground")}>
          {formatMoney(agent.spent, currency, locale)}
        </span>{" "}
        of {formatMoney(agent.limit, currency, locale)}
      </p>

      <div className="col-span-2 flex items-center justify-between gap-3 @2xl:col-span-1 @2xl:justify-end">
        <p className="min-w-0 text-caption text-muted-foreground @2xl:hidden">
          <span className={cn(over && "text-destructive-text")}>{agent.lastAction}</span> ·{" "}
          {formatRelative(agent.lastActionAt, now, locale)}
        </p>
        <Button onClick={() => onRevoke?.(agent)} size="sm" variant="outline">
          Revoke
          <span className="sr-only"> {agent.name}</span>
        </Button>
      </div>
    </li>
  );
}

function AutonomyBands({
  agents,
  currency,
  locale,
}: {
  agents: AgentEnvelope[];
  currency: string;
  locale: string;
}) {
  const bands = (["auto", "review", "hold"] as const).map((band) => {
    const members = agents.filter((a) => a.autonomy === band);
    return {
      band,
      count: members.length,
      spent: members.reduce((s, a) => s + a.spent, 0),
      limit: members.reduce((s, a) => s + a.limit, 0),
    };
  });
  const note: Record<Autonomy, (n: number) => string> = {
    auto: (n) =>
      `${formatCount(n, locale)} ${n === 1 ? "agent" : "agents"} · clears without a human`,
    review: (n) => `${formatCount(n, locale)} ${n === 1 ? "agent" : "agents"} · a human signs off`,
    hold: (n) => `${formatCount(n, locale)} ${n === 1 ? "agent" : "agents"} · nothing moves`,
  };

  return (
    <Card data-slot="spend-against-limit-bands">
      <CardContent className="p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-subtitle text-foreground">Autonomy bands</h3>
            <p className="text-caption text-muted-foreground">
              What each band is authorised to spend and what it has used
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
          {bands.map(({ band, count, spent, limit }) => {
            const over = limit > 0 && spent > limit;
            const tone = AUTONOMY_TONE[band];
            const BandIcon = STATUS_TONE_ICONS[tone];
            return (
              <div
                className="rounded-lg bg-surface-muted p-4"
                data-slot="spend-against-limit-band"
                key={band}
              >
                <dt className="mb-2 flex items-center gap-1.5 text-meta uppercase tracking-wide text-muted-foreground">
                  {BandIcon ? (
                    <BandIcon
                      aria-hidden="true"
                      className={cn(
                        "size-3.5",
                        tone === "warning" && "text-warning",
                        tone === "destructive" && "text-destructive",
                      )}
                    />
                  ) : null}
                  {AUTONOMY_LABEL[band]}
                </dt>
                <dd>
                  <p className="text-subtitle tabular-nums">
                    <span className={over ? "text-destructive-text" : "text-foreground"}>
                      {formatMoney(spent, currency, locale)}
                    </span>{" "}
                    <span className="text-caption text-muted-foreground">
                      of {formatMoney(limit, currency, locale)}
                    </span>
                  </p>
                  <div
                    aria-hidden="true"
                    className="my-2 h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        over ? "bg-destructive" : "bg-foreground",
                      )}
                      style={{ width: `${Math.min(1, limit > 0 ? spent / limit : 0) * 100}%` }}
                    />
                  </div>
                  <p className="text-caption text-muted-foreground">{note[band](count)}</p>
                </dd>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
