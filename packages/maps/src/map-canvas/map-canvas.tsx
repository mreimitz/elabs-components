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

import { MapContext, type BasemapTheme } from "./map-context";
import { useResolvedBasemapTheme } from "./use-resolved-basemap-theme";
import {
  MapFrameContext,
  type MapFrameContextValue,
  type MapFrameSide,
  type MapHeight,
  type MapResponsive,
  mapBreakpointForWidth,
  resolveMapHeightStyle,
  useMeasuredMapBreakpoint,
} from "../lib/use-map-breakpoint";
import {
  MapAnnotationKey,
  MapAnnotationRegistryProvider,
  useMapAnnotationRegistry,
} from "../map-annotation/map-annotation";

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

/** `"mercator"` / `"globe"`, or a full MapLibre projection spec. */
export type MapProjectionOption = "mercator" | "globe" | MapLibreGL.ProjectionSpecification;

/** The gesture handlers static mode switches off (tooltips and hover keep working). */
const GESTURE_HANDLERS = [
  "scrollZoom",
  "boxZoom",
  "dragRotate",
  "dragPan",
  "keyboard",
  "doubleClickZoom",
  "touchZoomRotate",
  "touchPitch",
] as const;

type GestureHandlerKey = (typeof GESTURE_HANDLERS)[number];

const STATIC_HANDLER_OPTIONS = Object.fromEntries(
  GESTURE_HANDLERS.map((key) => [key, false]),
) as Record<GestureHandlerKey, false>;

let warnedProjection = false;

/**
 * Apply a projection when this MapLibre build supports switching one
 * (`setProjection`, MapLibre 5+); otherwise leave the map as it is and say so
 * once — a globe is an extra, never a requirement.
 */
function applyProjection(map: MapLibreGL.Map, projection: MapLibreGL.ProjectionSpecification) {
  if (typeof map.setProjection !== "function") {
    if (!warnedProjection) {
      warnedProjection = true;
      console.warn(
        "[@elabs-ai/components-maps] This MapLibre build cannot switch projections; `projection` is ignored.",
      );
    }
    return;
  }
  map.setProjection(projection);
}

/**
 * Hide (or restore) the basemap's OWN text labels — every symbol layer that
 * draws a `text-field` (c-6 / c-11).
 *
 * A basemap's labels are drawn for a full-size map. Inside a 96 px inset they
 * are sliced mid-word by the frame ("EUROP", "AMERIC") and louder than the
 * globe they caption; on a locator they print a place name the editorial
 * marker names again 16 px away. Both are the Datawrapper recipe's answer:
 * the basemap draws the ground, the map's own labels do the naming.
 *
 * `hidden` records what THIS call turned off, so restoring never reveals a
 * layer the style itself shipped hidden.
 */
function applyBasemapLabels(map: MapLibreGL.Map, visible: boolean, hidden: Set<string>) {
  let style: MapLibreGL.StyleSpecification | undefined;
  try {
    style = map.getStyle?.();
  } catch {
    // style mid-reload
    return;
  }
  if (!style?.layers) return;
  if (visible) {
    for (const id of hidden) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
    }
    hidden.clear();
    return;
  }
  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    if (!layer.layout || !("text-field" in layer.layout)) continue;
    if (hidden.has(layer.id)) continue;
    if (map.getLayoutProperty?.(layer.id, "visibility") === "none") continue;
    map.setLayoutProperty(layer.id, "visibility", "none");
    hidden.add(layer.id);
  }
}

/** A box's measured size as a comparable key, or `null` while it has none. */
function boxSize(node: HTMLElement): string | null {
  const { width, height } = node.getBoundingClientRect();
  if (!(width > 0) || !(height > 0)) return null;
  return `${Math.round(width)}×${Math.round(height)}`;
}

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
  /**
   * Draw the basemap's own place labels. `false` leaves the ground and hides
   * every text label the basemap style carries, so the map's own labels
   * (`MapMarker`'s `label`, `MapAnnotation`) are the only naming on it — the
   * locator recipe, and the default inside `MapInset`, where a full-size
   * label is sliced by the frame. Default `true`.
   */
  basemapLabels?: boolean;
  /**
   * Map projection: `"mercator"` (MapLibre's default) or `"globe"` for a 3D
   * globe view, or a full MapLibre projection spec. Feature-detected: a
   * MapLibre build that cannot switch projections ignores it (with a console
   * note).
   */
  projection?: MapProjectionOption;
  /**
   * `false` makes the map STATIC — the editorial / locator default: no zoom,
   * pan, rotate or keyboard handlers, the default cursor and no tab stop
   * (leave `<MapControls>` out of a static map). Hover and click still reach
   * layers and markers, so tooltips keep working. The viewport can still be set in code
   * (`viewport`, the ref). Default `true`.
   */
  interactive?: boolean;
  /**
   * The map's height: CSS px, or `{ aspect }` (width ÷ height), optionally per
   * tier — `{ base: { aspect: 1.6 }, narrow: { aspect: 1 } }`. Tiers are
   * measured on the map's own width (`narrow` < 480 px, `medium` < 768 px).
   * Unset, the map fills its parent as before; a parent with no height of its
   * own gets `DEFAULT_MAP_HEIGHT` (1.6 : 1, square at `narrow`) instead of 0.
   */
  height?: MapResponsive<MapHeight>;
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
} & Omit<MapLibreGL.MapOptions, "container" | "style" | "interactive">;

function MapLoadingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-xs">
      <Spinner label="Loading map" className="size-5" />
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
    basemapLabels = true,
    projection: projectionProp,
    viewport,
    onViewportChange,
    loading = false,
    interactive,
    height,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const setContainer = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainerNode(node);
  }, []);
  const breakpoint = useMeasuredMapBreakpoint(containerNode);
  const isStatic = interactive === false;
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

  // A string shorthand becomes a stable spec object; a spec object passes
  // through as given.
  const projection = useMemo<MapLibreGL.ProjectionSpecification | undefined>(
    () => (typeof projectionProp === "string" ? { type: projectionProp } : projectionProp),
    [projectionProp],
  );

  // Read from the mount-only `styledata` handler below so a `projection` prop
  // change after mount isn't reapplied with the value captured at mount time.
  const projectionRef = useRef(projection);
  projectionRef.current = projection;

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

  // Expose the map instance to the parent component.
  useImperativeHandle(ref, () => mapInstance as MapLibreGL.Map, [mapInstance]);

  const clearStyleTimeout = useCallback(() => {
    if (styleTimeoutRef.current) {
      clearTimeout(styleTimeoutRef.current);
      styleTimeoutRef.current = null;
    }
  }, []);

  const heightRef = useRef(height);
  heightRef.current = height;

  // ── Keeping a bounds-framed map framed ─────────────────────────────────────
  // MapLibre fits `bounds` ONCE, against the box it measures at construction.
  // A box that settles later — a responsive height resolving after the first
  // paint, a side panel opening, a tier flip — leaves the viewport fitted to a
  // rectangle that no longer exists (a 348×218 fit kept on a 348×348 box put
  // North America on a Lake Ontario locator). So: re-fit whenever the box
  // changes size, until someone moves the map themselves.
  const { bounds, fitBoundsOptions } = props;
  const refitRef = useRef({ bounds, fitBoundsOptions });
  refitRef.current = { bounds, fitBoundsOptions };
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  /** `true` once a gesture (or the controlled `viewport`) owns the viewport. */
  const userMovedRef = useRef(false);
  /** The box size the current viewport was fitted against. */
  const fittedSizeRef = useRef<string | null>(null);

  const syncBox = useCallback((map: MapLibreGL.Map, node: HTMLElement) => {
    const size = boxSize(node);
    if (!size || size === fittedSizeRef.current) return;
    fittedSizeRef.current = size;
    map.resize();
    const { bounds: currentBounds, fitBoundsOptions: currentOptions } = refitRef.current;
    if (!currentBounds || userMovedRef.current || isControlledRef.current) return;
    map.fitBounds(currentBounds, { ...currentOptions, duration: 0 });
  }, []);

  // Initialize the map.
  useEffect(() => {
    if (!containerRef.current) return;

    // The tier is measured in a layout effect whose re-render lands AFTER this
    // effect, so the box may still carry the wide-tier height here. Size it for
    // its real tier first: MapLibre sizes its canvas (and fits `bounds`) from
    // the box at construction, and drops the first resize it observes.
    Object.assign(
      containerRef.current.style,
      resolveMapHeightStyle(
        heightRef.current,
        mapBreakpointForWidth(containerRef.current.getBoundingClientRect().width),
      ),
    );

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
        ...props,
        ...viewport,
        // Static mode: gestures off, but MapLibre's own `interactive` stays on —
        // it would detach EVERY listener, tooltips and hover included.
        ...(isStatic ? STATIC_HANDLER_OPTIONS : {}),
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
          applyProjection(map, projectionRef.current);
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

    // A gesture carries the DOM event that caused it; our own `fitBounds` /
    // `jumpTo` does not. Once a person has moved the map, a later box change
    // resizes the canvas but must never yank the view back to `bounds`.
    const handleMoveStart = (event?: { originalEvent?: unknown }) => {
      if (event?.originalEvent) userMovedRef.current = true;
    };

    // The size the constructor fitted `bounds` against — the baseline every
    // later box change is compared to.
    fittedSizeRef.current = boxSize(containerRef.current);

    map.on("load", loadHandler);
    map.on("styledata", styleDataHandler);
    map.on("move", handleMove);
    map.on("movestart", handleMoveStart);
    setMapInstance(map);

    return () => {
      clearStyleTimeout();
      map.off("load", loadHandler);
      map.off("styledata", styleDataHandler);
      map.off("move", handleMove);
      map.off("movestart", handleMoveStart);
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
    if (!mapInstance || !isStyleLoaded || !projection) return;
    applyProjection(mapInstance, projection);
  }, [mapInstance, isStyleLoaded, projection]);

  // Basemap labels on / off (c-6, c-11). Re-runs after every style load, so a
  // theme flip (which swaps the whole style) does not bring the labels back.
  const hiddenLabelLayersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!mapInstance || !isStyleLoaded) return;
    applyBasemapLabels(mapInstance, basemapLabels, hiddenLabelLayersRef.current);
  }, [mapInstance, isStyleLoaded, basemapLabels, themeKey]);

  // Static mode on / off after mount. Untouched until the map is first made
  // static, so an interactive map keeps MapLibre's own setup exactly.
  const handlerOptionsRef = useRef<Partial<Record<GestureHandlerKey, unknown>>>(props);
  handlerOptionsRef.current = props;
  const wasStaticRef = useRef(false);
  useEffect(() => {
    if (!mapInstance) return;
    if (!isStatic && !wasStaticRef.current) return;
    wasStaticRef.current = true;
    for (const key of GESTURE_HANDLERS) {
      const handler = mapInstance[key] as { enable?: () => void; disable?: () => void } | undefined;
      if (isStatic) handler?.disable?.();
      else if (handlerOptionsRef.current[key] !== false) handler?.enable?.();
    }
    // MapLibre's grab cursor hangs off this class; a static map keeps the
    // default arrow (a layer's hover still sets its own pointer on the canvas).
    mapInstance.getCanvasContainer().classList.toggle("maplibregl-interactive", !isStatic);
    mapInstance.getCanvas().tabIndex = isStatic ? -1 : 0;
  }, [mapInstance, isStatic]);

  // c-10: the canvas is a tab stop MapLibre owns, so before this it painted
  // the BROWSER's default focus ring (`1px auto rgb(0, 95, 204)` in light,
  // `rgb(153, 200, 255)` in dark) — visible, but not the theme's. The house
  // indicator is a utility class, so the element simply wears it.
  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.getCanvas()?.classList.add("focus-ring");
  }, [mapInstance]);

  // Watch the box: any size change resizes the canvas and re-fits `bounds`.
  useEffect(() => {
    if (!mapInstance || !containerNode) return undefined;
    const sync = () => syncBox(mapInstance, containerNode);
    sync();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(sync);
    observer.observe(containerNode);
    return () => observer.disconnect();
  }, [mapInstance, containerNode, syncBox]);

  // A tier change can swap the box's height (the default goes square at
  // `narrow`); sync at commit rather than wait on the observer's next frame.
  const heightStyle = resolveMapHeightStyle(height, breakpoint);
  const heightKey = `${heightStyle.height ?? ""}|${heightStyle.aspectRatio ?? ""}`;
  const appliedHeightKeyRef = useRef(heightKey);
  useEffect(() => {
    if (!mapInstance || !containerNode || heightKey === appliedHeightKeyRef.current) return;
    appliedHeightKeyRef.current = heightKey;
    syncBox(mapInstance, containerNode);
  }, [mapInstance, containerNode, heightKey, syncBox]);

  // Furniture outside the map box (legends `above` / `below`, the narrow
  // annotation key) portals into strips rendered only while something asks.
  const [slotRequests, setSlotRequests] = useState<Record<MapFrameSide, number>>({
    above: 0,
    below: 0,
  });
  const [aboveEl, setAboveEl] = useState<HTMLDivElement | null>(null);
  const [belowEl, setBelowEl] = useState<HTMLDivElement | null>(null);
  const requestSlot = useCallback((side: MapFrameSide) => {
    setSlotRequests((prev) => ({ ...prev, [side]: prev[side] + 1 }));
    return () => setSlotRequests((prev) => ({ ...prev, [side]: Math.max(0, prev[side] - 1) }));
  }, []);
  const frameValue = useMemo<MapFrameContextValue>(
    () => ({
      breakpoint,
      interactive: !isStatic,
      slots: { above: aboveEl, below: belowEl },
      requestSlot,
    }),
    [breakpoint, isStatic, aboveEl, belowEl, requestSlot],
  );
  const annotations = useMapAnnotationRegistry(breakpoint);
  const showBelow = slotRequests.below > 0 || annotations.rows.length > 0;

  const contextValue = useMemo(
    () => ({
      map: mapInstance,
      isLoaded: isLoaded && isStyleLoaded,
      resolvedTheme,
      themeKey,
    }),
    [mapInstance, isLoaded, isStyleLoaded, resolvedTheme, themeKey],
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
      <MapFrameContext.Provider value={frameValue}>
        <MapAnnotationRegistryProvider value={annotations.value}>
          {slotRequests.above > 0 && (
            <div ref={setAboveEl} data-slot="map-canvas-above" className="pb-2" />
          )}
          <div
            ref={setContainer}
            data-slot="map-canvas"
            data-map-breakpoint={breakpoint}
            data-interactive={isStatic ? "false" : undefined}
            className={cn("relative h-full w-full", className)}
            style={heightStyle}
          >
            {(!isLoaded || loading) && <MapLoadingOverlay />}
            {/* SSR-safe: children render only when the map exists on the client. */}
            {mapInstance && children}
          </div>
          {showBelow && (
            <div data-slot="map-canvas-below" className="flex flex-col gap-2 pt-2">
              <div ref={setBelowEl} data-slot="map-canvas-below-furniture" className="contents" />
              {annotations.rows.length > 0 && <MapAnnotationKey rows={annotations.rows} />}
            </div>
          )}
        </MapAnnotationRegistryProvider>
      </MapFrameContext.Provider>
    </MapContext.Provider>
  );
});
