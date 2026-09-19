"use client";

import { forwardRef, useEffect, useId, useState, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import { MapCanvas, type MapCanvasProps } from "../map-canvas/map-canvas";
import { useMap } from "../map-canvas/map-context";
import { type MapResponsive, useMapResponsive } from "../lib/use-map-breakpoint";
import { useTokenColor } from "../lib/use-token-color";
import { MAP_CORNER_CLASSES, type MapCorner } from "../map-legend/map-corner";

/** A globe with the main view marked, or a zoomed-out regional map around it. */
export type MapInsetKind = "globe" | "region";

export interface MapInsetProps extends HTMLAttributes<HTMLDivElement> {
  /** Default `"globe"`. */
  kind?: MapInsetKind;
  /** Corner of the main map (default `"top-right"`). */
  position?: MapCorner;
  /**
   * Side length in CSS px, optionally per tier (default
   * `{ base: 128, narrow: 88 }`). Never more than 40 % of the main map's width.
   */
  size?: MapResponsive<number>;
  /** Basemap styles for the inset (default: the main map's defaults). */
  styles?: MapCanvasProps["styles"];
  /** A tile-less inset — pair it with your own layers via `styles`. */
  blank?: boolean;
}

/** How many zoom levels a `region` inset sits below the main map. */
const REGION_ZOOM_OUT = 4;
/** Below this many px across, the main view is marked as a dot, not a box. */
const MIN_BOX_PX = 6;

interface MainView {
  center: [number, number];
  zoom: number;
  bounds: [west: number, south: number, east: number, north: number];
}

function readView(map: NonNullable<ReturnType<typeof useMap>["map"]>): MainView {
  const center = map.getCenter();
  const bounds = map.getBounds();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
  };
}

/** The zoom at which a globe fills ~90 % of a `width`-px box at `latitude`. */
function globeZoom(width: number, latitude: number): number {
  const scale = (0.9 * width * Math.PI * Math.cos((latitude * Math.PI) / 180)) / 512;
  return Math.log2(Math.max(scale, 1e-3));
}

/** Inside the inset canvas: follows the main view and marks its extent. */
function InsetFollower({ view, kind }: { view: MainView; kind: MapInsetKind }) {
  const { map, isLoaded } = useMap();
  const id = useId();
  const sourceId = `map-inset-view-${id}`;
  const lineId = `map-inset-box-${id}`;
  const fillId = `map-inset-fill-${id}`;
  const dotId = `map-inset-dot-${id}`;
  const accent = useTokenColor("--primary");
  const surface = useTokenColor("--background");

  useEffect(() => {
    if (!map || !isLoaded) return undefined;
    map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: fillId,
      type: "fill",
      source: sourceId,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": accent, "fill-opacity": 0.2 },
    });
    map.addLayer({
      id: lineId,
      type: "line",
      source: sourceId,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "line-color": accent, "line-width": 1.5 },
    });
    map.addLayer({
      id: dotId,
      type: "circle",
      source: sourceId,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": accent,
        "circle-radius": 3.5,
        "circle-stroke-color": surface,
        "circle-stroke-width": 1,
      },
    });
    return () => {
      try {
        for (const layer of [dotId, lineId, fillId])
          if (map.getLayer(layer)) map.removeLayer(layer);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // style may be mid-reload
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layers created once per load; colours synced below
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    if (map.getLayer(fillId)) map.setPaintProperty(fillId, "fill-color", accent);
    if (map.getLayer(lineId)) map.setPaintProperty(lineId, "line-color", accent);
    if (map.getLayer(dotId)) {
      map.setPaintProperty(dotId, "circle-color", accent);
      map.setPaintProperty(dotId, "circle-stroke-color", surface);
    }
  }, [map, isLoaded, accent, surface, fillId, lineId, dotId]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const width = map.getContainer().clientWidth;
    const zoom =
      kind === "globe"
        ? globeZoom(width, view.center[1])
        : Math.max(0, view.zoom - REGION_ZOOM_OUT);
    map.jumpTo({ center: view.center, zoom });

    const [west, south, east, north] = view.bounds;
    const a = map.project([west, north]);
    const b = map.project([east, south]);
    const small = Math.abs(b.x - a.x) < MIN_BOX_PX && Math.abs(b.y - a.y) < MIN_BOX_PX;
    const feature: GeoJSON.Feature = small
      ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: view.center } }
      : {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
              ],
            ],
          },
        };
    const source = map.getSource(sourceId) as { setData?: (data: unknown) => void } | undefined;
    source?.setData?.({ type: "FeatureCollection", features: [feature] });
  }, [map, isLoaded, kind, view, sourceId]);

  return null;
}

/**
 * MapInset — a small locator map in a corner of the main map: a globe
 * (`kind="globe"`) or a zoomed-out regional map (`kind="region"`), with the
 * main map's current view marked (a box, or a dot when the box would be too
 * small to see). It is a second, static `<MapCanvas>` that follows the main
 * view; decorative, so hidden from assistive tech and never a tab stop.
 * Render inside `<MapCanvas>`.
 */
export const MapInset = forwardRef<HTMLDivElement, MapInsetProps>(function MapInset(
  {
    kind = "globe",
    position = "top-right",
    size: sizeProp = { base: 128, narrow: 88 },
    styles,
    blank,
    className,
    style,
    ...props
  },
  ref,
) {
  const { map } = useMap();
  const size = Math.max(0, useMapResponsive(sizeProp));
  const [view, setView] = useState<MainView | null>(() => (map ? readView(map) : null));

  useEffect(() => {
    if (!map) return undefined;
    const update = () => setView(readView(map));
    update();
    map.on("moveend", update);
    map.on("resize", update);
    return () => {
      map.off("moveend", update);
      map.off("resize", update);
    };
  }, [map]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-slot="map-inset"
      data-kind={kind}
      className={cn(
        "pointer-events-none absolute z-10 overflow-hidden bg-background shadow-ring-sm",
        kind === "globe" ? "rounded-full" : "rounded-md",
        MAP_CORNER_CLASSES[position],
        className,
      )}
      style={{ width: size, maxWidth: "40%", aspectRatio: "1 / 1", ...style }}
      {...props}
    >
      {view && (
        <MapCanvas
          interactive={false}
          center={view.center}
          zoom={kind === "globe" ? 0 : Math.max(0, view.zoom - REGION_ZOOM_OUT)}
          minZoom={-2}
          projection={kind === "globe" ? "globe" : undefined}
          styles={styles}
          blank={blank}
        >
          <InsetFollower view={view} kind={kind} />
        </MapCanvas>
      )}
    </div>
  );
});
