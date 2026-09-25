"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleCheck,
  Minus,
} from "lucide-react";
import {
  Sparkline,
  TreeChart,
  type TreeChartNodeRenderProps,
  type TreeDatapointDatum,
} from "@elabs-ai/components-charts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  ToggleGroup,
  ToggleGroupItem,
  useControllableState,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { formatKpiDelta, formatKpiValue, type KpiUnit } from "@/components/kpi-card-parts/format";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import {
  branchIds,
  flattenKpiTree,
  KPI_TREE_AS_OF,
  KPI_TREE_CURRENCY,
  KPI_TREE_PERIOD_END,
  KPI_TREE_SOURCE,
  latestAndBaselines,
  operatingProfitTree,
  yoyContributions,
  type KpiTreeMetric,
  type KpiTreeNode,
  type KpiTreeOp,
} from "./data/kpi-tree";

export type InfographicKpiTreeOrientation = "vertical" | "horizontal";

export interface InfographicKpiTreeProps {
  /**
   * The driver tree. Defaults to operating profit, four levels deep. Every
   * node needs a unique `id`: open branches and the selected card are kept
   * by id, and start over when a tree with different ids arrives.
   */
  data?: KpiTreeNode;
  /** Which way the tree grows (controlled). Pair with `onOrientationChange`. */
  orientation?: InfographicKpiTreeOrientation;
  /** Which way the tree grows on first render (uncontrolled). Default `"vertical"`. */
  defaultOrientation?: InfographicKpiTreeOrientation;
  /** Fires when the reader switches between the vertical and horizontal layouts. */
  onOrientationChange?: (orientation: InfographicKpiTreeOrientation) => void;
  locale?: string;
  /** Currency of every money figure. Default `"USD"`. */
  currency?: string;
  className?: string;
}

/** How an `aria-disabled` outline button looks: dimmed, and no hover while there is nothing to do. */
const DISABLED_LOOK =
  "aria-disabled:opacity-50 aria-disabled:hover:bg-background aria-disabled:hover:text-foreground";

/** The card box every node draws in, px. Wide enough for a three-digit percent in both delta boxes. */
const NODE_WIDTH = 232;
const NODE_HEIGHT = 140;

const OP_SYMBOL: Record<KpiTreeOp, string> = { sum: "+", difference: "−", product: "×" };

function metricOf(node: KpiTreeNode): KpiTreeMetric {
  return node.data as KpiTreeMetric;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function monthLabel(monthsBack: number, locale: string): string {
  const date = new Date(
    Date.UTC(
      KPI_TREE_PERIOD_END.getUTCFullYear(),
      KPI_TREE_PERIOD_END.getUTCMonth() - monthsBack,
      1,
    ),
  );
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Percent change at ONE decimal, always: the two chips on a card sit side by
 * side, so "+2.0%" beside "+1.6%" reads as one scale where "+2%" would not.
 */
function formatChangePercent(actual: number, baseline: number, locale: string): string | null {
  if (baseline === 0) return null;
  const pct = ((actual - baseline) / Math.abs(baseline)) * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const digits = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(pct));
  return `${sign}${digits}%`;
}

interface Change {
  /** Signed, as the card shows it: "+4.8%", "−1.2pp". */
  text: string;
  /** In words: "up 4.8%", "down 1.2 points", "unchanged". */
  words: string;
  /**
   * Whether it is good news, in words: `"favorable"` / `"unfavorable"`, or
   * `null` when flat. Colour is never its only carrier.
   */
  verdict: "favorable" | "unfavorable" | null;
  direction: "up" | "down" | "flat";
  /** Whether the move is good news, given the metric's direction; `null` when flat. */
  good: boolean | null;
}

/** One comparison, stated with a sign and an arrow as well as a tone. */
function describeChange(
  actual: number,
  baseline: number,
  unit: KpiUnit,
  higherIsBetter: boolean,
  locale: string,
  currency: string,
): Change {
  const delta = actual - baseline;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const good = direction === "flat" ? null : higherIsBetter === delta > 0;
  // A percent-unit metric moves in percentage points, never "percent of a percent".
  const text =
    unit === "percent"
      ? formatKpiDelta(delta, unit, locale, currency)
      : (formatChangePercent(actual, baseline, locale) ??
        formatKpiDelta(delta, unit, locale, currency));
  const magnitude = text.replace(/^[+−]/, "").replace(/pp$/, " points");
  const words = direction === "flat" ? "unchanged" : `${direction} ${magnitude}`;
  const verdict = good === null ? null : good ? "favorable" : "unfavorable";
  return { text: direction === "flat" ? "0%" : text, words, verdict, direction, good };
}

/** A change and its comparison, then whether it is good news: "up 4.8% month over month, favorable". */
function sayChange(change: Change, comparison: string): string {
  return `${change.words} ${comparison}${change.verdict ? `, ${change.verdict}` : ""}`;
}

const TONE_TEXT = {
  good: "text-success-text",
  bad: "text-destructive-text",
  flat: "text-muted-foreground",
} as const;

function toneOf(change: Change): keyof typeof TONE_TEXT {
  return change.good === null ? "flat" : change.good ? "good" : "bad";
}

/** Bad news also differs by SHAPE, a dashed outline, so it survives greyscale. */
const TONE_BOX = {
  good: "border-transparent",
  bad: "border-dashed border-destructive",
  flat: "border-transparent",
} as const;

const ARROW = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

function DeltaBox({ label, change }: { label: string; change: Change }) {
  const Arrow = ARROW[change.direction];
  const tone = toneOf(change);
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center justify-between gap-1 rounded-md border bg-muted px-1.5 py-0.5",
        TONE_BOX[tone],
      )}
      data-slot="infographic-kpi-tree-delta"
      data-tone={tone}
    >
      <span className="text-meta text-muted-foreground">{label}</span>
      <span
        className={cn(
          "flex items-center gap-0.5 whitespace-nowrap text-meta font-medium tabular-nums",
          TONE_TEXT[tone],
        )}
      >
        <Arrow aria-hidden="true" className="size-3 shrink-0" />
        {change.text}
      </span>
    </div>
  );
}

interface KpiTreeCardProps {
  metric: KpiTreeMetric;
  selected: boolean;
  locale: string;
  currency: string;
  /** Growing across, the chart's open/close pill sits on the card's right edge, mid-height. */
  pillOnRight: boolean;
}

/**
 * One metric as a card: name, latest value, what it counts, the last 12
 * months as a sparkline, and the month-over-month and year-over-year moves.
 * Presentational only — the chart's own tree items carry focus and names.
 */
function KpiTreeCard({ metric, selected, locale, currency, pillOnRight }: KpiTreeCardProps) {
  const { latest, previousMonth, yearAgo } = latestAndBaselines(metric);
  const mom = describeChange(
    latest,
    previousMonth,
    metric.unit,
    metric.higherIsBetter,
    locale,
    currency,
  );
  const yoy = describeChange(latest, yearAgo, metric.unit, metric.higherIsBetter, locale, currency);
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col gap-1 rounded-xl border bg-card p-4 text-card-foreground shadow-xs",
        selected ? "border-primary inset-ring inset-ring-primary" : "border-card-border",
      )}
      data-selected={selected || undefined}
      data-slot="infographic-kpi-tree-card"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-caption font-medium text-foreground">
          {metric.name}
        </span>
        {selected ? (
          // Foreground ink: the check is the selection cue that holds 3:1 in
          // every theme (a pale brand primary does not).
          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-foreground" />
        ) : null}
      </div>
      {/* The two middle rows keep clear of the pill when the tree grows across. */}
      <div className={cn("flex min-w-0 items-end justify-between gap-2", pillOnRight && "pr-4")}>
        <span className="min-w-0 truncate text-kpi-sm font-semibold tabular-nums text-foreground">
          {formatKpiValue(latest, metric.unit, locale, currency)}
        </span>
        <Sparkline
          className="shrink-0"
          fitDomain
          height={28}
          label={`${metric.name}, last 12 months`}
          values={metric.monthly.slice(-12)}
          variant="line"
          width={72}
        />
      </div>
      <span
        className={cn("min-w-0 truncate text-meta text-muted-foreground", pillOnRight && "pr-4")}
      >
        {metric.caption}
      </span>
      <div className="mt-auto flex min-w-0 gap-1.5">
        <DeltaBox change={mom} label="MoM" />
        <DeltaBox change={yoy} label="YoY" />
      </div>
    </div>
  );
}

/**
 * "What drives the number?" — a finance driver tree on `TreeChart`'s custom
 * nodes: operating profit at the top, the metrics it is built from below,
 * each a card with its latest value, a 12-month sparkline and its
 * month-over-month and year-over-year moves. Every parent is computed from
 * its drivers, so the tree always adds up.
 *
 * The headline names the single measured driver that moved the top number
 * most year over year — worked out by splitting the top number's change
 * exactly across the leaves (`yoyContributions` in `data/kpi-tree.ts`),
 * never typed in. Branches open and close (the pill on a card, the arrow
 * keys, or the Expand all / Collapse buttons); clicking a card, or pressing
 * Enter on it, restates it in the line under the tree.
 */
export function InfographicKpiTree({
  data = operatingProfitTree,
  orientation: orientationProp,
  defaultOrientation = "vertical",
  onOrientationChange,
  locale = "en-US",
  currency = KPI_TREE_CURRENCY,
  className,
}: InfographicKpiTreeProps) {
  const [orientation, setOrientation] = useControllableState(
    orientationProp,
    defaultOrientation,
    onOrientationChange,
  );
  const rootId = data.id as string;

  const facts = useMemo(() => {
    const nodes = flattenKpiTree(data);
    const byId = new Map(nodes.map((node) => [node.id as string, node]));
    const shares = yoyContributions(data);
    const leaves = nodes.filter((node) => !node.children?.length);
    const leader = leaves
      .map((node) => ({ node, share: shares.get(node.id as string) ?? 0 }))
      .sort((a, b) => Math.abs(b.share) - Math.abs(a.share))[0];
    const allBranches = branchIds(data);
    // Three levels, sized to fit the block's box: the root and its first
    // branch open, every other branch closed with its driver count showing.
    const firstBranch = (data.children ?? []).find((child) => child.children?.length);
    const initialOpen = [rootId, ...(firstBranch ? [firstBranch.id as string] : [])];
    return {
      byId,
      shares,
      leader,
      allBranches,
      initialOpen: allBranches.filter((id) => initialOpen.includes(id)),
      signature: nodes.map((node) => node.id).join("\n"),
    };
  }, [data, rootId]);

  const [expandedIds, setExpandedIds] = useState<string[]>(facts.initialOpen);
  const [selectedId, setSelectedId] = useState<string>(rootId);
  // A tree with different ids starts over: stale open branches and a stale
  // selection would name nodes that no longer exist.
  const [seenSignature, setSeenSignature] = useState(facts.signature);
  if (seenSignature !== facts.signature) {
    setSeenSignature(facts.signature);
    setExpandedIds(facts.initialOpen);
    setSelectedId(rootId);
  }

  const root = metricOf(data);
  const rootFacts = latestAndBaselines(root);
  const rootDelta = rootFacts.latest - rootFacts.yearAgo;
  const money = (value: number, unit: KpiUnit = root.unit) =>
    formatKpiValue(value, unit, locale, currency);
  const signed = (value: number, unit: KpiUnit = root.unit) =>
    formatKpiDelta(value, unit, locale, currency);
  const latestMonth = monthLabel(0, locale);
  const previousMonthLabel = monthLabel(1, locale);
  const yearAgoMonth = monthLabel(12, locale);

  const headline =
    facts.leader && facts.leader.share !== 0 && rootDelta !== 0
      ? `${facts.leader.node.name} moved ${lowerFirst(root.name)} the most: ${signed(facts.leader.share)} year over year`
      : `${root.name} held level year over year`;
  const splitSentence = (data.children ?? [])
    .map((child) => {
      const share = facts.shares.get(child.id as string) ?? 0;
      const verb = share >= 0 ? "added" : "took away";
      return `${lowerFirst(child.name)} ${verb} ${money(Math.abs(share))}`;
    })
    .join(", ");
  const endpoints = `${root.name} ${money(rootFacts.yearAgo)} in ${yearAgoMonth} → ${money(rootFacts.latest)} in ${latestMonth}, ${signed(rootDelta)}`;

  const labelFor = (datum: TreeDatapointDatum<KpiTreeMetric>): string => {
    const metric = datum.data;
    if (!metric) return "";
    const { latest, previousMonth, yearAgo } = latestAndBaselines(metric);
    const mom = describeChange(
      latest,
      previousMonth,
      metric.unit,
      metric.higherIsBetter,
      locale,
      currency,
    );
    const yoy = describeChange(
      latest,
      yearAgo,
      metric.unit,
      metric.higherIsBetter,
      locale,
      currency,
    );
    const drivers = metric.driverNames.length;
    return [
      metric.name,
      formatKpiValue(latest, metric.unit, locale, currency),
      sayChange(mom, "month over month"),
      sayChange(yoy, "year over year"),
      ...(drivers > 0 ? [`${drivers} ${drivers === 1 ? "driver" : "drivers"}`] : []),
      ...(metric.id === selectedId ? ["selected"] : []),
    ].join(", ");
  };

  const selectedNode = facts.byId.get(selectedId) ?? data;
  const selected = metricOf(selectedNode);
  const selectedFacts = latestAndBaselines(selected);
  const selectedMom = describeChange(
    selectedFacts.latest,
    selectedFacts.previousMonth,
    selected.unit,
    selected.higherIsBetter,
    locale,
    currency,
  );
  const selectedYoy = describeChange(
    selectedFacts.latest,
    selectedFacts.yearAgo,
    selected.unit,
    selected.higherIsBetter,
    locale,
    currency,
  );
  const formula = selected.op
    ? selected.driverNames.join(` ${OP_SYMBOL[selected.op]} `)
    : "measured directly";
  const selectedShare = facts.shares.get(selected.id) ?? 0;
  const shareSentence =
    selected.id === rootId
      ? `${signed(rootDelta)} year over year: ${splitSentence}`
      : `${signed(selectedShare)} of ${lowerFirst(root.name)}’s ${signed(rootDelta)} year-over-year change`;

  const allOpen = facts.allBranches.every((id) => expandedIds.includes(id));
  const onlyRootOpen =
    expandedIds.length === 0 || (expandedIds.length === 1 && expandedIds[0] === rootId);

  return (
    <Card className={cn("@container", className)} data-slot="infographic-kpi-tree">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">
            {root.name}, by driver
          </span>
          <Badge className="shrink-0" variant="secondary">
            {latestMonth}
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-title text-balance text-foreground">{headline}</h2>
          <p className="tabular-nums text-body text-foreground">
            {endpoints}: {splitSentence}.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup
            aria-label="Orientation"
            onValueChange={(value) =>
              value && setOrientation(value as InfographicKpiTreeOrientation)
            }
            size="sm"
            type="single"
            value={orientation}
            variant="segmented"
          >
            <ToggleGroupItem value="vertical">Vertical</ToggleGroupItem>
            <ToggleGroupItem value="horizontal">Horizontal</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex flex-wrap items-center gap-2">
            {/*
              aria-disabled, never native `disabled`: the button a keyboard
              user just pressed must keep focus when it has nothing left to do.
            */}
            <Button
              aria-disabled={allOpen || undefined}
              className={DISABLED_LOOK}
              onClick={() => {
                if (!allOpen) setExpandedIds(facts.allBranches);
              }}
              size="sm"
              variant="outline"
            >
              <ChevronsUpDown aria-hidden="true" />
              Expand all
            </Button>
            <Button
              aria-disabled={onlyRootOpen || undefined}
              className={DISABLED_LOOK}
              onClick={() => {
                if (!onlyRootOpen) setExpandedIds([rootId]);
              }}
              size="sm"
              variant="outline"
            >
              <ChevronsDownUp aria-hidden="true" />
              Collapse
            </Button>
          </div>
        </div>
        <div className="h-160 min-w-0">
          <TreeChart<KpiTreeMetric>
            accessibleDescription={`${endpoints}; ${splitSentence}.`}
            accessibleLabel={`${root.name} driver tree`}
            align="center"
            data={data}
            datapointLabel={(point) =>
              labelFor(point.datum as unknown as TreeDatapointDatum<KpiTreeMetric>)
            }
            expandedIds={expandedIds}
            nodeHeight={NODE_HEIGHT}
            nodeWidth={NODE_WIDTH}
            onDatapointClick={(point) => {
              const id = (point.datum as unknown as TreeDatapointDatum<KpiTreeMetric>).id;
              if (id) setSelectedId(id);
            }}
            onExpandedChange={setExpandedIds}
            orientation={orientation === "vertical" ? "tb" : "lr"}
            renderNode={(node: TreeChartNodeRenderProps<KpiTreeMetric>) => (
              <KpiTreeCard
                currency={currency}
                pillOnRight={node.orientation === "lr" && node.isExpandable}
                locale={locale}
                metric={metricOf(node.node)}
                selected={node.id === selectedId}
              />
            )}
          />
        </div>
        <div
          aria-atomic="true"
          aria-live="polite"
          className="flex flex-col gap-1 rounded-lg bg-surface-muted p-3"
          data-slot="infographic-kpi-tree-detail"
        >
          <p className="text-body text-foreground">
            <span className="font-medium">{selected.name}</span>
            {selected.op ? ` = ${formula}` : `, ${formula}`}
          </p>
          <p className="tabular-nums text-caption text-muted-foreground">
            {formatKpiValue(selectedFacts.latest, selected.unit, locale, currency)} in {latestMonth}
            {" · "}
            {sayChange(selectedMom, `from ${previousMonthLabel}`)} ·{" "}
            {sayChange(selectedYoy, `from ${yearAgoMonth}`)} · {shareSentence}.
          </p>
        </div>
        <p className="text-caption text-muted-foreground">
          How to read it: each card is one metric, and the cards{" "}
          {orientation === "vertical" ? "below" : "to the right of"} it are what it is built from,
          adding, subtracting or multiplying exactly into it. MoM compares with the month before,
          YoY with the same month a year earlier; the arrow and sign give the direction, and a
          dashed outline (and the colour) marks a move that is bad news.
        </p>
        <KpiAsOf date={KPI_TREE_AS_OF} locale={locale} source={KPI_TREE_SOURCE} />
      </CardContent>
    </Card>
  );
}
