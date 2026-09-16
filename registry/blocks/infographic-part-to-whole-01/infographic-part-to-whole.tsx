"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeTreemapLayout,
  HaloText,
  Leader,
  TreemapChart,
  type TreemapLeafDatum,
} from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { formatKpiValue } from "@/components/kpi-card-parts/format";
import {
  type CostScenario,
  fuelCostScenario,
  highlightValue,
  leafSharePct,
  sharePpChange,
  toTreemapNode,
  totalCost,
} from "@/components/infographic-part-to-whole-01/data/cost-breakdown";

export interface InfographicPartToWholeProps {
  /** Defaults to the fuel scenario — see `data/cost-breakdown.ts` for the alternate highlight. */
  scenario?: CostScenario;
  locale?: string;
  /** Renders a layout-shaped skeleton instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

const TREEMAP_DEPTH = 2;
const TREEMAP_GAP = 2;

/**
 * "Where does the money go?" — a two-level treemap of Q3 cost, category →
 * sub-category, with every OTHER tile drawn a neutral mono shade so the one
 * highlighted rectangle — outlined and named with a `Leader` + `HaloText`
 * callout — is the only thing competing for attention. Area is exactly
 * proportional to value (the layout engine's own guarantee, no sqrt); shares
 * are computed from the same tree the headline's total comes from, so the two
 * can never disagree.
 */
export function InfographicPartToWhole({
  scenario = fuelCostScenario,
  locale = "en-US",
  loading = false,
  className,
}: InfographicPartToWholeProps) {
  const total = totalCost(scenario);
  const highlightSharePct = leafSharePct(scenario, scenario.highlightGroup, scenario.highlightLeaf);
  const gapPp = sharePpChange(scenario);
  const absGap = Math.abs(gapPp);
  const direction = gapPp >= 0 ? "up" : "down";
  const formattedTotal = formatKpiValue(total, "currency", locale);
  const formattedHighlight = formatKpiValue(highlightValue(scenario), "currency", locale);

  const tree = useMemo(() => toTreemapNode(scenario), [scenario]);

  const accessibleLabel = `Q3 cost by category and sub-category, totaling ${formattedTotal}.`;
  const accessibleDescription = `${scenario.highlightLeaf}, under ${scenario.highlightGroup}, is ${formattedHighlight} — ${highlightSharePct}% of total cost, ${absGap} percentage points ${direction} from ${scenario.priorSharePct}% last quarter.`;

  return (
    <Card
      aria-live={loading ? "polite" : undefined}
      className={cn("w-full", className)}
      data-slot="infographic-part-to-whole"
      role={loading ? "status" : undefined}
    >
      <CardContent className="space-y-4 p-5">
        {loading ? <span className="sr-only">Loading the cost breakdown treemap…</span> : null}
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">
            Where does the money go?
          </span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        {loading ? (
          <InfographicPartToWholeSkeleton />
        ) : (
          <>
            <p className="text-title text-foreground">
              {scenario.highlightLeaf} is {highlightSharePct}% of cost, {direction} {absGap}pp
            </p>
            <p className="text-caption text-muted-foreground">
              <span className="tabular-nums">{formattedHighlight}</span> of the{" "}
              <span className="tabular-nums">{formattedTotal}</span> Q3 total —{" "}
              {scenario.priorSharePct}% last quarter, {scenario.context}.
            </p>
            <HighlightedTreemap
              accessibleDescription={accessibleDescription}
              accessibleLabel={accessibleLabel}
              gapPp={gapPp}
              highlightSharePct={highlightSharePct}
              scenario={scenario}
              tree={tree}
            />
            <p className="text-caption text-muted-foreground">
              Tile area is proportional to cost; every other category is shown in one neutral shade
              so only {scenario.highlightLeaf.toLowerCase()} stands out.
            </p>
          </>
        )}
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

function InfographicPartToWholeSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

/**
 * Wraps the real `TreemapChart` and overlays a `Leader` + `HaloText` callout
 * on top of ONE tile. The overlay independently measures the same DOM node
 * `TreemapChart` measures and re-runs the package's own `computeTreemapLayout`
 * with IDENTICAL options (`depth`, `gap`, `palette`, `otherThreshold`), so the
 * highlight rect lands pixel-for-pixel on the tile the chart actually drew —
 * never a second, hand-guessed geometry that could drift from a layout change.
 */
function HighlightedTreemap({
  accessibleDescription,
  accessibleLabel,
  gapPp,
  highlightSharePct,
  scenario,
  tree,
}: {
  accessibleDescription: string;
  accessibleLabel: string;
  gapPp: number;
  highlightSharePct: number;
  scenario: CostScenario;
  tree: ReturnType<typeof toTreemapNode>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const highlightLeaf: TreemapLeafDatum | null = useMemo(() => {
    if (size.w <= 0 || size.h <= 0) return null;
    const layout = computeTreemapLayout(tree, {
      width: size.w,
      height: size.h,
      depth: TREEMAP_DEPTH,
      gap: TREEMAP_GAP,
      palette: "mono",
      otherThreshold: 0,
    });
    return (
      layout.leaves.find(
        (leaf) =>
          leaf.groupName === scenario.highlightGroup && leaf.name === scenario.highlightLeaf,
      ) ?? null
    );
  }, [scenario.highlightGroup, scenario.highlightLeaf, size.h, size.w, tree]);

  const gapText = `${gapPp >= 0 ? "+" : "−"}${Math.abs(gapPp)}pp vs Q2`;

  return (
    <div className="relative w-full">
      <TreemapChart
        accessibleDescription={accessibleDescription}
        accessibleLabel={accessibleLabel}
        data={tree}
        depth={TREEMAP_DEPTH}
        gap={TREEMAP_GAP}
        palette="mono"
        ref={containerRef}
        showValues
      />
      {highlightLeaf ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          role="presentation"
          viewBox={`0 0 ${size.w} ${size.h}`}
        >
          <rect
            data-slot="infographic-part-to-whole-highlight"
            fill="var(--chart-1)"
            fillOpacity={0.28}
            height={highlightLeaf.y1 - highlightLeaf.y0}
            rx={2}
            stroke="var(--chart-1)"
            strokeWidth={2}
            width={highlightLeaf.x1 - highlightLeaf.x0}
            x={highlightLeaf.x0}
            y={highlightLeaf.y0}
          />
          <CalloutLabel gapText={gapText} leaf={highlightLeaf} sharePct={highlightSharePct} />
        </svg>
      ) : null}
    </div>
  );
}

/** A callout needs room for its own two lines UNDER the tile's built-in
 * name/value label — below this box, only the highlight outline draws. */
const MIN_CALLOUT_WIDTH = 110;
const MIN_CALLOUT_HEIGHT = 96;
const CALLOUT_PADDING = 8;
const CALLOUT_LINE_GAP = 14;

/**
 * The callout's label sits in the highlighted tile's OWN bottom-right corner —
 * never at a canvas-relative position, which could as easily land on top of a
 * neighbouring tile's name. A short `Leader` ties it back to the tile's right
 * edge, and both stay strictly inside `leaf`'s box, so the callout can never
 * collide with a mark it does not describe.
 */
function CalloutLabel({
  gapText,
  leaf,
  sharePct,
}: {
  gapText: string;
  leaf: TreemapLeafDatum;
  sharePct: number;
}) {
  const width = leaf.x1 - leaf.x0;
  const height = leaf.y1 - leaf.y0;
  if (width < MIN_CALLOUT_WIDTH || height < MIN_CALLOUT_HEIGHT) return null;

  const labelX = leaf.x1 - CALLOUT_PADDING;
  const gapLineY = leaf.y1 - CALLOUT_PADDING;
  const nameLineY = gapLineY - CALLOUT_LINE_GAP;
  const leaderFromY = leaf.y0 + height * 0.6;
  const leaderToY = nameLineY - CALLOUT_LINE_GAP;

  return (
    <g data-slot="infographic-part-to-whole-callout">
      <Leader dash="2 3" from={[leaf.x1, leaderFromY]} to={[labelX, leaderToY]} />
      <HaloText fontSize={12} fontWeight={600} textAnchor="end" x={labelX} y={nameLineY}>
        {leaf.name} · {sharePct}%
      </HaloText>
      <HaloText
        fill="var(--chart-foreground-muted)"
        fontSize={10}
        textAnchor="end"
        x={labelX}
        y={gapLineY}
      >
        {gapText}
      </HaloText>
    </g>
  );
}
