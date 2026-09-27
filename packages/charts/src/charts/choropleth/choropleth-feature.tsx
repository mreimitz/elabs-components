"use client";

import { geoCentroid } from "d3-geo";
import { motion, useTransform } from "motion/react";
import { memo, type ReactElement, useCallback, useId, useMemo } from "react";
import { HaloText } from "../../marks/halo-text";
import { indexPaletteFills, makeSeriesPattern, seriesPatternId } from "../series-pattern";
import { useEnterComplete } from "../use-enter-complete";
import { useHighDecorationOf } from "../use-high-decoration";
import { useOnMarkInk } from "../use-on-mark-ink";
import { useMountProgress } from "../use-mount-progress";
import type { ColorScale } from "@elabs-ai/components-ui";
import { resolvePalette, useChartPalette } from "../chart-context";
import {
  type ChoroplethFeature as ChoroplethFeatureType,
  type ChoroplethOverlayConfig,
  CHOROPLETH_COLOR_CYCLE,
  defaultChoroplethColors,
  useChoroplethInteraction,
  useChoroplethStable,
} from "./choropleth-context";
import { featureValueAt } from "./fit-to-data";

export interface ChoroplethFeatureProps {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fadedOpacity?: number;
  getFeatureColor?: (feature: ChoroplethFeatureType, index: number) => string;
  patterns?: React.ReactNode;
  getFeaturePattern?: (feature: ChoroplethFeatureType, index: number) => string | null | undefined;
  /**
   * Distinguish "no data" regions (`properties.value` is not a finite number)
   * from regions that simply happen to be colored by the default palette.
   * - `"hatch"` — a diagonal `<pattern>` in `--chart-grid` (the pattern
   *   infrastructure `series-pattern.tsx` already ships; this is its
   *   no-data-specific sibling, not tied to a series index).
   * - `"muted"` — a flat `var(--muted)` fill (the same token BarChart/series-bar
   *   already use for a "not real data yet" fill).
   * - `undefined` (default) — no-data regions render exactly as before
   *   (`getFeatureColor` / `fill` / the default palette), unaffected.
   *
   * Takes priority over `fill` and `getFeatureColor` (a chart-wide default
   * that doesn't know which regions lack data) but NOT over `getFeaturePattern`
   * (an author's explicit, per-feature choice always wins).
   */
  noDataFill?: "hatch" | "muted";
  /**
   * Label the top-N regions BY VALUE (`properties.value`, descending) inline
   * at their centroid with a halo'd `<text>` showing the region's name — the
   * M1/M2 "top-N inline labels with halo" enhancement. Labels that would
   * otherwise collide are nudged apart vertically (see `spacedTopK` below).
   * Unset (default) renders no labels.
   */
  labelTop?: number;
}

interface FeatureRecord {
  index: number;
  path: string;
  fill: string;
  feature: ChoroplethFeatureType;
  centroid: { x: number; y: number } | null;
}

/** The opacity the feature layer paints a region's fill at. */
const FEATURE_BASE_OPACITY = 0.85;

/** No per-region decoration patterns (low decoration, or no palette fills). */
const NO_PATTERN_INDICES: ReadonlyMap<string, number> = new Map();

/**
 * The region's value — the "does this region have data" test. Without a colour
 * scale: `properties.value` when it is a finite number (unchanged). With one
 * (RM-124): the scale's `key`, numeric strings included, as `colorScaleFor` reads it.
 */
function getFeatureNumericValue(
  feature: ChoroplethFeatureType,
  valueKey?: string,
): number | undefined {
  if (valueKey !== undefined) return featureValueAt(feature, valueKey);
  const raw = feature.properties?.value;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

// Overlay — RM-124 ────────────────────────────────────────────────────────────

const OVERLAY_BASE_ANGLE: Record<NonNullable<ChoroplethOverlayConfig["direction"]>, number> = {
  up: -45,
  down: 45,
  horizontal: 0,
  vertical: 90,
};

/** Each later category turns its stripes by these offsets, so categories read apart in greyscale. */
const OVERLAY_ANGLE_STEPS = [0, 90, 45, -45];

/** The overlay category a feature carries, or `null` (no overlay). */
export function overlayCategoryOf(feature: ChoroplethFeatureType, key: string): string | null {
  const raw = feature.properties?.[key];
  if (raw === undefined || raw === null || raw === false || raw === "") return null;
  return raw === true ? "true" : String(raw);
}

/** Every overlay category in first-seen order. */
export function overlayCategories(
  features: readonly ChoroplethFeatureType[],
  key: string,
): string[] {
  const seen: string[] = [];
  for (const feature of features) {
    const category = overlayCategoryOf(feature, key);
    if (category !== null && !seen.includes(category)) seen.push(category);
  }
  return seen;
}

/** The stripe angle (degrees) for the `index`-th overlay category. */
export function overlayAngle(
  direction: ChoroplethOverlayConfig["direction"],
  index: number,
): number {
  const base = OVERLAY_BASE_ANGLE[direction ?? "up"];
  const step = OVERLAY_ANGLE_STEPS[index % OVERLAY_ANGLE_STEPS.length] ?? 0;
  return base + step;
}

/** One stripes `<pattern>`: foreground-ink lines on a transparent ground. */
export function OverlayStripesPattern({ id, angle }: { id: string; angle: number }) {
  return (
    <pattern
      height={6}
      id={id}
      patternTransform={`rotate(${angle})`}
      patternUnits="userSpaceOnUse"
      width={6}
    >
      <line stroke="var(--chart-foreground)" strokeWidth={1.5} x1={0} x2={0} y1={0} y2={6} />
    </pattern>
  );
}

// Categorical texture — RM-124 / a-8 ─────────────────────────────────────────

/**
 * The series-ramp index a categorical class is textured with, or `null` for a
 * class that stays plain.
 *
 * A categorical scale tells its classes apart by HUE alone, and two brand
 * categorical tokens can sit 0.018 apart in luminance — in greyscale they are
 * one shade (WCAG 1.4.1). So every class AFTER the first also carries an ink
 * texture: with N classes, "plain + N−1 textures" is N mutually distinct
 * appearances with the least ink on the map.
 *
 * The ramp is entered at the class index, not at 0, so a category never takes
 * ramp 0 (`diagonal`) — that shape is the `overlayBy` stripes' own vocabulary,
 * and a category must never be mistaken for an overlay flag.
 *
 * The legend swatch reads this same function, which is how the key stays in
 * step with the map.
 */
export function categoryTextureIndex(categoryIndex: number): number | null {
  return categoryIndex > 0 ? categoryIndex : null;
}

/** The pattern id for the `index`-th category texture within one chart/legend. */
export function categoryTexturePatternId(index: number, scope: string): string {
  return `choropleth-category-texture-${scope}-${index}`;
}

/**
 * One category texture `<pattern>`: house series-ramp ink on a TRANSPARENT
 * ground, so the class colour underneath is untouched and the texture is purely
 * the second channel.
 *
 * `ink` is the on-mark ink for the class's OWN fill (`useOnMarkInk`), not a
 * theme foreground: the categorical tokens are the same colours in every theme,
 * so an ink that inverts with the theme reads at 9.6:1 in one and 1.2:1 in the
 * other. The achromatic pair clears ≥4.58:1 on any plate (#238, #243).
 */
export function makeCategoryTexture(
  index: number,
  id: string,
  ink: string,
  scale = 1,
): ReactElement {
  return makeSeriesPattern(index, id, ink, { ground: false, scale });
}

/** A human-readable name for a feature, for the `labelTop` inline label. */
function getFeatureDisplayName(feature: ChoroplethFeatureType, index: number): string {
  const props = feature.properties;
  if (props?.name && typeof props.name === "string") {
    return props.name;
  }
  if (props?.id !== undefined) {
    return String(props.id);
  }
  return `Region ${index + 1}`;
}

function resolveFeatureFill(
  feature: ChoroplethFeatureType,
  index: number,
  fill: string | undefined,
  getFeatureColor: ChoroplethFeatureProps["getFeatureColor"],
  getFeaturePattern: ChoroplethFeatureProps["getFeaturePattern"],
  noDataFill: ChoroplethFeatureProps["noDataFill"],
  noDataHatchFillUrl: string,
  colorScale?: ColorScale | null,
  valueKey?: string,
  cycle: readonly string[] = defaultChoroplethColors,
): string {
  const patternId = getFeaturePattern?.(feature, index);
  if (patternId) {
    return `url(#${patternId})`;
  }
  if (
    noDataFill &&
    getFeatureNumericValue(feature, colorScale ? valueKey : undefined) === undefined
  ) {
    return noDataFill === "hatch" ? noDataHatchFillUrl : "var(--muted)";
  }
  if (fill) {
    return fill;
  }
  if (getFeatureColor) {
    return getFeatureColor(feature, index);
  }
  // Colour scale — RM-124: a region without data is `--muted`, never a ramp step.
  if (colorScale) {
    return colorScale.colorOf(feature.properties?.[valueKey ?? "value"] as never) ?? "var(--muted)";
  }
  return cycle[index % cycle.length] ?? "var(--chart-1)";
}

/**
 * A minimum-gap collision-avoidance pass over a set of candidate label points.
 * Picks the top `k` by value, then nudges any two points that are close on
 * BOTH axes apart vertically so labels don't stack on top of one another.
 *
 * Private copy — the shared `spacedTopK` (RM-028) has not landed yet; this is
 * scoped to `labelTop`'s needs (a handful of points, one pass) rather than a
 * general-purpose export. Replace with the shared version once RM-028 ships.
 */
function spacedTopK<T extends { value: number; x: number; y: number }>(
  points: readonly T[],
  k: number,
  minGap = 14,
): T[] {
  const top = [...points].sort((a, b) => b.value - a.value).slice(0, Math.max(0, k));
  const byY = [...top].sort((a, b) => a.y - b.y);
  const placed: T[] = [];
  for (const point of byY) {
    let y = point.y;
    for (const prev of placed) {
      // Only push apart labels that are also horizontally close — two labels
      // at a similar height but far apart in x shouldn't collide.
      if (Math.abs(prev.x - point.x) < minGap * 4 && y - prev.y < minGap) {
        y = prev.y + minGap;
      }
    }
    placed.push({ ...point, y });
  }
  return placed;
}

const StaticFeatureLayer = memo(function StaticFeatureLayer({
  records,
  stroke,
  strokeWidth,
  baseOpacity,
  dimOpacity,
  hoveredIndex,
  focusedIndex,
  onFeatureEnter,
  onFeatureLeave,
}: {
  records: FeatureRecord[];
  stroke: string;
  strokeWidth: number;
  baseOpacity: number;
  dimOpacity: number;
  hoveredIndex: number | null;
  /** Keyboard-focused feature index — renders a visible focus ring. */
  focusedIndex: number | null;
  onFeatureEnter: (record: FeatureRecord) => void;
  onFeatureLeave: () => void;
}) {
  const isDimmed = hoveredIndex !== null;

  // Focused feature (from keyboard nav) — rendered as a separate top-level pair
  // of paths: the compound indicator (#67) in SVG, a wider `--ring-contour`
  // stroke under the `--ring` one, so one edge clears 3:1 whatever the feature
  // underneath is filled with. WCAG 2.4.11 focus appearance.
  const focusedRecord =
    focusedIndex !== null ? records.find((r) => r.index === focusedIndex) : null;

  if (!isDimmed) {
    return (
      <>
        <g opacity={baseOpacity}>
          {records.map((record) => (
            <path
              className="cursor-pointer"
              d={record.path}
              fill={record.fill}
              key={`base-${record.index}`}
              onMouseEnter={() => onFeatureEnter(record)}
              onMouseLeave={onFeatureLeave}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          ))}
        </g>
        {focusedRecord ? (
          <g key={`focus-ring-${focusedRecord.index}`} pointerEvents="none">
            <path
              d={focusedRecord.path}
              fill="none"
              stroke="var(--ring-contour)"
              strokeWidth={4.5}
            />
            <path d={focusedRecord.path} fill="none" stroke="var(--ring)" strokeWidth={2.5} />
          </g>
        ) : null}
      </>
    );
  }

  const highlighted = records.find((record) => record.index === hoveredIndex);

  return (
    <>
      <g opacity={dimOpacity} style={{ transition: "opacity var(--t-fast) var(--ease-entrance)" }}>
        {records
          .filter((record) => record.index !== hoveredIndex)
          .map((record) => (
            <path
              className="cursor-pointer"
              d={record.path}
              fill={record.fill}
              key={`base-${record.index}`}
              onMouseEnter={() => onFeatureEnter(record)}
              onMouseLeave={onFeatureLeave}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          ))}
      </g>
      {highlighted ? (
        <path
          className="cursor-pointer"
          d={highlighted.path}
          fill={highlighted.fill}
          key={`highlight-${highlighted.index}`}
          onMouseEnter={() => onFeatureEnter(highlighted)}
          onMouseLeave={onFeatureLeave}
          opacity={1}
          stroke={stroke}
          strokeWidth={strokeWidth}
          style={{ transition: "opacity var(--t-fast) var(--ease-entrance)" }}
        />
      ) : null}
      {focusedRecord ? (
        <g key={`focus-ring-${focusedRecord.index}`} pointerEvents="none">
          <path d={focusedRecord.path} fill="none" stroke="var(--ring-contour)" strokeWidth={4.5} />
          <path d={focusedRecord.path} fill="none" stroke="var(--ring)" strokeWidth={2.5} />
        </g>
      ) : null}
    </>
  );
});

const EnterFeatureLayer = memo(function EnterFeatureLayer({
  records,
  stroke,
  strokeWidth,
  baseOpacity,
  dimOpacity,
  hoveredIndex,
  focusedIndex,
  onFeatureEnter,
  onFeatureLeave,
  revealEpoch,
}: {
  records: FeatureRecord[];
  stroke: string;
  strokeWidth: number;
  baseOpacity: number;
  dimOpacity: number;
  hoveredIndex: number | null;
  /** Keyboard-focused feature index — rendered as a focus ring after enter animation completes. */
  focusedIndex: number | null;
  onFeatureEnter: (record: FeatureRecord) => void;
  onFeatureLeave: () => void;
  revealEpoch: number;
}) {
  const { enterTransition, animationDuration } = useChoroplethStable();
  const mountProgress = useMountProgress(enterTransition, 0, `choropleth-layer-${revealEpoch}`);
  const enterComplete = useEnterComplete(mountProgress);
  const layerOpacity = useTransform(mountProgress, (t) => t * baseOpacity);

  if (enterComplete) {
    return (
      <StaticFeatureLayer
        baseOpacity={baseOpacity}
        dimOpacity={dimOpacity}
        focusedIndex={focusedIndex}
        hoveredIndex={hoveredIndex}
        onFeatureEnter={onFeatureEnter}
        onFeatureLeave={onFeatureLeave}
        records={records}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  return (
    <motion.g
      key={`enter-${revealEpoch}`}
      opacity={layerOpacity}
      transition={{
        duration: animationDuration / 1000,
        ease: "easeOut",
      }}
    >
      {records.map((record) => (
        <path
          className="cursor-pointer"
          d={record.path}
          fill={record.fill}
          key={`enter-${record.index}`}
          onMouseEnter={() => onFeatureEnter(record)}
          onMouseLeave={onFeatureLeave}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ))}
    </motion.g>
  );
});

export const ChoroplethFeature = memo(function ChoroplethFeature({
  fill,
  stroke = "var(--background)",
  strokeWidth = 0.5,
  fadedOpacity = 0.4,
  getFeatureColor,
  patterns,
  getFeaturePattern,
  noDataFill,
  labelTop,
}: ChoroplethFeatureProps) {
  // Palette — RM-186: the container's palette, cycled like the default five.
  const palette = useChartPalette();
  const featureColors = useMemo(
    () =>
      palette === undefined
        ? defaultChoroplethColors
        : resolvePalette(palette, CHOROPLETH_COLOR_CYCLE, { explicit: true }),
    [palette],
  );
  const {
    features,
    featurePaths,
    pathGenerator,
    projectPoint,
    isLoaded,
    revealEpoch,
    width,
    height,
    containerRef,
    colorScale,
    valueKey,
    overlay,
  } = useChoroplethStable();
  const { hoveredFeatureIndex, setHoveredFeatureIndex, focusedFeatureIndex, setTooltipData } =
    useChoroplethInteraction();
  const noDataHatchId = `choropleth-no-data-hatch-${useId().replace(/:/g, "")}`;
  const noDataHatchFillUrl = `url(#${noDataHatchId})`;
  // Decoration pattern (ADR 0011, #257): under high decoration every distinct
  // palette fill gets its own series pattern, so regions that differ by hue
  // also differ by texture. Author fills (patterns, literals, no-data) stay.
  const high = useHighDecorationOf(containerRef);
  const inkFor = useOnMarkInk(containerRef);
  const patternScope = useId().replace(/:/g, "");

  const featureCentroids = useMemo(() => {
    return features.map((feature) => {
      try {
        const centroid = geoCentroid(feature);
        if (centroid && !Number.isNaN(centroid[0]) && !Number.isNaN(centroid[1])) {
          const projected = projectPoint(centroid as [number, number]);
          if (projected) {
            const padding = 60;
            return {
              x: Math.max(padding, Math.min(width - padding, projected[0])),
              y: Math.max(padding, Math.min(height - padding, projected[1])),
            };
          }
        }
      } catch {
        // Some geometries may not have valid centroids
      }
      return null;
    });
  }, [features, projectPoint, width, height]);

  const baseRecords = useMemo(() => {
    const items: FeatureRecord[] = [];
    for (let index = 0; index < features.length; index++) {
      const feature = features[index];
      if (!feature) {
        continue;
      }

      const path = featurePaths[index] ?? pathGenerator(feature);
      if (!path) {
        continue;
      }

      items.push({
        index,
        path,
        fill: resolveFeatureFill(
          feature,
          index,
          fill,
          getFeatureColor,
          getFeaturePattern,
          noDataFill,
          noDataHatchFillUrl,
          colorScale,
          valueKey,
          featureColors,
        ),
        feature,
        centroid: featureCentroids[index] ?? null,
      });
    }
    return items;
  }, [
    featureCentroids,
    featurePaths,
    features,
    fill,
    getFeatureColor,
    getFeaturePattern,
    noDataFill,
    noDataHatchFillUrl,
    pathGenerator,
    colorScale,
    valueKey,
    featureColors,
  ]);

  // Overlay — RM-124: one stripes pattern per category, painted over the fill.
  const overlayLayer = useMemo(() => {
    if (!overlay) return null;
    const categories = overlayCategories(
      baseRecords.map((record) => record.feature),
      overlay.key,
    );
    if (categories.length === 0) return null;
    const idOf = (index: number) => `choropleth-overlay-${patternScope}-${index}`;
    return {
      defs: categories.map((category, index) => (
        <OverlayStripesPattern
          angle={overlayAngle(overlay.direction, index)}
          id={idOf(index)}
          key={`overlay-${category}`}
        />
      )),
      paths: baseRecords.flatMap((record) => {
        const category = overlayCategoryOf(record.feature, overlay.key);
        if (category === null) return [];
        return [
          <path
            d={record.path}
            data-overlay-category={category}
            fill={`url(#${idOf(categories.indexOf(category))})`}
            key={`overlay-${record.index}`}
          />,
        ];
      }),
    };
  }, [overlay, baseRecords, patternScope]);

  const patternIndices = useMemo(
    () => (high ? indexPaletteFills(baseRecords.map((record) => record.fill)) : NO_PATTERN_INDICES),
    [baseRecords, high],
  );

  // Categorical texture — a-8: a categorical scale's classes differ only in hue,
  // and two of the brand categorical tokens sit 0.018 apart in luminance, so in
  // greyscale they are one shade. Every class after the first also gets an ink
  // texture, painted OVER the solid class colour (the hue is untouched) and
  // keyed by the class's index in the scale, so `ChoroplethColorKey` paints the
  // same shape on the same class. Skipped under high decoration, where every
  // distinct fill is already a pattern (`patternIndices` above).
  const categoryTextureLayer = useMemo(() => {
    if (high || !colorScale || colorScale.palette !== "categorical") return null;
    if (colorScale.categories.length < 2) return null;
    const idOf = (index: number) => categoryTexturePatternId(index, patternScope);
    /** texture index → the class colour it is painted over. */
    const used = new Map<number, string>();
    const paths = baseRecords.flatMap((record) => {
      const categoryIndex = colorScale.indexOf(
        record.feature.properties?.[valueKey ?? "value"] as never,
      );
      const textureIndex = categoryTextureIndex(categoryIndex);
      // Only texture a region the SCALE painted — an author's `fill`,
      // `getFeatureColor`, `getFeaturePattern` or a no-data fill keeps its own
      // appearance, exactly as it does under high decoration.
      if (textureIndex === null || record.fill !== colorScale.categories[categoryIndex]?.color) {
        return [];
      }
      used.set(textureIndex, record.fill);
      return [
        <path
          d={record.path}
          data-category-index={categoryIndex}
          fill={`url(#${idOf(textureIndex)})`}
          key={`category-texture-${record.index}`}
        />,
      ];
    });
    if (paths.length === 0) return null;
    return {
      defs: Array.from(used, ([textureIndex, color]) =>
        // FEATURE_BASE_OPACITY: the plate the ink lands on is the class colour
        // as the feature layer actually paints it, not the token at full strength.
        makeCategoryTexture(
          textureIndex,
          idOf(textureIndex),
          inkFor(color, FEATURE_BASE_OPACITY).ink,
        ),
      ),
      paths,
    };
  }, [baseRecords, colorScale, high, inkFor, patternScope, valueKey]);

  const records = useMemo(() => {
    if (patternIndices.size === 0) {
      return baseRecords;
    }
    return baseRecords.map((record) => {
      const patternIndex = patternIndices.get(record.fill);
      return patternIndex === undefined
        ? record
        : { ...record, fill: `url(#${seriesPatternId(patternIndex, patternScope)})` };
    });
  }, [baseRecords, patternIndices, patternScope]);

  // labelTop (M1/M2) — the top-N regions by `properties.value`, inline
  // halo'd text at their centroid, collision-avoided.
  const topLabels = useMemo(() => {
    if (!labelTop || labelTop <= 0) {
      return [];
    }
    const candidates = records
      .map((record) => {
        const value = getFeatureNumericValue(record.feature);
        if (value === undefined || !record.centroid) {
          return null;
        }
        return {
          value,
          x: record.centroid.x,
          y: record.centroid.y,
          name: getFeatureDisplayName(record.feature, record.index),
          key: record.index,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    return spacedTopK(candidates, labelTop);
  }, [records, labelTop]);

  const handleFeatureEnter = useCallback(
    (record: FeatureRecord) => {
      setHoveredFeatureIndex(record.index);
      setTooltipData({
        featureIndex: record.index,
        x: record.centroid?.x ?? width / 2,
        y: record.centroid?.y ?? height / 2,
        feature: record.feature,
      });
    },
    [height, setHoveredFeatureIndex, setTooltipData, width],
  );

  const handleFeatureLeave = useCallback(() => {
    setHoveredFeatureIndex(null);
    setTooltipData(null);
  }, [setHoveredFeatureIndex, setTooltipData]);

  const layerProps = {
    baseOpacity: FEATURE_BASE_OPACITY,
    dimOpacity: fadedOpacity,
    hoveredIndex: hoveredFeatureIndex,
    focusedIndex: focusedFeatureIndex,
    onFeatureEnter: handleFeatureEnter,
    onFeatureLeave: handleFeatureLeave,
    records,
    stroke,
    strokeWidth,
  };

  return (
    <g className="choropleth-features">
      {patterns ||
      noDataFill === "hatch" ||
      patternIndices.size > 0 ||
      overlayLayer ||
      categoryTextureLayer ? (
        <defs>
          {patterns}
          {overlayLayer?.defs}
          {categoryTextureLayer?.defs}
          {Array.from(patternIndices, ([color, patternIndex]) =>
            makeSeriesPattern(patternIndex, seriesPatternId(patternIndex, patternScope), color),
          )}
          {noDataFill === "hatch" ? (
            <pattern height={8} id={noDataHatchId} patternUnits="userSpaceOnUse" width={8}>
              <rect fill="var(--chart-background)" height={8} width={8} />
              <path
                d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2"
                fill="none"
                stroke="var(--chart-grid)"
                strokeLinecap="square"
                // chart-hairline-exempt: this is a texture FILL standing in for a
                // colour on a no-data region, not a rule the data is read against.
                // Thinning it to the furniture weight would make the hatch read as
                // an empty region rather than a deliberately-unfilled one.
                strokeWidth={1}
              />
            </pattern>
          ) : null}
        </defs>
      ) : null}
      {isLoaded ? (
        <StaticFeatureLayer {...layerProps} />
      ) : (
        <EnterFeatureLayer {...layerProps} revealEpoch={revealEpoch} />
      )}
      {categoryTextureLayer ? (
        <g data-slot="choropleth-category-texture" pointerEvents="none">
          {categoryTextureLayer.paths}
        </g>
      ) : null}
      {overlayLayer ? (
        <g data-slot="choropleth-overlay" pointerEvents="none">
          {overlayLayer.paths}
        </g>
      ) : null}
      {topLabels.length > 0 ? (
        <g aria-hidden="true">
          {topLabels.map((label) => (
            <HaloText
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={700}
              key={label.key}
              textAnchor="middle"
              x={label.x}
              y={label.y}
            >
              {label.name}
            </HaloText>
          ))}
        </g>
      ) : null}
    </g>
  );
});

ChoroplethFeature.displayName = "ChoroplethFeature";

export default ChoroplethFeature;
