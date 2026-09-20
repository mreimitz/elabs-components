"use client";

import MapLibreGL from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./maps.css";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Spinner, StatePanel, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import { createPlanCrs, type PlanCrs, type PlanExtent } from "../lib/plan-crs";
import { warnMapOnce } from "../lib/warn-once";
import { MapContext, type BasemapTheme } from "./map-context";
import { useResolvedBasemapTheme } from "./use-resolved-basemap-theme";

/**
 * Default basemaps: Carto's free light/dark GL styles. These serve ODbL-licensed
 * OpenStreetMap data, which requires attribution on a public surface — see the
 * `attributionControl` note in the map constructor below.
 */
const defaultStyles = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

// A tile-less, dependency-free style with a transparent background. Use it for
// data visualizations (choropleths, arcs, dot maps) where you draw your own
// layers and don't need a street basemap: `<MapCanvas blank>`. The transparent
// background lets the themed container show through.
/** Breathing room, in CSS pixels, between a fitted plan and the viewport edge. */
const PLAN_FIT_PADDING = 24;

const blankMapStyle: MapLibreGL.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "transparent" },
    },
  ],
};

/** Map viewport state. */
export interface MapViewport {
  /** Center coordinates [longitude, latitude]. */
  center: [number, number];
  /** Zoom level. */
  zoom: number;
  /** Bearing (rotation) in degrees. */
  bearing: number;
  /** Pitch (tilt) in degrees. */
  pitch: number;
}

export type MapStyleOption = string | MapLibreGL.StyleSpecification;

/** The imperative handle exposed by `<MapCanvas ref>`: the MapLibre map itself. */
export type MapCanvasRef = MapLibreGL.Map;

export type MapCanvasProps = {
  children?: ReactNode;
  /** Additional CSS classes for the map container. */
  className?: string;
  /**
   * Basemap flavor. If not provided, it is derived from the active brand theme
   * (`data-theme` + that theme's own `color-scheme`), then a `dark`/`light` root class,
   * then the OS preference.
   */
  theme?: BasemapTheme;
  /** Custom map styles for light and dark themes. Overrides the default Carto styles. */
  styles?: {
    light?: MapStyleOption;
    dark?: MapStyleOption;
  };
  /**
   * Use a transparent, tile-less basemap instead of the default Carto street
   * basemap — a blank canvas. Used alone it renders nothing; add your own
   * layers on top (`<MapGeoJSON>`, `<MapArc>`, markers, …). Ideal for data
   * visualizations. Ignored when an explicit `styles` prop is provided.
   */
  blank?: boolean;
  /** Map projection type. Use `{ type: "globe" }` for a 3D globe view. */
  projection?: MapLibreGL.ProjectionSpecification;
  /**
   * Controlled viewport. When provided together with `onViewportChange`, the
   * map becomes controlled and the viewport is driven by this prop.
   */
  viewport?: Partial<MapViewport>;
  /**
   * Callback fired continuously as the viewport changes (pan, zoom, rotate,
   * pitch). Use standalone to observe changes, or with `viewport` for
   * controlled mode.
   */
  onViewportChange?: (viewport: MapViewport) => void;
  /** Show a loading overlay on the map (e.g. while the app fetches map data). */
  loading?: boolean;
  /**
   * Turn the canvas into a CUSTOM (non-geographic) plan map: a floor plan, a
   * factory layout, a train carriage, a rack elevation. Pass the plan's extent
   * (`{ width, height }` in the plan's own units) or a `createPlanCrs(…)`
   * result, and every layer inside then speaks PLAN coordinates instead of
   * lng/lat — shapes, routes, markers and popups alike.
   *
   * The plan is fitted on mount, pan and zoom are clamped to its extent, and
   * rotation and pitch are off (a rotated floor plan is unreadable). Pair it
   * with `blank` and, for a picture under the shapes, `<MapPlanImage>`.
   *
   * The plan coordinate system is synthesized on Web Mercator, so it is not a
   * georeference: distances belong to the plan, and a scale bar would lie.
   */
  plan?: PlanExtent | PlanCrs;
  /**
   * Fit a plan map to its extent on mount and whenever the extent changes
   * (default: true). Ignored on a geographic map, and skipped when the camera
   * is driven through `viewport`.
   */
  fitPlan?: boolean;
} & Omit<MapLibreGL.MapOptions, "container" | "style">;

function MapLoadingOverlay() {
  const { t } = useLocale();
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-xs">
      <Spinner label={t("maps.canvas.loading")} className="size-5" />
    </div>
  );
}

function getViewport(map: MapLibreGL.Map): MapViewport {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

/**
 * The root map surface — a token/theme-aware MapLibre GL canvas. Compose the
 * other `@elabs-ai/components-maps` components (markers, popups, controls, layers) as
 * children; they reach the map through context (`useMap`).
 *
 * The ref exposes the raw MapLibre `Map` instance for imperative work
 * (`flyTo`, `fitBounds`, …).
 */
export const MapCanvas = forwardRef<MapCanvasRef, MapCanvasProps>(function MapCanvas(
  {
    children,
    className,
    theme: themeProp,
    styles,
    blank = false,
    projection,
    viewport,
    onViewportChange,
    loading = false,
    plan: planProp,
    fitPlan = true,
    // Pulled out of `...props` so the constructor and the live plan-limit effect
    // below resolve them the same way.
    minZoom,
    maxZoom,
    maxBounds,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreGL.Map | null>(null);
  const [initFailed, setInitFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const currentStyleRef = useRef<MapStyleOption | null>(null);
  const styleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalUpdateRef = useRef(false);
  const { resolvedTheme, themeKey } = useResolvedBasemapTheme(themeProp);

  const isControlled = viewport !== undefined && onViewportChange !== undefined;

  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  // Read from the mount-only `styledata` handler below so a `projection` prop
  // change after mount isn't reapplied with the value captured at mount time.
  const projectionRef = useRef(projection);

  const mapStyles = useMemo(() => {
    // Explicit styles win. Otherwise `blank` opts into the transparent
    // tile-less basemap; with neither, fall back to the Carto defaults.
    if (styles) {
      return {
        dark: styles.dark ?? defaultStyles.dark,
        light: styles.light ?? defaultStyles.light,
      };
    }
    if (blank) {
      return { dark: blankMapStyle, light: blankMapStyle };
    }
    return defaultStyles;
  }, [styles, blank]);

  // Normalize `plan` from PRIMITIVES, so an inline `plan={{ width, height }}`
  // literal keeps a stable coordinate system instead of re-running every layer
  // effect on each render. A caller who passes their own memoized `PlanCrs`
  // keeps that identity untouched.
  const planIsCrs = typeof (planProp as PlanCrs | undefined)?.toLngLat === "function";
  const planExtent = planIsCrs ? undefined : (planProp as PlanExtent | undefined);
  const planWidth = planExtent?.width;
  const planHeight = planExtent?.height;
  const planOrigin = planExtent?.origin ?? "top-left";
  const planUnit = planExtent?.unit ?? "px";
  const derivedPlan = useMemo(
    () =>
      planWidth !== undefined && planHeight !== undefined
        ? createPlanCrs({
            width: planWidth,
            height: planHeight,
            origin: planOrigin,
            unit: planUnit,
          })
        : null,
    [planWidth, planHeight, planOrigin, planUnit],
  );
  const planCrs = planIsCrs ? ((planProp as PlanCrs) ?? null) : derivedPlan;

  // A plan is a flat drawing: the globe would bend it, so refuse the pairing
  // rather than render something the consumer cannot trust.
  const projectionIsGlobe = !!projection && projection.type !== "mercator";
  const effectiveProjection = planCrs && projectionIsGlobe ? undefined : projection;
  projectionRef.current = effectiveProjection;
  if (planCrs && projectionIsGlobe) {
    warnMapOnce(
      "plan-projection",
      `Ignored projection "${projection?.type}" on a plan map: a plan is flat, and only the mercator projection keeps it undistorted.`,
    );
  }

  // Camera options a plan needs. Merged UNDER `...props`, so an explicit prop
  // always wins.
  const planOptions = useMemo(() => {
    if (!planCrs) return null;
    return {
      minZoom: planCrs.minZoom,
      maxZoom: planCrs.maxZoom,
      maxBounds: planCrs.maxBounds() as MapLibreGL.LngLatBoundsLike,
      // A plan is 2D: rotation and tilt only make it harder to read.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      bearing: 0,
      pitch: 0,
      // A plan is usually embedded in a page, so don't swallow the wheel.
      cooperativeGestures: true,
    };
  }, [planCrs]);

  // Expose the map instance to the parent component.
  useImperativeHandle(ref, () => mapInstance as MapLibreGL.Map, [mapInstance]);

  const clearStyleTimeout = useCallback(() => {
    if (styleTimeoutRef.current) {
      clearTimeout(styleTimeoutRef.current);
      styleTimeoutRef.current = null;
    }
  }, []);

  // Initialize the map.
  useEffect(() => {
    if (!containerRef.current) return;

    const initialStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
    currentStyleRef.current = initialStyle;

    let map: MapLibreGL.Map;
    try {
      map = new MapLibreGL.Map({
        container: containerRef.current,
        style: initialStyle,
        renderWorldCopies: false,
        // Attribution control OFF by default — a maintainer decision for internal
        // use, taken deliberately and recorded in CHANGELOG.md + the map-components
        // rule. NOTE THE CONSTRAINT: the default Carto basemap serves OpenStreetMap
        // data, which is ODbL-licensed and requires the credit, and Carto's terms
        // require it too — so a surface that ships PUBLICLY on these tiles must turn
        // it back on with `attributionControl={{ compact: true }}` (it wins through
        // `...props` below), or move to tiles licensed without the requirement via
        // `styles` / `blank`.
        attributionControl: false,
        ...(planOptions ?? {}),
        // `bounds` fits the plan in the very first frame, so a plan map never
        // flashes at lng/lat 0,0 before the fit effect below runs. Skipped when
        // the caller drives the camera themselves.
        ...(planOptions && !viewport?.center
          ? {
              bounds: planCrs!.bounds as MapLibreGL.LngLatBoundsLike,
              fitBoundsOptions: { padding: PLAN_FIT_PADDING, animate: false },
            }
          : {}),
        ...(minZoom !== undefined ? { minZoom } : {}),
        ...(maxZoom !== undefined ? { maxZoom } : {}),
        ...(maxBounds !== undefined ? { maxBounds } : {}),
        ...props,
        ...viewport,
      });
    } catch {
      // MapLibre throws at construction when WebGL is unavailable (headless
      // browsers without GPU, remote desktops). Degrade to a quiet panel
      // instead of an unhandled render error.
      setInitFailed(true);
      return;
    }

    const styleDataHandler = () => {
      clearStyleTimeout();
      // Delay so the style is fully processed before layer operations — avoids
      // race conditions on setStyle without force-updating every layer.
      styleTimeoutRef.current = setTimeout(() => {
        setIsStyleLoaded(true);
        if (projectionRef.current) {
          map.setProjection(projectionRef.current);
        }
      }, 100);
    };
    // No-op under the default (`attributionControl: false` above). This exists for
    // the case a consumer turns the control back ON for a public surface: MapLibre
    // paints even a COMPACT control expanded on first render (`<details open>` +
    // `maplibregl-compact-show`), so the credits land as a text slab until someone
    // clicks the toggle. Collapse it to the labelled ⓘ button instead.
    const loadHandler = () => {
      setIsLoaded(true);
      map
        .getContainer()
        .querySelectorAll<HTMLDetailsElement>("details.maplibregl-ctrl-attrib[open]")
        .forEach((el) => {
          el.open = false;
        });
    };

    // Viewport change handler — skip if triggered by an internal update.
    const handleMove = () => {
      if (internalUpdateRef.current) return;
      onViewportChangeRef.current?.(getViewport(map));
    };

    map.on("load", loadHandler);
    map.on("styledata", styleDataHandler);
    map.on("move", handleMove);
    setMapInstance(map);

    return () => {
      clearStyleTimeout();
      map.off("load", loadHandler);
      map.off("styledata", styleDataHandler);
      map.off("move", handleMove);
      map.remove();
      setIsLoaded(false);
      setIsStyleLoaded(false);
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: map options are init-time; style/theme/projection changes are synced by the effects below
  }, []);

  // Sync controlled viewport to the map.
  useEffect(() => {
    if (!mapInstance || !isControlled || !viewport) return;
    if (mapInstance.isMoving()) return;

    const current = getViewport(mapInstance);
    const next = {
      center: viewport.center ?? current.center,
      zoom: viewport.zoom ?? current.zoom,
      bearing: viewport.bearing ?? current.bearing,
      pitch: viewport.pitch ?? current.pitch,
    };

    if (
      next.center[0] === current.center[0] &&
      next.center[1] === current.center[1] &&
      next.zoom === current.zoom &&
      next.bearing === current.bearing &&
      next.pitch === current.pitch
    ) {
      return;
    }

    internalUpdateRef.current = true;
    mapInstance.jumpTo(next);
    internalUpdateRef.current = false;
  }, [mapInstance, isControlled, viewport]);

  // Swap the basemap style when the theme flips.
  useEffect(() => {
    if (!mapInstance || !resolvedTheme) return;

    const newStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;

    if (currentStyleRef.current === newStyle) return;

    clearStyleTimeout();
    currentStyleRef.current = newStyle;
    setIsStyleLoaded(false);

    mapInstance.setStyle(newStyle, { diff: true });
  }, [mapInstance, resolvedTheme, mapStyles, clearStyleTimeout]);

  // Sync projection when the prop changes after mount.
  useEffect(() => {
    if (!mapInstance || !isStyleLoaded || !effectiveProjection) return;
    mapInstance.setProjection(effectiveProjection);
  }, [mapInstance, isStyleLoaded, effectiveProjection]);

  // Keep a plan map's camera limits live — unlike the geographic options above,
  // which are init-time. A plan's extent is often only known once its image has
  // decoded, and a multi-floor building can change it after mount.
  useEffect(() => {
    if (!mapInstance || !planCrs) return;
    mapInstance.setMinZoom(minZoom ?? planCrs.minZoom);
    mapInstance.setMaxZoom(maxZoom ?? planCrs.maxZoom);
    mapInstance.setMaxBounds((maxBounds ?? planCrs.maxBounds()) as MapLibreGL.LngLatBoundsLike);
  }, [mapInstance, planCrs, minZoom, maxZoom, maxBounds]);

  // Fit the plan once per extent. Keyed on the extent rather than on the object
  // so a floor swap at the same size does not yank the user's view.
  const fittedExtentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapInstance || !isLoaded || !planCrs || !fitPlan) return;
    if (isControlled || viewport?.center) return;

    const { width, height, origin } = planCrs.extent;
    const extentKey = `${width}x${height}:${origin}`;
    if (fittedExtentRef.current === extentKey) return;
    fittedExtentRef.current = extentKey;

    mapInstance.fitBounds(planCrs.bounds as MapLibreGL.LngLatBoundsLike, {
      padding: PLAN_FIT_PADDING,
      animate: false,
    });
  }, [mapInstance, isLoaded, planCrs, fitPlan, isControlled, viewport?.center]);

  const contextValue = useMemo(
    () => ({
      map: mapInstance,
      isLoaded: isLoaded && isStyleLoaded,
      resolvedTheme,
      themeKey,
      plan: planCrs,
      loading,
    }),
    [mapInstance, isLoaded, isStyleLoaded, resolvedTheme, themeKey, planCrs, loading],
  );

  if (initFailed) {
    return (
      <div className={cn("relative h-full w-full", className)}>
        <StatePanel
          kind="error"
          title={t("maps.canvas.unavailableTitle")}
          description={t("maps.canvas.unavailableDescription")}
          className="h-full"
        />
      </div>
    );
  }

  return (
    <MapContext.Provider value={contextValue}>
      <div ref={containerRef} className={cn("relative h-full w-full", className)}>
        {(!isLoaded || loading) && <MapLoadingOverlay />}
        {/* SSR-safe: children render only when the map exists on the client. */}
        {mapInstance && children}
      </div>
    </MapContext.Provider>
  );
});
