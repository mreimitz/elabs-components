"use client";

import { type GeoPermissibleObjects, Mercator } from "@visx/geo";
import { geoCentroid, type GeoProjection } from "d3-geo";
import { ParentSize } from "@visx/responsive";
import type { TransformMatrix } from "@visx/zoom";
import { Zoom } from "@visx/zoom";
import type { FeatureCollection, Geometry } from "geojson";
import type { Transition } from "motion/react";
import React, {
  forwardRef,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  cn,
  type ColorScale,
  colorScaleFor,
  type ColorScaleSpec,
  type ColorScaleValue,
  StatePanel,
} from "@elabs-ai/components-ui";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "../chart-a11y";
import type { ChartAnnotation } from "../annotations/annotation-types";
import type { AnnotationAxis, AnnotationScales } from "../annotations/resolve-annotation-position";
import { useAnnotatedChart, useChartAnnotationLayers } from "../annotations/with-chart-annotations";
import { useChartValueSetFormatter } from "../chart-formatters";
import { RampLegend, type RampLegendLabelMode } from "../legend/ramp-legend";
import { SizeLegend } from "../legend/size-legend";
import type { ChartValueFormat } from "../value-format";
import {
  type ChoroplethFeature,
  type ChoroplethFeatureProperties,
  ChoroplethInteractionShell,
  type ChoroplethOverlayConfig,
  ChoroplethStableProvider,
  ChoroplethZoomContext,
  type Margin,
  useChoroplethInteraction,
  type ZoomInstance,
} from "./choropleth-context";
import {
  type ChoroplethFitToData,
  featureHasData,
  featureValueAt,
  fitProjectionToFeatures,
  resolveFitPadding,
} from "./fit-to-data";
import {
  ChoroplethInsetMap,
  type ChoroplethCorner,
  type ChoroplethInsetConfig,
  visibleExtentLine,
} from "./inset-map";
import {
  ChoroplethPlaceLabels,
  type ChoroplethPlaceLabelsConfig,
  layoutPlaceLabels,
  type PlaceLabelCandidate,
} from "./place-labels";
import {
  ChoroplethSymbolLayer,
  type ChoroplethSymbolsConfig,
  DEFAULT_SYMBOL_MAX_SIZE,
  layoutSymbols,
  symbolShrink,
} from "./symbol-layer";
import { ChoroplethZoomControls, type ChoroplethZoomLabels } from "./zoom-controls";
import {
  ChoroplethFeature as ChoroplethFeatureLayer,
  overlayAngle,
  overlayCategories,
  OverlayStripesPattern,
} from "./choropleth-feature";
import { ChoroplethGraticule as ChoroplethGraticuleLayer } from "./choropleth-graticule";
import { ChoroplethKeyboardNav, type ChoroplethKeyboardNavProps } from "./choropleth-keyboard-nav";
import { ChoroplethTooltip as ChoroplethTooltipLayer } from "./choropleth-tooltip";
import {
  ChartPlotBox,
  ChartPlotRoot,
  type ChartPlotHeight,
  type Responsive,
  type ResponsiveByBreakpoint,
  resolveResponsive,
  useChartBreakpoint,
} from "../chart-breakpoint";

/** Messages already logged, so a re-rendering chart does not re-log every frame. */
const warnedMessages = new Set<string>();
function warnOnce(message: string): void {
  if (process.env.NODE_ENV === "production" || warnedMessages.has(message)) return;
  warnedMessages.add(message);
  console.warn(message);
}

/** True when `data` really is a collection carrying a `features` array. */
function hasFeatureArray(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    Array.isArray((data as { features?: unknown }).features)
  );
}

export interface ChoroplethChartProps {
  /** GeoJSON FeatureCollection data */
  data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  /** Chart margins */
  margin?: Partial<Margin>;
  /** Animation duration in milliseconds. Default: 800 */
  animationDuration?: number;
  /** Motion enter transition (spring or cubic-bezier tween). */
  enterTransition?: Transition;
  /** Signature of motion URL state — triggers enter replay when it changes. */
  revealSignature?: string;
  /** Aspect ratio as "width / height". Default: "16 / 9" */
  aspectRatio?: string;
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint. Wins over `aspectRatio`, which stays an alias.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  /**
   * The COLOUR scale (RM-124): `{ key, type: "continuous" | "stepped", method?,
   * steps?, domain?, palette? }`, resolved by `colorScaleFor` over every
   * feature's `properties[key]` (default key `"value"`) into the chart token
   * ramps. `ChoroplethFeature getFeatureColor` / `fill` still override it.
   *
   * Deprecated form: a NUMBER is the projection scale, kept as an alias of
   * `projectionScale` (removed in 5.0.0).
   */
  scale?: number | ChoroplethScaleSpec;
  /** Projection scale. If not provided, auto-calculated based on width (or solved by `fitToData`). */
  projectionScale?: number;
  /**
   * The colour key (RM-118 `RampLegend`; swatches for a categorical palette),
   * plus the `SizeLegend` of `symbols` and the `overlayBy` key. Unset: shown
   * with a `scale` or `symbols`, but hidden at the narrow tier; `true` or a
   * config always shows it. `position` defaults to
   * `{ base: "bottom-left", narrow: "below" }`. `false` hides it.
   */
  legend?: boolean | ChoroplethLegendConfig;
  /**
   * Frame the map on the regions that carry data (`scale.key`, default
   * `"value"`): the projection's scale / translate are solved so they fill the
   * plot, minus `padding`. The other regions stay, cropped by the plot edge,
   * unless `hideNoData` is set. Wins over `projectionScale` / `translate`.
   */
  fitToData?: ChoroplethFitToData;
  /** Remove every region without data from the map (and the DOM). All gone → the empty state. */
  hideNoData?: boolean;
  /** A locator mini map in a corner, outlining the visible extent. */
  inset?: ChoroplethInsetConfig;
  /**
   * Region names at their centroids (at most 30), placed through the shared
   * label collision engine; not painted at the narrow tier. Dropped names are
   * restated for screen readers.
   */
  labels?: ChoroplethPlaceLabelsConfig;
  /** Stripes over every region whose `key` holds a category (one direction per category). */
  overlayBy?: ChoroplethOverlayConfig;
  /** Proportional symbols at the feature centroids (or `points`), with their own size key. */
  symbols?: ChoroplethSymbolsConfig;
  /**
   * `+` / `−` / reset buttons (real buttons, keyboard-operable) in the top
   * corner; turns zoom on. Pass an object to translate their names.
   */
  zoomControls?: boolean | Partial<ChoroplethZoomLabels>;
  /**
   * Text annotations at `x` = longitude, `y` = latitude (RM-111). At the
   * narrow tier each note becomes a numbered marker listed under the map.
   */
  annotations?: readonly ChartAnnotation[];
  /** Title of the empty state (`hideNoData` left no region). Default "No data". */
  emptyTitle?: string;
  /** Message of the empty state. Default "No region has data to map.". */
  emptyMessage?: string;
  /** Center coordinates [longitude, latitude]. Default: [0, 20] */
  center?: [number, number];
  /** Translate offset [x, y]. If not provided, auto-calculated to center */
  translate?: [number, number];
  /** Enable zoom and pan. Default: false */
  zoomEnabled?: boolean;
  /** Minimum zoom scale. Default: 0.5 */
  zoomMin?: number;
  /** Maximum zoom scale. Default: 4 */
  zoomMax?: number;
  /** Initial zoom transform */
  initialZoom?: TransformMatrix;
  /** Additional class name for the container */
  className?: string;
  /** Child components (ChoroplethFeature, ChoroplethGraticule, ChoroplethTooltip) */
  children: ReactNode;
  /**
   * Accessible name for the chart region (role="figure"). Announced by AT on
   * focus. Example: "World market share choropleth map"
   */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /**
   * Supplemental description (region count, value range, etc.). Rendered as a
   * visually-hidden span associated via aria-describedby.
   */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  /**
   * When provided, a visually-hidden keyboard-navigation overlay is rendered so
   * keyboard users can arrow-navigate through geographic features. Pass the same
   * props accepted by ChoroplethKeyboardNav (getFeatureName, getFeatureValue,
   * valueLabel, navLabel).
   */
  keyboardNav?: ChoroplethKeyboardNavProps;
}

/** `scale` on `ChoroplethChart`: a `colorScaleFor` spec plus the feature property it reads. */
export type ChoroplethScaleSpec = ColorScaleSpec & {
  /** Feature property holding the value. Default `"value"`. */
  key?: string;
};

/** Where the colour key sits: a corner over the map, or stacked above / below it. */
export type ChoroplethLegendPosition = ChoroplethCorner | "above" | "below";

/** `legend` on `ChoroplethChart`. */
export interface ChoroplethLegendConfig {
  /** The key's title ("Cooling degree days"). */
  title?: string;
  /**
   * `"ruler"` (default): values at the class breaks. `"ranges"`: one
   * `from–to` per class. `"custom"`: `custom` verbatim. A ruler over breaks
   * that are not evenly spaced (quantile, Jenks, median…) is drawn as ranges,
   * so no label ever sits at a break it does not name.
   */
  labels?: RampLegendLabelMode;
  /** Verbatim labels for `labels: "custom"` ("Cooling needed →"). */
  custom?: readonly string[];
  /** Default `{ base: "bottom-left", narrow: "below" }`. */
  position?: Responsive<ChoroplethLegendPosition>;
  orientation?: "horizontal" | "vertical";
  /** How key values format (RM-109). Default `"number"`. */
  valueFormat?: ChartValueFormat;
  currency?: string;
}

export const DEFAULT_CHOROPLETH_LEGEND_POSITION: ResponsiveByBreakpoint<ChoroplethLegendPosition> =
  {
    base: "bottom-left",
    narrow: "below",
  };

const DEFAULT_MARGIN: Margin = { top: 0, right: 0, bottom: 0, left: 0 };

// Known SVG component displayNames
const SVG_COMPONENT_NAMES = new Set([
  "ChoroplethFeature",
  "ChoroplethGraticule",
  "ChoroplethTooltip",
]);

const SVG_COMPONENT_TYPES = new Set([
  ChoroplethFeatureLayer,
  ChoroplethGraticuleLayer,
  ChoroplethTooltipLayer,
]);

function resolveComponentType(type: unknown): unknown {
  if (
    typeof type === "object" &&
    type !== null &&
    "type" in type &&
    (type as { type?: unknown }).type
  ) {
    return (type as { type: unknown }).type;
  }
  return type;
}

function getComponentDisplayName(type: unknown): string | null {
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name ?? null;
  }
  if (typeof type === "object" && type !== null) {
    const wrapped = type as {
      displayName?: string;
      type?: { displayName?: string; name?: string };
    };
    if (wrapped.displayName) {
      return wrapped.displayName;
    }
    const inner = wrapped.type;
    if (typeof inner === "function") {
      const innerFn = inner as { displayName?: string; name?: string };
      return innerFn.displayName ?? innerFn.name ?? null;
    }
  }
  return null;
}

function isChoroplethSvgChild(type: unknown): boolean {
  if (SVG_COMPONENT_TYPES.has(type as never)) {
    return true;
  }
  const resolved = resolveComponentType(type);
  if (resolved !== type && SVG_COMPONENT_TYPES.has(resolved as never)) {
    return true;
  }
  const displayName = getComponentDisplayName(type);
  return displayName !== null && SVG_COMPONENT_NAMES.has(displayName);
}

// HTML elements that should render in overlay layer
const HTML_ELEMENTS = new Set(["div", "span", "button", "p", "a"]);

// Separate children into SVG and overlay layers
function separateChildren(children: ReactNode): {
  svgChildren: React.ReactNode[];
  overlayChildren: React.ReactNode[];
} {
  const childArray = React.Children.toArray(children);
  const svgChildren: React.ReactNode[] = [];
  const overlayChildren: React.ReactNode[] = [];

  for (const child of childArray) {
    if (!React.isValidElement(child)) {
      svgChildren.push(child);
      continue;
    }

    if (isChoroplethSvgChild(child.type)) {
      svgChildren.push(child);
    } else if (typeof child.type === "string") {
      if (HTML_ELEMENTS.has(child.type)) {
        overlayChildren.push(child);
      } else {
        svgChildren.push(child);
      }
    } else {
      overlayChildren.push(child);
    }
  }

  return { svgChildren, overlayChildren };
}

const DEFAULT_INITIAL_ZOOM: TransformMatrix = {
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
  skewX: 0,
  skewY: 0,
};

interface MercatorRenderProps {
  path: (geo: GeoPermissibleObjects) => string | null;
  projection: ((coords: [number, number]) => [number, number] | null | undefined) & {
    invert?: GeoProjection["invert"];
  };
}

/** The thematic parts of a render, resolved once per data / prop change (RM-124). */
interface ChoroplethThematic {
  valueKey: string;
  colorScale: ColorScale | null;
  overlay: ChoroplethOverlayConfig | null;
  /** The whole collection, before `hideNoData` (the inset draws it). */
  allFeatures: readonly ChoroplethFeature[];
  labels?: ChoroplethPlaceLabelsConfig;
  symbols?: ChoroplethSymbolsConfig;
  inset?: ChoroplethInsetConfig;
  zoomLabels?: Partial<ChoroplethZoomLabels>;
  zoomControls: boolean;
}

interface ChoroplethMercatorContentProps {
  mercator: MercatorRenderProps;
  data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: Margin;
  animationDuration: number;
  enterTransition?: Transition;
  revealEpoch: number;
  isLoaded: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  svgChildren: React.ReactNode[];
  overlayChildren: React.ReactNode[];
  zoom?: ZoomInstance<SVGSVGElement>;
  keyboardNav?: ChoroplethKeyboardNavProps;
  thematic: ChoroplethThematic;
}

const ChoroplethSvg = memo(function ChoroplethSvg({
  height,
  width,
  svgChildren,
  zoom,
  zoomedLayers,
  back,
  front,
}: {
  height: number;
  width: number;
  svgChildren: React.ReactNode[];
  zoom?: ZoomInstance<SVGSVGElement>;
  /** Drawn inside the zoom group, after the children (symbols). */
  zoomedLayers?: ReactNode;
  /** Drawn before / after the zoom group, in screen space (annotations, place labels). */
  back?: ReactNode;
  front?: ReactNode;
}) {
  const { setHoveredFeatureIndex, setTooltipData } = useChoroplethInteraction();

  const handleMouseLeave = useCallback(() => {
    setHoveredFeatureIndex(null);
    setTooltipData(null);
  }, [setHoveredFeatureIndex, setTooltipData]);

  return (
    <svg
      aria-hidden="true"
      height={height}
      onMouseLeave={handleMouseLeave}
      ref={zoom?.containerRef}
      style={{
        contain: "layout style paint",
        cursor: zoom?.isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      width={width}
    >
      {back}
      <g
        style={{
          transition: zoom?.isDragging ? "none" : "transform var(--t-fast) var(--ease-entrance)",
        }}
        transform={zoom ? zoom.toString() : undefined}
      >
        {svgChildren}
        {zoomedLayers}
      </g>
      {front}
    </svg>
  );
});

/** A Mercator axis for annotations: one coordinate through the projection and the zoom. */
function mercatorAxis(toPixel: (value: number) => number | undefined): AnnotationAxis {
  return {
    point: (value) => (typeof value === "number" ? toPixel(value) : undefined),
    span: (from, to) => {
      if (typeof from !== "number" || typeof to !== "number") return undefined;
      const a = toPixel(from);
      const b = toPixel(to);
      return a === undefined || b === undefined ? undefined : [Math.min(a, b), Math.max(a, b)];
    },
  };
}

const ChoroplethMercatorContent = memo(function ChoroplethMercatorContent({
  mercator,
  data,
  width,
  height,
  innerWidth,
  innerHeight,
  margin,
  animationDuration,
  enterTransition,
  revealEpoch,
  isLoaded,
  containerRef,
  svgChildren,
  overlayChildren,
  zoom,
  keyboardNav,
  thematic,
}: ChoroplethMercatorContentProps) {
  const featurePaths = data.features.map((feature) => mercator.path(feature) ?? null) as (
    | string
    | null
  )[];

  const pathGenerator = useCallback(
    (feature: ChoroplethFeature) => mercator.path(feature) ?? undefined,
    [mercator],
  );

  const rawPathGenerator = useCallback(
    (geo: GeoPermissibleObjects) => mercator.path(geo),
    [mercator],
  );

  const projectPoint = useCallback(
    (coords: [number, number]): [number, number] | null => {
      const projected = mercator.projection(coords);
      if (!projected) {
        return null;
      }
      return projected as [number, number];
    },
    [mercator],
  );

  const { valueKey, colorScale, overlay } = thematic;
  const stableValue = useMemo(
    () => ({
      features: data.features,
      featureCollection: data,
      featurePaths,
      pathGenerator,
      rawPathGenerator,
      projectPoint,
      width,
      height,
      innerWidth,
      innerHeight,
      margin,
      containerRef,
      isLoaded,
      animationDuration,
      enterTransition,
      revealEpoch,
      ...(colorScale || overlay ? { valueKey, colorScale, overlay } : null),
    }),
    [
      animationDuration,
      colorScale,
      containerRef,
      data,
      enterTransition,
      featurePaths,
      height,
      innerHeight,
      innerWidth,
      isLoaded,
      margin,
      overlay,
      pathGenerator,
      projectPoint,
      rawPathGenerator,
      revealEpoch,
      valueKey,
      width,
    ],
  );

  // Screen-space layers: annotations and place labels follow the zoom but
  // keep their type size, so they are drawn outside the zoom group.
  const matrix = zoom?.transformMatrix ?? null;
  const sx = matrix?.scaleX ?? 1;
  const sy = matrix?.scaleY ?? 1;
  const tx = matrix?.translateX ?? 0;
  const ty = matrix?.translateY ?? 0;

  const annotationScales = useMemo<AnnotationScales>(
    () => ({
      x: mercatorAxis((lon) => {
        const p = mercator.projection([lon, 0]);
        return p ? p[0] * sx + tx : undefined;
      }),
      y: mercatorAxis((lat) => {
        const p = mercator.projection([0, lat]);
        return p ? p[1] * sy + ty : undefined;
      }),
      innerWidth: width,
      innerHeight: height,
    }),
    [height, mercator, sx, sy, tx, ty, width],
  );
  const annotationLayers = useChartAnnotationLayers(annotationScales);

  const breakpoint = useChartBreakpoint();
  const labelsConfig = thematic.labels;
  const placeLabels = useMemo(() => {
    if (!labelsConfig) return null;
    const textKey = labelsConfig.key ?? "name";
    const priorityKey = labelsConfig.priority ?? valueKey;
    const candidates: PlaceLabelCandidate[] = [];
    data.features.forEach((feature, index) => {
      const text = feature.properties?.[textKey];
      if (typeof text !== "string" && typeof text !== "number") return;
      let centroid: [number, number];
      try {
        centroid = geoCentroid(feature) as [number, number];
      } catch {
        return;
      }
      const projected = mercator.projection(centroid);
      if (!projected) return;
      candidates.push({
        id: String(feature.properties?.id ?? feature.id ?? index),
        text: String(text),
        x: projected[0] * sx + tx,
        y: projected[1] * sy + ty,
        priority: featureValueAt(feature, priorityKey) ?? Number.NEGATIVE_INFINITY,
      });
    });
    return layoutPlaceLabels(candidates, labelsConfig, {
      width,
      height,
      breakpoint,
    });
  }, [breakpoint, data.features, height, labelsConfig, mercator, sx, sy, tx, ty, valueKey, width]);

  const symbolsConfig = thematic.symbols;
  const symbols = useMemo(
    () => (symbolsConfig ? layoutSymbols(symbolsConfig, data.features, projectPoint, width) : null),
    [data.features, projectPoint, symbolsConfig, width],
  );

  const extent = useMemo(
    () => (thematic.inset ? visibleExtentLine(mercator.projection, width, height, matrix) : null),
    [height, matrix, mercator, thematic.inset, width],
  );

  return (
    <ChoroplethZoomContext.Provider value={{ zoom: zoom ?? null }}>
      <ChoroplethStableProvider value={stableValue}>
        <div className="relative h-full w-full" ref={containerRef}>
          <ChoroplethSvg
            back={annotationLayers.back}
            front={
              annotationLayers.front || placeLabels ? (
                <>
                  {placeLabels ? <ChoroplethPlaceLabels labels={placeLabels.painted} /> : null}
                  {annotationLayers.front}
                </>
              ) : undefined
            }
            height={height}
            svgChildren={svgChildren}
            width={width}
            zoom={zoom}
            zoomedLayers={
              symbols ? (
                <ChoroplethSymbolLayer shape={symbolsConfig?.shape} symbols={symbols} />
              ) : undefined
            }
          />
          {placeLabels && placeLabels.dropped.length > 0 ? (
            <span className="sr-only" data-slot="choropleth-dropped-labels">
              {placeLabels.dropped.join(", ")}
            </span>
          ) : null}
          {keyboardNav !== undefined ? <ChoroplethKeyboardNav {...keyboardNav} /> : null}
          {thematic.inset ? (
            <ChoroplethInsetMap
              {...thematic.inset}
              extent={extent}
              features={thematic.allFeatures}
              plotHeight={height}
              plotWidth={width}
            />
          ) : null}
          {thematic.zoomControls && zoom ? (
            <ChoroplethZoomControls labels={thematic.zoomLabels} />
          ) : null}
          {overlayChildren}
        </div>
      </ChoroplethStableProvider>
    </ChoroplethZoomContext.Provider>
  );
});

function ChoroplethChartInner({
  data,
  width,
  height,
  margin,
  animationDuration,
  enterTransition,
  revealSignature = "",
  scale: scaleProp,
  center,
  translate: translateProp,
  fitToData,
  zoomEnabled,
  zoomMin,
  zoomMax,
  initialZoom,
  keyboardNav,
  thematic,
  empty,
  onPlotWidth,
  children,
}: {
  data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  width: number;
  height: number;
  margin: Margin;
  animationDuration: number;
  enterTransition?: Transition;
  revealSignature?: string;
  scale?: number;
  center: [number, number];
  translate?: [number, number];
  fitToData?: ChoroplethFitToData;
  zoomEnabled: boolean;
  zoomMin: number;
  zoomMax: number;
  initialZoom: TransformMatrix;
  keyboardNav?: ChoroplethKeyboardNavProps;
  thematic: ChoroplethThematic;
  /** Rendered instead of the map when `hideNoData` left no region. */
  empty: ReactNode;
  /** Reports the plot width (the size key scales symbols by it). */
  onPlotWidth?: (width: number) => void;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  // fitToData — RM-124: frame the regions that carry data.
  const fitted = useMemo(() => {
    if (!fitToData || !hasFeatureArray(data)) return null;
    const withData = data.features.filter((f) => featureHasData(f, thematic.valueKey));
    return fitProjectionToFeatures(
      withData.length > 0 ? withData : data.features,
      innerWidth,
      innerHeight,
      center,
      resolveFitPadding(fitToData, innerWidth, innerHeight),
    );
  }, [center, data, fitToData, innerHeight, innerWidth, thematic.valueKey]);

  const scale = fitted?.scale ?? scaleProp ?? (innerWidth / 630) * 100;

  const translate: [number, number] = fitted
    ? [fitted.translate[0] + margin.left, fitted.translate[1] + margin.top]
    : (translateProp ?? [innerWidth / 2 + margin.left, innerHeight / 2 + margin.top + 50]);

  // NOTE: not wrapped in `useStableValue` (`../use-stable-value.ts`) — the
  // output is `ReactNode[]` (actual elements), not JSON-serializable plain
  // config, so a content-signature comparison isn't safe here. Stays
  // `children`-identity-keyed.
  const { svgChildren, overlayChildren } = useMemo(() => separateChildren(children), [children]);

  // revealSignature replays enter.
  useEffect(() => {
    setRevealEpoch((n) => n + 1);
    setIsLoaded(false);
    const timeout = setTimeout(() => {
      setIsLoaded(true);
    }, animationDuration);
    return () => clearTimeout(timeout);
  }, [animationDuration, revealSignature]);

  // The size key draws its circles at the same narrow shrink as the symbols.
  useEffect(() => {
    onPlotWidth?.(width);
  }, [onPlotWidth, width]);

  if (width < 10 || height < 10) {
    return null;
  }

  // #288 — a bare feature ARRAY (or anything without `features`) used to reach
  // @visx/geo's Projection as `undefined` and crash there with an anonymous
  // "reading 'map'", the container's name nowhere in the stack. Fail legibly
  // instead: warn once in dev and render nothing. Never coerce the wrong shape —
  // a guard that silently repairs a wrong prop hides the bug one layer down.
  if (!hasFeatureArray(data)) {
    warnOnce(
      "ChoroplethChart: `data` must be a GeoJSON FeatureCollection " +
        "({ type: 'FeatureCollection', features: [...] }), received " +
        (Array.isArray(data) ? "an array" : typeof data) +
        ".",
    );
    return null;
  }

  if (empty) return <>{empty}</>;

  const mercatorContentProps = {
    animationDuration,
    containerRef,
    data,
    enterTransition,
    height,
    innerHeight,
    innerWidth,
    isLoaded,
    keyboardNav,
    margin,
    overlayChildren,
    revealEpoch,
    svgChildren,
    thematic,
    width,
  };

  return (
    <Mercator
      center={center}
      data={data.features}
      scale={scale}
      translate={translate as [number, number]}
    >
      {(mercator) => {
        const content = (zoom?: ZoomInstance<SVGSVGElement>) => (
          <ChoroplethMercatorContent {...mercatorContentProps} mercator={mercator} zoom={zoom} />
        );

        if (zoomEnabled) {
          return (
            <Zoom<SVGSVGElement>
              height={height}
              initialTransformMatrix={initialZoom}
              scaleXMax={zoomMax}
              scaleXMin={zoomMin}
              scaleYMax={zoomMax}
              scaleYMin={zoomMin}
              wheelDelta={(event) => {
                const zoomScale = event.deltaY > 0 ? 0.95 : 1.05;
                return { scaleX: zoomScale, scaleY: zoomScale };
              }}
              width={width}
            >
              {(zoom) => content(zoom)}
            </Zoom>
          );
        }

        return content();
      }}
    </Mercator>
  );
}

// Colour key — RM-124 ─────────────────────────────────────────────────────────

/** Methods whose class breaks are evenly spaced, so a ruler names real breaks. */
const EVEN_METHODS = new Set(["linear", "equidistant", "rounded"]);

const LEGEND_CORNER_CLASS: Record<ChoroplethCorner, string> = {
  "top-left": "start-2 top-2",
  "top-right": "end-2 top-2",
  "bottom-left": "bottom-2 start-2",
  "bottom-right": "bottom-2 end-2",
};

function ChoroplethColorKey({
  colorScale,
  config,
  hoverValue,
}: {
  colorScale: ColorScale;
  config: ChoroplethLegendConfig;
  hoverValue: ColorScaleValue;
}) {
  const bounds = useMemo(
    () => colorScale.steps.flatMap((step) => [step.from, step.to]),
    [colorScale.steps],
  );
  const format = useChartValueSetFormatter(bounds, config.valueFormat ?? "number", config.currency);

  if (colorScale.palette === "categorical") {
    return (
      <div className="flex flex-col gap-1" data-slot="choropleth-legend-categories">
        {config.title ? (
          <span className="text-legend-foreground text-caption">{config.title}</span>
        ) : null}
        <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
          {colorScale.categories.map((category) => (
            <li className="flex items-center gap-1.5 text-meta" key={String(category.value)}>
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="text-legend-foreground">{String(category.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const [lo, hi] = colorScale.domain ?? [0, 1];
  const even = EVEN_METHODS.has(colorScale.method);
  let labels: RampLegendLabelMode = config.labels ?? "ruler";
  let custom = config.custom;
  if (labels !== "custom" && !even) {
    // A ruler (or RampLegend's own even ranges) would name breaks this scale
    // does not have: state the real classes instead.
    custom =
      colorScale.type === "stepped"
        ? colorScale.steps.map((step) => `${format(step.from)}–${format(step.to)}`)
        : [format(lo), format(hi)];
    labels = "custom";
  }
  // The marker sits where the value's class (or quantile) is drawn on the
  // evenly-drawn strip, mapped back into the domain RampLegend positions by.
  const position = colorScale.positionOf(hoverValue);
  const hover = position === null ? null : lo + position * (hi - lo);

  return (
    <RampLegend
      currency={config.currency}
      hover={hover}
      orientation={config.orientation}
      scale={{
        type: colorScale.type,
        domain: [lo, hi],
        steps: colorScale.steps.length,
        labels,
        custom,
      }}
      title={config.title}
      tone={colorScale.palette === "diverging" ? "diverging" : "sequential"}
      valueFormat={config.valueFormat}
    />
  );
}

function ChoroplethOverlayKey({
  overlay,
  categories,
}: {
  overlay: ChoroplethOverlayConfig;
  categories: readonly string[];
}) {
  return (
    <ul
      className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0"
      data-slot="choropleth-legend-overlay"
    >
      {categories.map((category, index) => {
        const id = `choropleth-overlay-key-${overlay.key}-${index}`.replace(/[^\w-]/g, "_");
        return (
          <li className="flex items-center gap-1.5 text-meta" key={category}>
            <svg aria-hidden="true" className="shrink-0" height={12} width={12}>
              <defs>
                <OverlayStripesPattern angle={overlayAngle(overlay.direction, index)} id={id} />
              </defs>
              <rect fill={`url(#${id})`} height={12} width={12} />
            </svg>
            <span className="text-legend-foreground">
              {category === "true" ? overlay.key : category}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The key: colour scale, symbol sizes and overlay categories. */
function ChoroplethKey({
  thematic,
  features,
  config,
  plotWidth,
  placement,
}: {
  thematic: ChoroplethThematic;
  features: readonly ChoroplethFeature[];
  config: ChoroplethLegendConfig;
  plotWidth: number;
  placement: ChoroplethLegendPosition;
}) {
  const { hoveredFeatureIndex, focusedFeatureIndex } = useChoroplethInteraction();
  const activeIndex = hoveredFeatureIndex ?? focusedFeatureIndex;
  const activeFeature = activeIndex === null ? undefined : features[activeIndex];
  const hoverValue = toColorScaleValue(activeFeature?.properties?.[thematic.valueKey]);

  const symbols = thematic.symbols;
  const sizeDomain = useMemo((): readonly [number, number] | null => {
    if (!symbols) return null;
    const sizeKey = symbols.sizeKey ?? symbols.key ?? "value";
    const rows: readonly (Record<string, unknown> | null | undefined)[] = symbols.points
      ? symbols.points
      : features.map((feature) => feature.properties);
    let max = 0;
    for (const row of rows) {
      const value = featureValueAt(
        {
          type: "Feature",
          geometry: null,
          properties: (row ?? null) as ChoroplethFeatureProperties | null,
        },
        sizeKey,
      );
      if (value !== undefined) max = Math.max(max, value);
    }
    return max > 0 ? [0, max] : null;
  }, [features, symbols]);

  const overlayCats = useMemo(
    () => (thematic.overlay ? overlayCategories(features, thematic.overlay.key) : []),
    [features, thematic.overlay],
  );

  const corner = placement !== "above" && placement !== "below";
  const sizeRadius = Math.max(
    2,
    (symbols?.maxSize ?? DEFAULT_SYMBOL_MAX_SIZE) * symbolShrink(plotWidth > 0 ? plotWidth : 700),
  );
  const parts: { id: string; node: ReactNode }[] = [];
  if (thematic.colorScale) {
    parts.push({
      id: "color",
      node: (
        <ChoroplethColorKey
          colorScale={thematic.colorScale}
          config={config}
          hoverValue={hoverValue}
        />
      ),
    });
  }
  if (symbols && sizeDomain) {
    parts.push({
      id: "size",
      node: (
        <SizeLegend
          currency={config.currency}
          domain={sizeDomain}
          maxRadius={sizeRadius}
          valueFormat={config.valueFormat}
        />
      ),
    });
  }
  if (thematic.overlay && overlayCats.length > 0) {
    parts.push({
      id: "overlay",
      node: <ChoroplethOverlayKey categories={overlayCats} overlay={thematic.overlay} />,
    });
  }
  if (parts.length === 0) return null;

  return (
    <div
      className={cn(
        "flex gap-3",
        corner
          ? cn(
              "absolute max-h-[calc(100%-1rem)] w-64 max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-md bg-background p-2",
              LEGEND_CORNER_CLASS[placement],
            )
          : cn("w-full flex-row flex-wrap items-end", placement === "above" ? "mb-2" : "mt-2"),
      )}
      data-legend-position={placement}
      data-slot="choropleth-legend"
    >
      {parts.map((part) => (
        <div className={cn("min-w-0", corner ? "w-full" : "w-64 max-w-full")} key={part.id}>
          {part.node}
        </div>
      ))}
    </div>
  );
}

// Container ────────────────────────────────────────────────────────────────────

function toColorScaleValue(raw: unknown): ColorScaleValue {
  return typeof raw === "number" || typeof raw === "string" ? raw : undefined;
}

/** Everything inside the plot root, where the tier is known (`useChartBreakpoint`). */
function ChoroplethBody({
  plotBox,
  legend,
  thematic,
  features,
  isEmpty,
  renderMap,
}: {
  plotBox: {
    aspectRatio?: string;
    plotHeight?: Responsive<ChartPlotHeight>;
  } | null;
  legend: ChoroplethChartProps["legend"];
  thematic: ChoroplethThematic;
  features: readonly ChoroplethFeature[];
  /** The empty state is showing: a key would describe nothing. */
  isEmpty: boolean;
  renderMap: (onPlotWidth: (width: number) => void) => ReactNode;
}) {
  const breakpoint = useChartBreakpoint();
  const [plotWidth, setPlotWidth] = useState(0);
  const map = renderMap(setPlotWidth);
  if (!plotBox) return <>{map}</>;

  // Narrow default (maintainer ruling): an implicit key hides at narrow; a
  // `legend` the host passed is explicit and stays, below the map by default.
  const config: ChoroplethLegendConfig = typeof legend === "object" ? legend : {};
  const shown = !isEmpty && legend !== false && (legend !== undefined || breakpoint !== "narrow");
  const placement = resolveResponsive(
    config.position ?? DEFAULT_CHOROPLETH_LEGEND_POSITION,
    breakpoint,
  );
  const key = shown ? (
    <ChoroplethKey
      config={config}
      features={features}
      placement={placement}
      plotWidth={plotWidth}
      thematic={thematic}
    />
  ) : null;
  const corner = placement !== "above" && placement !== "below";

  return (
    <div className="flex w-full flex-col" data-slot="choropleth-layout">
      {placement === "above" ? key : null}
      <ChartPlotBox
        className="relative w-full"
        data-slot="choropleth-plot"
        plotBox={{ ...plotBox, defaultPlotHeight: "16 / 9" }}
      >
        {map}
        {corner ? key : null}
      </ChartPlotBox>
      {placement === "below" ? key : null}
    </div>
  );
}

const ChoroplethChartBase = forwardRef<HTMLDivElement, ChoroplethChartProps>(
  function ChoroplethChartBase(
    {
      data,
      margin: marginProp,
      animationDuration = 800,
      enterTransition,
      revealSignature,
      aspectRatio,
      plotHeight,
      scale,
      projectionScale,
      center = [0, 20],
      translate,
      zoomEnabled = false,
      zoomMin = 0.5,
      zoomMax = 4,
      initialZoom = DEFAULT_INITIAL_ZOOM,
      className = "",
      accessibleLabel,
      accessibleDescription,
      keyboardNav,
      legend,
      fitToData,
      hideNoData = false,
      inset,
      labels,
      overlayBy,
      symbols,
      zoomControls,
      emptyTitle = "No data",
      emptyMessage = "No region has data to map.",
      children,
    },
    ref,
  ) {
    const margin = { ...DEFAULT_MARGIN, ...marginProp };

    const {
      role,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedby,
      tabIndex,
      descId,
    } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);

    // `scale` — RM-124: an object is the colour scale; a number is the
    // deprecated alias of `projectionScale`.
    const colorSpec = typeof scale === "object" && scale !== null ? scale : null;
    const projectionScaleValue = projectionScale ?? (typeof scale === "number" ? scale : undefined);
    const valueKey = colorSpec?.key ?? "value";
    const validData = hasFeatureArray(data);
    // `scale` is usually an inline object literal: memoise on its content.
    const colorSpecSignature = colorSpec ? JSON.stringify(colorSpec) : "";

    const colorScale = useMemo(() => {
      if (!colorSpecSignature || !validData) return null;
      const { key: _key, ...spec } = JSON.parse(colorSpecSignature) as ChoroplethScaleSpec;
      return colorScaleFor(
        data.features.map((feature) => toColorScaleValue(feature.properties?.[valueKey])),
        spec as ColorScaleSpec,
      );
    }, [colorSpecSignature, data, validData, valueKey]);

    const renderData = useMemo(
      () =>
        hideNoData && validData
          ? {
              ...data,
              features: data.features.filter((f) => featureHasData(f, valueKey)),
            }
          : data,
      [data, hideNoData, validData, valueKey],
    );

    const thematic = useMemo<ChoroplethThematic>(
      () => ({
        valueKey,
        colorScale,
        overlay: overlayBy ?? null,
        allFeatures: validData ? data.features : [],
        labels,
        symbols,
        inset,
        zoomControls: Boolean(zoomControls),
        zoomLabels: typeof zoomControls === "object" ? zoomControls : undefined,
      }),
      [colorScale, data, inset, labels, overlayBy, symbols, validData, valueKey, zoomControls],
    );

    // The stacked layout (plot box + key) only when there is a key to stack;
    // otherwise the DOM is the one this chart has always rendered.
    const stacked = colorSpec !== null || symbols !== undefined || overlayBy !== undefined;
    const isEmpty = hideNoData && validData && renderData.features.length === 0;
    const empty = isEmpty ? (
      // The one live region of the empty state (`StatePanel` has no role).
      <div
        aria-live="polite"
        className="size-full"
        data-slot="choropleth-chart-empty"
        role="status"
      >
        <StatePanel
          className="size-full gap-1 overflow-hidden py-2"
          description={emptyMessage}
          kind="empty"
          title={emptyTitle}
        />
      </div>
    ) : null;

    const renderMap = (onPlotWidth: (width: number) => void) => (
      <ParentSize debounceTime={10}>
        {({ width, height }) =>
          width > 0 && height > 0 ? (
            <ChoroplethChartInner
              animationDuration={animationDuration}
              center={center}
              data={renderData}
              empty={empty}
              enterTransition={enterTransition}
              fitToData={fitToData}
              height={height}
              initialZoom={initialZoom}
              keyboardNav={keyboardNav}
              margin={margin}
              onPlotWidth={onPlotWidth}
              revealSignature={revealSignature}
              scale={projectionScaleValue}
              thematic={thematic}
              translate={translate}
              width={width}
              zoomEnabled={zoomEnabled || Boolean(zoomControls)}
              zoomMax={zoomMax}
              zoomMin={zoomMin}
            >
              {children}
            </ChoroplethChartInner>
          ) : null
        }
      </ParentSize>
    );

    return (
      <ChartPlotRoot
        plotBox={stacked ? undefined : { aspectRatio, plotHeight, defaultPlotHeight: "16 / 9" }}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative w-full", className)}
        ref={ref}
        role={role}
        tabIndex={tabIndex}
      >
        <ChartA11yLabel descId={descId} description={accessibleDescription} />
        <ChoroplethInteractionShell>
          <ChoroplethBody
            features={validData ? renderData.features : []}
            isEmpty={Boolean(isEmpty)}
            legend={legend}
            plotBox={stacked ? { aspectRatio, plotHeight } : null}
            renderMap={renderMap}
            thematic={thematic}
          />
        </ChoroplethInteractionShell>
      </ChartPlotRoot>
    );
  },
);

ChoroplethChartBase.displayName = "ChoroplethChartBase";

/**
 * @dataShape a measure by geographic region
 * @avoidWhen there is no real geography — use a bar chart
 */
export const ChoroplethChart = forwardRef<HTMLDivElement, ChoroplethChartProps>(
  function ChoroplethChart(props, ref) {
    // Annotations — RM-111 on a map (RM-124): `x` is the longitude, `y` the latitude.
    return useAnnotatedChart(ChoroplethChartBase, props, ref, "context");
  },
);

ChoroplethChart.displayName = "ChoroplethChart";

export default ChoroplethChart;
