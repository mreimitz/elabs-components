// registry: energy-desk-01 — copied 2026-09-23
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  type ChartAnalytic,
  type ChartSelectionIntent,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  MetricCard,
  MetricGrid,
  type NavigatorWindow,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  ENERGY_AS_OF,
  ENERGY_SOURCE,
  type HourlyReading,
  hourlyReadings as defaultReadings,
} from "./data/energy-desk";

export interface EnergyDeskProps {
  /** Hourly readings, oldest first — consumption and the spot price of the same hour. */
  readings?: HourlyReading[];
  /** The window both charts open on. Default: the last seven days. */
  defaultSpan?: PresetSpan;
  locale?: string;
  className?: string;
}

/** The window presets, in hours; `"all"` is the whole series. */
export type PresetSpan = "24h" | "7d" | "30d" | "all";

const HOUR = 3_600_000;
const PRESETS: ReadonlyArray<{ value: PresetSpan; label: string; hours: number | null }> = [
  { value: "24h", label: "24 h", hours: 24 },
  { value: "7d", label: "7 days", hours: 7 * 24 },
  { value: "30d", label: "30 days", hours: 30 * 24 },
  { value: "all", label: "All", hours: null },
];

/** A closed hour range, ms — the window, or the period the desk picked inside it. */
type Span = { start: number; end: number };

/** The consumption chart's analytics: the day's running average and the corridor around it. */
const CONSUMPTION_ANALYTICS: ChartAnalytic[] = [
  { kind: "window", k: 24, reduce: "mean", label: "24-hour average", id: "daily-mean" },
  { kind: "band", spread: { stddev: 1 }, label: "computation", id: "corridor" },
];

const asTime = (value: unknown): number =>
  value instanceof Date ? value.getTime() : Number(value);

/**
 * Two hourly series on ONE window: the price chart owns the navigator strip and the
 * consumption chart follows it through `xDomain`; presets jump the window; a range on the
 * consumption chart's time axis picks a period, and the KPIs price it — consumption × spot
 * price, hour by hour.
 */
export function EnergyDesk({
  readings = defaultReadings,
  defaultSpan = "7d",
  locale = "en-US",
  className,
}: EnergyDeskProps) {
  const first = readings[0]?.hour.getTime() ?? 0;
  const last = readings[readings.length - 1]?.hour.getTime() ?? 0;

  const spanOf = useCallback(
    (preset: PresetSpan): Span => {
      const hours = PRESETS.find((p) => p.value === preset)?.hours ?? null;
      return hours === null
        ? { start: first, end: last }
        : { start: last - (hours - 1) * HOUR, end: last };
    },
    [first, last],
  );

  const [window, setWindow] = useState<Span>(() => spanOf(defaultSpan));
  const [period, setPeriod] = useState<Span | null>(null);

  const preset = PRESETS.find((p) => {
    const span = spanOf(p.value);
    return span.start === window.start && span.end === window.end;
  })?.value;

  const navigatorWindow = useMemo<NavigatorWindow>(
    () => ({ kind: "time", start: new Date(window.start), end: new Date(window.end) }),
    [window.end, window.start],
  );
  const xDomain = useMemo<[Date, Date]>(
    () => [new Date(window.start), new Date(window.end)],
    [window.end, window.start],
  );
  const rowsInWindow = useMemo(
    () =>
      readings.reduce((n, row) => {
        const t = row.hour.getTime();
        return t >= window.start && t <= window.end ? n + 1 : n;
      }, 0),
    [readings, window.end, window.start],
  );

  const onWindowChange = useCallback((next: NavigatorWindow | null) => {
    if (!next || next.kind !== "time") return;
    setWindow({ start: next.start.getTime(), end: next.end.getTime() });
  }, []);

  const onPeriod = useCallback((intent: ChartSelectionIntent) => {
    if (intent.gesture.kind !== "range" || intent.gesture.axis !== "x") return;
    const a = asTime(intent.gesture.from);
    const b = asTime(intent.gesture.to);
    setPeriod({ start: Math.min(a, b), end: Math.max(a, b) });
  }, []);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const number = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );
  const when = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }),
    [locale],
  );

  // The KPIs price the period when there is one, else the window on screen.
  const scope = period ?? window;
  const facts = useMemo(() => {
    let cost = 0;
    let energy = 0;
    let hours = 0;
    let peak: HourlyReading | null = null;
    let priceSum = 0;
    for (const row of readings) {
      const t = row.hour.getTime();
      if (t < scope.start || t > scope.end) continue;
      hours += 1;
      energy += row.consumption;
      cost += row.consumption * row.price;
      priceSum += row.price;
      if (!peak || row.consumption > peak.consumption) peak = row;
    }
    return {
      hours,
      cost,
      energy,
      averagePrice: hours > 0 ? priceSum / hours : 0,
      effectivePrice: energy > 0 ? cost / energy : 0,
      peak,
    };
  }, [readings, scope.end, scope.start]);

  const scopeLabel = `${when.format(new Date(scope.start))} – ${when.format(new Date(scope.end))}`;

  return (
    <section
      aria-label="Energy desk"
      className={cn("@container flex flex-col gap-4", className)}
      data-slot="energy-desk"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            Energy desk · {readings.length.toLocaleString(locale)} hourly readings
          </p>
          <h2 className="text-title font-semibold text-balance">
            The site pays {money.format(facts.effectivePrice)} per MWh over{" "}
            {period ? "the picked period" : "the window on screen"} — the evening ramp is where the
            money goes
          </h2>
        </div>
        <span className="text-meta text-muted-foreground tabular-nums">
          As of {ENERGY_AS_OF} · {ENERGY_SOURCE}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          aria-label="Window"
          onValueChange={(value) => {
            if (value) setWindow(spanOf(value as PresetSpan));
          }}
          type="single"
          value={preset ?? ""}
          variant="outline"
        >
          {PRESETS.map((p) => (
            <ToggleGroupItem key={p.value} value={p.value}>
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="text-meta text-muted-foreground tabular-nums" data-testid="scope">
          {period ? "Period" : "Showing"} {scopeLabel} · {facts.hours} h
        </span>
        {period ? (
          <Button onClick={() => setPeriod(null)} size="sm" variant="outline">
            Clear period
          </Button>
        ) : null}
      </div>

      <MetricGrid columns={4}>
        <MetricCard
          data-testid="kpi-cost"
          description={
            period
              ? "Consumption × spot price, the picked hours"
              : "Consumption × spot price, the window on screen"
          }
          label="Energy cost"
          value={money.format(facts.cost)}
        />
        <MetricCard
          description={`${facts.hours} hours`}
          label="Consumption"
          value={`${number.format(facts.energy)} MWh`}
        />
        <MetricCard
          description={`Simple average ${money.format(facts.averagePrice)} — the site buys in the dear hours`}
          label="Effective price"
          value={`${money.format(facts.effectivePrice)}/MWh`}
        />
        <MetricCard
          description={facts.peak ? when.format(facts.peak.hour) : "—"}
          label="Peak hour"
          value={facts.peak ? `${number.format(facts.peak.consumption)} MWh` : "—"}
        />
      </MetricGrid>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>What the site drew</CardTitle>
          <CardDescription>
            Site consumption per hour in MWh, with its 24-hour running average and a one-sigma
            corridor. Drag a range along the time axis — or press the range button and use the arrow
            keys — to price a period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AreaChart
            accessibleLabel="Site consumption per hour"
            analytics={CONSUMPTION_ANALYTICS}
            data={readings}
            legend
            onSelectionIntent={onPeriod}
            plotHeight={{ base: 240, narrow: { aspect: 1.5 } }}
            selectionGestures={["range"]}
            xDataKey="hour"
            xDomain={xDomain}
            xDomainSlotCount={rowsInWindow}
          >
            <Grid horizontal />
            <Area dataKey="consumption" name="Consumption (MWh)" stroke="var(--chart-1)" />
            <XAxis />
            <YAxis />
            <ChartTooltip />
          </AreaChart>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>What the market charged</CardTitle>
          <CardDescription>
            Day-ahead spot price per hour in $/MWh. The strip below is the whole{" "}
            {readings.length.toLocaleString(locale)}-hour series — drag its window, or the presets
            above, and both charts move together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LineChart
            accessibleLabel="Spot price per hour"
            data={readings}
            onWindowChange={onWindowChange}
            plotHeight={{ base: 200, narrow: { aspect: 1.5 } }}
            scrollbar="miniChart"
            window={navigatorWindow}
            xDataKey="hour"
          >
            <Grid horizontal />
            <Line dataKey="price" name="Spot price ($/MWh)" stroke="var(--chart-2)" />
            <XAxis />
            <YAxis />
            <ChartTooltip />
          </LineChart>
        </CardContent>
      </Card>
    </section>
  );
}
