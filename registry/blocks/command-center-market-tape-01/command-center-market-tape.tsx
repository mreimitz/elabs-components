"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  BarXAxis,
  Candlestick,
  CandlestickChart,
  type ChartAnalytic,
  ChartCard,
  ChartTooltip,
  Grid,
  type NavigatorTimeWindow,
  type NavigatorWindow,
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

/** How many trading days the candlestick window opens on. */
const DEFAULT_WINDOW_DAYS = 60;

/** The candlestick chart's analytics: the 20-day and 50-day (EMA) moving averages. */
const CANDLE_ANALYTICS: ChartAnalytic[] = [
  { kind: "window", k: 20, label: "20-day average", id: "sma20" },
  { kind: "window", k: 50, reduce: "ewm", label: "EMA 50", id: "ema50" },
];

/** The volume chart's analytic: the average of whatever days are on screen. */
const VOLUME_ANALYTICS: ChartAnalytic[] = [
  { kind: "line", value: "mean", label: "computation", id: "volume-mean" },
];

/** The last `count` trading days of `candles` as a time window, or the whole series if shorter. */
function lastDaysWindow(candles: MarketCandle[], count: number): NavigatorTimeWindow {
  const start =
    candles[Math.max(candles.length - count, 0)]?.date ?? candles[0]?.date ?? new Date();
  const end = candles.at(-1)?.date ?? new Date();
  return { kind: "time", start, end };
}

/**
 * A rate desk: the tape of lanes across the top (price, move, 20-day line), the index as
 * candles under it with its 20-day and 50-day (EMA) moving averages, and the volume that
 * traded each day, filtered to the same window. Drag the strip below the candles to change
 * the window both charts read; every move is an arrow and a sign as well as a colour.
 */
export function CommandCenterMarketTape({
  candles = marketCandles,
  lanes = marketLanes,
  locale = "en-US",
  className,
}: CommandCenterMarketTapeProps) {
  const [navWindow, setWindow] = useState<NavigatorTimeWindow>(() =>
    lastDaysWindow(candles, DEFAULT_WINDOW_DAYS),
  );

  const onWindowChange = useCallback((next: NavigatorWindow | null) => {
    if (!next || next.kind !== "time") return;
    setWindow(next);
  }, []);

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

  const windowed = useMemo(() => {
    const start = navWindow.start.getTime();
    const end = navWindow.end.getTime();
    return candles.filter((c) => {
      const t = c.date.getTime();
      return t >= start && t <= end;
    });
  }, [candles, navWindow.end, navWindow.start]);

  const first = windowed[0];
  const last = windowed.at(-1) ?? candles.at(-1);
  const move = first && last ? (last.close - first.open) / first.open : 0;
  const high = windowed.length > 0 ? Math.max(...windowed.map((c) => c.high)) : 0;
  const low = windowed.length > 0 ? Math.min(...windowed.map((c) => c.low)) : 0;

  const volume = useMemo(
    () =>
      windowed.map((c) => ({
        date: c.date,
        day: new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(c.date),
        volume: c.volume,
      })),
    [locale, windowed],
  );

  return (
    <section
      aria-label="Freight rate desk"
      className={cn("@container flex flex-col gap-4", className)}
      data-slot="command-center-market-tape"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Acme Container Index · {candles.length} trading days
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
            <dt className="text-muted-foreground">Window high</dt>
            <dd className="text-body font-medium">{money.format(high)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground">Window low</dt>
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
        description="One candle per trading day: the body runs from open to close, the wick from low to high, with its 20-day average and 50-day EMA. Drag the strip below the candles — or the handles at its ends — to change the window."
        height={340}
        title={`The index moved ${signed.format(move)} over the window, inside a ${money.format(high - low)} range`}
      >
        <CandlestickChart
          accessibleLabel="Acme Container Index, daily open, high, low and close, with its 20-day average and 50-day EMA"
          align="end"
          analytics={CANDLE_ANALYTICS}
          data={candles}
          onWindowChange={onWindowChange}
          plotHeight={300}
          scrollbar="miniChart"
          window={navWindow}
        >
          <Grid horizontal />
          <Candlestick />
          <XAxis />
          <YAxis />
          <ChartTooltip />
        </CandlestickChart>
      </ChartCard>

      <ChartCard
        description="Contracts traded per day, in thousands, for the window above, with its average."
        height={190}
        title="Volume follows the big moves"
      >
        <BarChart
          accessibleLabel="Contracts traded per day, with the average over the window"
          analytics={VOLUME_ANALYTICS}
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
