"use client";

import { useLocale } from "@elabs-ai/components-ui";
import { useMemo } from "react";
import { useChartFormatters } from "../chart-formatters";
import { ChartTooltipBox, type ChartTooltipRect } from "../tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "../tooltip/tooltip-content";
import {
  type ChoroplethFeature,
  useChoroplethInteraction,
  useChoroplethStable,
  useChoroplethZoom,
} from "./choropleth-context";

/** One absolute `M`/`L` point of a d3-geo path string (a Point's relative arcs are skipped). */
const PATH_POINT = /[ML](-?[\d.]+(?:e[-+]?\d+)?),(-?[\d.]+(?:e[-+]?\d+)?)/g;

/** A drawn region's bounding box, in the svg's own (pre-zoom) pixels. */
function pathBounds(path: string | null | undefined): ChartTooltipRect | null {
  if (!path) {
    return null;
  }
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const match of path.matchAll(PATH_POINT)) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  if (!(Number.isFinite(x0) && Number.isFinite(y0) && Number.isFinite(x1) && Number.isFinite(y1))) {
    return null;
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export interface ChoroplethTooltipProps {
  /** Custom content renderer for feature tooltips */
  content?: (props: { feature: ChoroplethFeature; index: number }) => React.ReactNode;
  /** Value formatter function */
  formatValue?: (value: number) => string;
  /** Get the display name for a feature. Default: uses feature.properties.name */
  getFeatureName?: (feature: ChoroplethFeature, index: number) => string;
  /** Get the value for a feature (for display in tooltip) */
  getFeatureValue?: (feature: ChoroplethFeature, index: number) => number | undefined;
  /** Label for the value row. Default: "Value" */
  valueLabel?: string;
  /** Custom class name */
  className?: string;
}

export function ChoroplethTooltip({
  content,
  formatValue: formatValueProp,
  getFeatureName,
  getFeatureValue,
  valueLabel: valueLabelProp,
  className = "",
}: ChoroplethTooltipProps) {
  const { intFmt } = useChartFormatters();
  const { t } = useLocale();
  const formatValue = formatValueProp ?? intFmt;
  const valueLabel = valueLabelProp ?? t("charts.tooltip.value");
  const { containerRef, width, height, features, featurePaths, pathGenerator } =
    useChoroplethStable();
  const { tooltipData } = useChoroplethInteraction();
  const { zoom } = useChoroplethZoom();

  // The hovered region as drawn — the same path string the feature layer paints.
  const regionPath = tooltipData
    ? (featurePaths[tooltipData.featureIndex] ?? pathGenerator(tooltipData.feature))
    : null;
  const regionBounds = useMemo(() => pathBounds(regionPath), [regionPath]);

  if (!tooltipData) {
    return null;
  }

  // Apply zoom transform to centroid position
  let x = tooltipData.x;
  let y = tooltipData.y;

  if (zoom) {
    // Apply the zoom transform matrix to the tooltip position
    const transformed = zoom.applyToPoint({ x, y });
    x = transformed.x;
    y = transformed.y;
  }

  // The hovered region's box through the same zoom, so the tooltip keeps clear of it.
  let mark = regionBounds;
  if (zoom && regionBounds) {
    const a = zoom.applyToPoint({ x: regionBounds.x, y: regionBounds.y });
    const b = zoom.applyToPoint({
      x: regionBounds.x + regionBounds.width,
      y: regionBounds.y + regionBounds.height,
    });
    mark = {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
  }

  const feature = features[tooltipData.featureIndex];
  if (!feature) {
    return null;
  }

  // Get feature name
  const featureName = getFeatureName
    ? getFeatureName(feature, tooltipData.featureIndex)
    : (feature.properties?.name ?? `Feature ${tooltipData.featureIndex}`);

  // Custom content
  if (content) {
    return (
      <ChartTooltipBox
        avoid={mark}
        className={className}
        containerHeight={height}
        containerRef={containerRef}
        containerWidth={width}
        visible
        x={x}
        y={y}
      >
        {content({ feature, index: tooltipData.featureIndex })}
      </ChartTooltipBox>
    );
  }

  // Default tooltip with optional value
  const value = getFeatureValue?.(feature, tooltipData.featureIndex);
  const rows: TooltipRow[] =
    value === undefined
      ? []
      : [
          {
            color: "var(--chart-1)",
            label: valueLabel,
            value: formatValue(value),
          },
        ];

  return (
    <ChartTooltipBox
      avoid={mark}
      className={className}
      containerHeight={height}
      containerRef={containerRef}
      containerWidth={width}
      visible
      x={x}
      y={y}
    >
      <ChartTooltipContent rows={rows} title={featureName} />
    </ChartTooltipBox>
  );
}

ChoroplethTooltip.displayName = "ChoroplethTooltip";

export default ChoroplethTooltip;
