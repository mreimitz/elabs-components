"use client";

import { useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, CircleCheck } from "lucide-react";
import {
  Sparkline,
  TreeChart,
  type TreeChartLinkRenderProps,
  type TreeChartNodeRenderProps,
  type TreeDatapointDatum,
} from "@elabs-ai/components-charts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  MetricCard,
  type MetricCardComparison,
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
const NODE_WIDTH = 256;
const NODE_HEIGHT = 192;

/**
 * How ONE driver enters its parent: what the link between them should say.
 * A `difference` parent starts from its first driver and takes every later
 * one away; a `sum` adds all of them; a `product` multiplies.
 */
function driverRole(op: KpiTreeOp, index: number): { symbol: string; words: string } {
  if (op === "product") return { symbol: "×", words: "multiplies into" };
  if (op === "difference" && index > 0) return { symbol: "−", words: "subtracts from" };
  return { symbol: "+", words: "adds to" };
}

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

/** A change as `MetricCard` takes it — direction + polarity, the tile draws arrow, sign and tone. */
function comparisonOf(label: string, change: Change): MetricCardComparison {
  return {
    label,
    delta: change.text,
    deltaDirection: change.direction === "flat" ? "neutral" : change.direction,
    // `describeChange` already folded the metric's direction into `good`, so
    // the chip only needs to know whether THIS move is the good one.
    positiveIsGood:
      change.good === null ? true : change.direction === "up" ? change.good : !change.good,
  };
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
 * One metric as the library's own KPI tile: `MetricCard` carries the name,
 * the latest value, what it counts, the 12-month `Sparkline` and the two
 * comparison chips (month over month, year over year). Presentational only —
 * the chart's own tree items carry focus and names; the tile is `inert`.
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
    <MetricCard
      className={cn(
        "h-full w-full shadow-xs [&>[data-slot=card-content]]:h-full [&>[data-slot=card-content]]:p-4",
        selected ? "border-primary inset-ring inset-ring-primary" : "border-card-border",
      )}
      comparisons={[comparisonOf("MoM", mom), comparisonOf("YoY", yoy)]}
      data-selected={selected || undefined}
      data-slot="infographic-kpi-tree-card"
      description={metric.caption}
      icon={
        selected ? (
          // Foreground ink: the check is the selection cue that holds 3:1 in
          // every theme (a pale brand primary does not).
          <CircleCheck aria-hidden="true" className="text-foreground" />
        ) : undefined
      }
      label={metric.name}
      positiveIsGood={metric.higherIsBetter}
      sparkline={
        <Sparkline
          fitDomain
          height={28}
          label={`${metric.name}, last 12 months`}
          values={metric.monthly.slice(-12)}
          variant="line"
          // Growing across, the chart's open/close pill sits on the card's right edge, mid-height — the sparkline stops short of it.
          width={pillOnRight ? 208 : 224}
        />
      }
      value={formatKpiValue(latest, metric.unit, locale, currency)}
    />
  );
}

/**
 * The operator on a link: how the child enters its parent — `+` adds to it,
 * `−` takes away from it, `×` multiplies into it. Drawn on the line itself,
 * between the two cards, so the arithmetic is visible where the eye travels;
 * restated in words through the chart's `datapointLabel`.
 */
function KpiTreeLinkOperator({ link }: { link: TreeChartLinkRenderProps<KpiTreeMetric> }) {
  const parent = metricOf(link.source);
  if (!parent.op) return null;
  const role = driverRole(parent.op, link.index);
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full border bg-card text-caption font-semibold tabular-nums text-foreground shadow-xs",
        role.symbol === "−" ? "border-dashed border-destructive" : "border-border-strong",
      )}
      data-op={role.symbol}
      data-slot="infographic-kpi-tree-operator"
    >
      {role.symbol}
    </span>
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
    // Each driver's parent and its place among the drivers — what its link says.
    const roleOf = new Map<string, { parent: KpiTreeMetric; index: number }>();
    for (const node of nodes) {
      (node.children ?? []).forEach((child, index) =>
        roleOf.set(child.id as string, { parent: metricOf(node), index }),
      );
    }
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
      roleOf,
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
    const entry = facts.roleOf.get(metric.id);
    const role = entry?.parent.op ? driverRole(entry.parent.op, entry.index) : null;
    return [
      metric.name,
      ...(role && entry ? [`${role.words} ${lowerFirst(entry.parent.name)}`] : []),
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
    ? selected.driverNames
        .map((name, index) =>
          index === 0 ? name : `${driverRole(selected.op as KpiTreeOp, index).symbol} ${name}`,
        )
        .join(" ")
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
        <div className="h-184 min-w-0">
          <TreeChart<KpiTreeMetric>
            accessibleDescription={`${endpoints}; ${splitSentence}.`}
            accessibleLabel={`${root.name} driver tree`}
            align="center"
            data={data}
            datapointLabel={(point) =>
              labelFor(point.datum as unknown as TreeDatapointDatum<KpiTreeMetric>)
            }
            expandedIds={expandedIds}
            minimap
            nodeHeight={NODE_HEIGHT}
            nodeWidth={NODE_WIDTH}
            onDatapointClick={(point) => {
              const id = (point.datum as unknown as TreeDatapointDatum<KpiTreeMetric>).id;
              if (id) setSelectedId(id);
            }}
            onExpandedChange={setExpandedIds}
            orientation={orientation === "vertical" ? "tb" : "lr"}
            renderLink={(link: TreeChartLinkRenderProps<KpiTreeMetric>) => (
              <KpiTreeLinkOperator link={link} />
            )}
            zoomable
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
          Zoom with the wheel or the +/− controls, drag anywhere to pan, and use the minimap to
          jump; Fit view brings the whole tree back into the box. How to read it: each card is one
          metric, and the cards {orientation === "vertical" ? "below" : "to the right of"} it are
          what it is built from. The sign on the connecting line says how: + adds to the parent, −
          (dashed) takes away from it, × multiplies into it — so Revenue + and Operating costs −
          make Operating profit. MoM compares with the month before, YoY with the same month a year
          earlier; the arrow and sign give the direction, and a dashed outline (and the colour)
          marks a move that is bad news.
        </p>
        <KpiAsOf date={KPI_TREE_AS_OF} locale={locale} source={KPI_TREE_SOURCE} />
      </CardContent>
    </Card>
  );
}
