"use client";

/**
 * The payoff of a selection on a density scatter: what the selected points
 * ADD UP TO. Three KPI tiles — how many are selected, the share of the class
 * you care about inside the selection, and the mean of a value column — all
 * recomputed from the same columnar data and the same intersection the chart
 * paints (`resolveSelection`), so the numbers and the picture never disagree.
 */
import { useMemo } from "react";
import {
  classifyZones,
  type DensityScatterColumns,
  type DensityScatterSelection,
  type DensityZone,
  hasSelection,
  MetricCard,
  MetricGrid,
  resolveSelection,
  toDensityColumns,
} from "@elabs-ai/components-charts";

export interface SelectionSummaryProps {
  data: DensityScatterColumns;
  selection: DensityScatterSelection;
  /** Zones the chart classifies with (share tile = the FIRST zone's share). */
  zones?: readonly DensityZone[];
  /** A categorical column instead of zones: `{ key, value }` is the share tile. */
  category?: { key: string; value: string; label: string };
  /** The value column the mean tile reports. */
  valueKey: string;
  valueLabel: string;
  formatValue: (value: number) => string;
  /** What one point is called, plural ("positions", "dies", "fills"). */
  noun: string;
}

const nf = new Intl.NumberFormat("en");

export function SelectionSummary({
  data,
  selection,
  zones,
  category,
  valueKey,
  valueLabel,
  formatValue,
  noun,
}: SelectionSummaryProps) {
  const points = useMemo(() => toDensityColumns(data), [data]);
  const cls = useMemo(() => classifyZones(points, zones ?? []), [points, zones]);
  const zoneOrder = useMemo(() => (zones ?? []).map((z) => z.id), [zones]);
  const stats = useMemo(() => {
    const selected = new Uint8Array(points.n);
    const active = resolveSelection(points, cls, zoneOrder, selection, selected);
    const value = points.values[valueKey];
    const cat = category ? points.categories[category.key] : undefined;
    const code = cat ? cat.labels.indexOf(category!.value) : -1;
    let count = 0;
    let inClass = 0;
    let sum = 0;
    for (let i = 0; i < points.n; i++) {
      if (!selected[i]) continue;
      count++;
      if (value) sum += value[i]!;
      if (category) {
        if (cat && cat.codes[i] === code) inClass++;
      } else if (cls[i] === 0) inClass++;
    }
    return { active, count, inClass, mean: count ? sum / count : Number.NaN };
  }, [points, cls, zoneOrder, selection, valueKey, category]);

  const shareLabel = category ? category.label : (zones?.[0]?.label ?? "");
  const scope = stats.active ? "in the selection" : "overall";
  return (
    <MetricGrid columns={3}>
      <MetricCard
        description={
          hasSelection(selection)
            ? `of ${nf.format(points.n)} ${noun}`
            : `every point drawn, none averaged`
        }
        label={stats.active ? `Selected ${noun}` : `All ${noun}`}
        value={nf.format(stats.count)}
      />
      <MetricCard
        description={scope}
        label={`Share ${shareLabel}`}
        value={stats.count ? `${((100 * stats.inClass) / stats.count).toFixed(1)} %` : "—"}
      />
      <MetricCard
        description={scope}
        label={`Mean ${valueLabel}`}
        value={Number.isNaN(stats.mean) ? "—" : formatValue(stats.mean)}
      />
    </MetricGrid>
  );
}
