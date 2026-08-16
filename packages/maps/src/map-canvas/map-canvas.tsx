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
import { Spinner, StatePanel } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";

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
} & Omit<MapLibreGL.MapOptions, "container" | "style">;

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
 * other `@elabs/components-maps` components (markers, popups, controls, layers) as
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
    ...props
  },
  ref,
) {
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
        if (projection) {
          map.setProjection(projection);
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
    if (!mapInstance || !isStyleLoaded || !projection) return;
    mapInstance.setProjection(projection);
  }, [mapInstance, isStyleLoaded, projection]);

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
          title="Map unavailable"
          description="This browser can’t render WebGL maps."
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
