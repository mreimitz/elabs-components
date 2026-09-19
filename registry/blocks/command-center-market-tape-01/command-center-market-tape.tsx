"use client";

import {
  Bar,
  BarChart,
  BarXAxis,
  Candlestick,
  CandlestickChart,
  ChartCard,
  ChartTooltip,
  Grid,
  Sparkline,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { marketCandles, marketLanes, type MarketCandle, type MarketLane } from "./data/market";

export interface CommandCenterMarketTapeProps {
  candles?: MarketCandle[];
  lanes?: MarketLane[];
  locale?: string;
  className?: string;
}

/**
 * A rate desk: the tape of lanes across the top (price, move, 20-day line), the index as
 * candles under it, and the volume that traded each day. Every move is an arrow and a sign
 * as well as a colour.
 */
export function CommandCenterMarketTape({
  candles = marketCandles,
  lanes = marketLanes,
  locale = "en-US",
  className,
}: CommandCenterMarketTapeProps) {
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const signed = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "always",
  });
  const first = candles[0];
  const last = candles.at(-1);
  const move = first && last ? (last.close - first.open) / first.open : 0;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));
  const volume = candles.map((c) => ({
    day: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(c.date),
    volume: c.volume,
  }));

  return (
    <section
      aria-label="Freight rate desk"
      className={cn("@container flex flex-col gap-4", className)}
      data-slot="command-center-market-tape"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Acme Container Index · 40 trading days
          </p>
          <h2 className="flex flex-wrap items-baseline gap-x-3 text-display font-semibold tabular-nums">
            {last ? money.format(last.close) : "—"}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-subtitle font-medium",
                move >= 0 ? "text-success-text" : "text-destructive-text",
              )}
            >
              {move >= 0 ? (
                <ArrowUpRight aria-hidden="true" className="size-5" />
              ) : (
                <ArrowDownRight aria-hidden="true" className="size-5" />
              )}
              {signed.format(move)}
            </span>
          </h2>
        </div>
        <dl className="flex gap-6 text-meta tabular-nums">
          <div className="flex flex-col">
            <dt className="text-muted-foreground">Period high</dt>
            <dd className="text-body font-medium">{money.format(high)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground">Period low</dt>
            <dd className="text-body font-medium">{money.format(low)}</dd>
          </div>
        </dl>
      </header>

      <ul className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @5xl:grid-cols-6">
        {lanes.map((lane) => {
          const open = lane.closes[0] ?? 0;
          const close = lane.closes.at(-1) ?? 0;
          const change = open ? (close - open) / open : 0;
          return (
            <li
              className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 text-card-foreground"
              key={lane.symbol}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-code font-medium">{lane.symbol}</span>
                <Badge variant={change >= 0 ? "success" : "destructive"}>
                  {signed.format(change)}
                </Badge>
              </span>
              <span className="text-subtitle font-semibold tabular-nums">
                {money.format(close)}
              </span>
              <Sparkline
                className="w-full"
                fit="fill"
                fitDomain
                height={32}
                label={`${lane.name}, last 20 closes`}
                values={lane.closes}
                variant="line"
              />
              <span className="truncate text-caption text-muted-foreground">{lane.name}</span>
            </li>
          );
        })}
      </ul>

      <ChartCard
        description="One candle per trading day: the body runs from open to close, the wick from low to high."
        height={340}
        title={`The index moved ${signed.format(move)} over the period, inside a ${money.format(high - low)} range`}
      >
        <CandlestickChart
          accessibleLabel="Acme Container Index, daily open, high, low and close"
          data={candles}
          plotHeight={300}
        >
          <Grid horizontal />
          <Candlestick />
          <XAxis />
          <YAxis />
          <ChartTooltip />
        </CandlestickChart>
      </ChartCard>

      <ChartCard
        description="Contracts traded per day, in thousands."
        height={190}
        title="Volume follows the big moves"
      >
        <BarChart
          accessibleLabel="Contracts traded per day"
          data={volume}
          plotHeight={150}
          xDataKey="day"
        >
          <Grid horizontal />
          <Bar dataKey="volume" fill="var(--chart-3)" />
          <BarXAxis />
          <ChartTooltip />
        </BarChart>
      </ChartCard>
    </section>
  );
}
