"use client";

import type MapLibreGL from "maplibre-gl";
import { useEffect, useId, useMemo, useRef } from "react";

import { useMap } from "../map-canvas/map-context";
import { warnMapOnce } from "../lib/warn-once";

/**
 * The picture under a plan: a URL, or an already-decoded image, bitmap or
 * canvas. A `{ light, dark }` pair swaps with the active theme — a plan drawing
 * has its own baked-in ink, and one asset rarely reads well on both surfaces.
 */
export type MapPlanImageSource = string | HTMLImageElement | ImageBitmap | HTMLCanvasElement;

export type MapPlanImageProps = {
  /** The plan picture. Pass `{ light, dark }` to swap it with the theme. */
  src: MapPlanImageSource | { light: MapPlanImageSource; dark: MapPlanImageSource };
  /**
   * What the picture shows, for anyone who cannot see it ("Level 3 floor plan,
   * 14 rooms around a central core"). A plan drawn into WebGL has no accessible
   * name of its own, so this is the only description of it.
   */
  alt?: string;
  /** Optional identifier for the source/layer. Auto-generated if not provided. */
  id?: string;
  /**
   * Where the picture sits, in PLAN units. Defaults to the whole plan extent, so
   * a single full-bleed plan needs nothing here. Use it to place one wing, one
   * machine cell or one carriage inside a larger plan.
   */
  extent?: { x: number; y: number; width: number; height: number };
  /**
   * The four corners in lng/lat (top-left, top-right, bottom-right, bottom-left)
   * — an escape hatch that also works on an ordinary geographic canvas, like
   * Leaflet's `imageOverlay`. Wins over `extent`.
   */
  coordinates?: MapLibreGL.Coordinates;
  /**
   * Opacity, 0–1 (default 1). A photographic or ink-heavy plan usually reads
   * best held back around 0.35 so the data drawn on top stays the focus.
   */
  opacity?: number;
  /** Hide the picture without tearing the source down — a multi-floor switch (default true). */
  visible?: boolean;
  /** `"nearest"` keeps CAD line art crisp when zoomed past its native resolution. */
  resampling?: "linear" | "nearest";
  /** MapLibre layer id to insert this layer before (z-order control). */
  beforeId?: string;
  /** Fired once the picture has been fetched and decoded. */
  onLoad?: () => void;
  /** Fired when the picture cannot be loaded. The plan itself keeps working without it. */
  onError?: (error: Error) => void;
};

function isThemedSource(
  src: MapPlanImageProps["src"],
): src is { light: MapPlanImageSource; dark: MapPlanImageSource } {
  return typeof src === "object" && src !== null && "light" in src && "dark" in src;
}

/**
 * Draw a decoded image or bitmap into a canvas MapLibre can read. Returns
 * `null` when there is no 2D context (jsdom, a zero-sized canvas) — the plan
 * then renders without its picture rather than throwing.
 */
function toCanvas(source: Exclude<MapPlanImageSource, string>): HTMLCanvasElement | null {
  if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
    return source.width > 0 && source.height > 0 ? source : null;
  }

  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(source as CanvasImageSource, 0, 0);
  return canvas;
}

/**
 * The plan picture under the shapes — a floor plan, a factory layout, a deck
 * plan. The map equivalent of Qlik Sense's image background layer and Leaflet's
 * `imageOverlay`: by default it covers the whole plan extent declared on
 * `<MapCanvas plan>`, so its corners need no coordinates at all.
 *
 * Render it FIRST among the canvas children so the picture sits under the data,
 * or pin the order with `beforeId`.
 *
 * ```tsx
 * <MapCanvas blank plan={{ width: 2400, height: 1600, unit: "cm" }}>
 *   <MapPlanImage src={floorPlanUrl} alt="Level 3 floor plan" opacity={0.35} />
 *   <MapGeoJSON data={roomsInPlanUnits} promoteId="id" />
 * </MapCanvas>
 * ```
 *
 * A picture is optional and often worth skipping: a plan drawn as GeoJSON in
 * plan units paints from tokens, themes correctly, and never blurs.
 */
export function MapPlanImage({
  src,
  alt,
  id: propId,
  extent,
  coordinates,
  opacity = 1,
  visible = true,
  resampling = "linear",
  beforeId,
  onLoad,
  onError,
}: MapPlanImageProps) {
  const { map, isLoaded, plan, resolvedTheme } = useMap();
  const autoId = useId();
  const id = propId ?? autoId;
  const sourceId = `plan-image-source-${id}`;
  const layerId = `plan-image-layer-${id}`;

  const resolvedSrc = isThemedSource(src) ? (resolvedTheme === "dark" ? src.dark : src.light) : src;
  const url = typeof resolvedSrc === "string" ? resolvedSrc : null;
  const canvas = useMemo(
    () => (typeof resolvedSrc === "string" ? null : toCanvas(resolvedSrc)),
    [resolvedSrc],
  );

  const corners = useMemo<MapLibreGL.Coordinates | null>(() => {
    if (coordinates) return coordinates;
    if (!plan) return null;
    if (!extent) return plan.imageCoordinates;
    const { x, y, width, height } = extent;
    return [
      plan.toLngLat({ x, y }),
      plan.toLngLat({ x: x + width, y }),
      plan.toLngLat({ x: x + width, y: y + height }),
      plan.toLngLat({ x, y: y + height }),
    ];
  }, [coordinates, extent, plan]);

  // Keyed on the values, so an inline `extent` literal doesn't re-place the
  // picture on every render.
  const cornersKey = corners ? JSON.stringify(corners) : null;

  const latestRef = useRef({ corners, url, onLoad, onError });
  latestRef.current = { corners, url, onLoad, onError };

  if (!corners) {
    warnMapOnce(
      "plan-image-coordinates",
      "<MapPlanImage> needs somewhere to sit: set `plan` on <MapCanvas>, or pass `coordinates`.",
    );
  }
  if (!url && !canvas) {
    warnMapOnce(
      "plan-image-source",
      "<MapPlanImage> could not read its `src`. Pass a URL, or an image/bitmap/canvas that has already decoded.",
    );
  }

  // Read paint through refs so changing it never re-creates the source below.
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const resamplingRef = useRef(resampling);
  resamplingRef.current = resampling;

  // Add the source + layer. Deliberately NOT keyed on the url or the corners:
  // those are updated in place below, so a floor swap never refetches.
  useEffect(() => {
    if (!isLoaded || !map) return;
    const { corners: initialCorners, url: initialUrl } = latestRef.current;
    if (!initialCorners || (!initialUrl && !canvas)) return;

    map.addSource(
      sourceId,
      canvas
        ? { type: "canvas", canvas, coordinates: initialCorners, animate: false }
        : { type: "image", url: initialUrl as string, coordinates: initialCorners },
    );
    map.addLayer(
      {
        id: layerId,
        type: "raster",
        source: sourceId,
        paint: {
          "raster-opacity": opacityRef.current,
          // A plan swap should replace the picture, not cross-fade it.
          "raster-fade-duration": 0,
          "raster-resampling": resamplingRef.current,
        },
      },
      beforeId,
    );

    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // style may be mid-reload
      }
    };
    // Deps deliberately exclude url/corners/paint: all three are read from
    // `latestRef` or refs and synced in place by the effects below.
  }, [isLoaded, map, sourceId, layerId, canvas, beforeId]);

  // Move the picture when its placement changes.
  useEffect(() => {
    if (!isLoaded || !map || !cornersKey) return;
    const source = map.getSource(sourceId) as MapLibreGL.ImageSource | undefined;
    source?.setCoordinates?.(latestRef.current.corners as MapLibreGL.Coordinates);
  }, [isLoaded, map, sourceId, cornersKey]);

  // Swap the picture in place — no teardown, no flash, no refetch of the rest.
  const mountedUrlRef = useRef<string | null>(url);
  useEffect(() => {
    if (!isLoaded || !map || !url) return;
    if (mountedUrlRef.current === url) return;
    mountedUrlRef.current = url;
    const source = map.getSource(sourceId) as MapLibreGL.ImageSource | undefined;
    source?.updateImage?.({
      url,
      ...(latestRef.current.corners ? { coordinates: latestRef.current.corners } : {}),
    });
  }, [isLoaded, map, sourceId, url]);

  // Paint and visibility.
  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return;
    map.setPaintProperty(layerId, "raster-opacity", opacity);
    map.setPaintProperty(layerId, "raster-resampling", resampling);
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }, [isLoaded, map, layerId, opacity, resampling, visible]);

  // Load and failure are reported by the SOURCE, not the map: a map-level error
  // carries no source id. The plan keeps working without its picture, so the
  // consumer owns whatever the failure should look like.
  useEffect(() => {
    if (!isLoaded || !map) return;
    const source = map.getSource(sourceId) as
      | (MapLibreGL.ImageSource & {
          on?: (event: string, handler: (payload: unknown) => void) => void;
          off?: (event: string, handler: (payload: unknown) => void) => void;
        })
      | undefined;
    if (!source?.on) return;

    const handleData = (payload: unknown) => {
      if ((payload as { sourceDataType?: string } | undefined)?.sourceDataType !== "metadata") {
        return;
      }
      latestRef.current.onLoad?.();
    };
    const handleError = (payload: unknown) => {
      const error = (payload as { error?: Error } | undefined)?.error;
      latestRef.current.onError?.(error instanceof Error ? error : new Error("Plan image failed"));
    };

    source.on("data", handleData);
    source.on("error", handleError);

    return () => {
      source.off?.("data", handleData);
      source.off?.("error", handleError);
    };
  }, [isLoaded, map, sourceId]);

  // The picture lives in WebGL, where assistive technology cannot reach it. This
  // span is its only description — and the module's stable selector seam.
  return alt ? (
    <span data-slot="map-plan-image" className="sr-only">
      {alt}
    </span>
  ) : (
    <span data-slot="map-plan-image" hidden />
  );
}
