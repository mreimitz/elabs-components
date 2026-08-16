"use client";

import type MapLibreGL from "maplibre-gl";
import { useEffect, useId, useMemo, useRef } from "react";

import { useMap } from "../map-canvas/map-context";
import { mergeHoverPaint } from "../lib/merge-hover-paint";
import { useTokenColor } from "../lib/use-token-color";

export type MapGeoJSONData<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> =
  | GeoJSON.FeatureCollection<GeoJSON.Geometry, P>
  | GeoJSON.Feature<GeoJSON.Geometry, P>
  | GeoJSON.Geometry
  | string;

export type MapFillPaint = NonNullable<MapLibreGL.FillLayerSpecification["paint"]>;
export type MapLinePaint = NonNullable<MapLibreGL.LineLayerSpecification["paint"]>;

/** A rendered feature with strongly-typed `properties`. */
export type MapGeoJSONFeature<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> =
  Omit<MapLibreGL.MapGeoJSONFeature, "properties"> & { properties: P };

/** Event payload passed to MapGeoJSON interaction callbacks. */
export type MapGeoJSONEvent<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> = {
  /** The feature under the cursor, with its typed GeoJSON properties. */
  feature: MapGeoJSONFeature<P>;
  /** Longitude of the cursor at the time of the event. */
  longitude: number;
  /** Latitude of the cursor at the time of the event. */
  latitude: number;
  /** The underlying MapLibre mouse event for advanced use cases. */
  originalEvent: MapLibreGL.MapLayerMouseEvent;
};

export type MapGeoJSONProps<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> = {
  /** GeoJSON data (FeatureCollection, Feature, Geometry) or a URL to fetch it from. */
  data: MapGeoJSONData<P>;
  /** Optional unique identifier prefix for the source/layers. Auto-generated if not provided. */
  id?: string;
  /**
   * Feature property to promote to the feature `id`. Required for hover
   * feature-state (`fillHoverPaint`) and stable `onHover`/`onClick` payloads.
   */
  promoteId?: string;
  /**
   * Paint for the polygon fill layer. Merged on top of a theme-aware neutral
   * default (the `--border` token — a mid neutral that reads on the page
   * surface in every theme). Pass `false` to omit the fill layer entirely
   * (e.g. outlines only).
   */
  fillPaint?: MapFillPaint | false;
  /**
   * Paint for the outline layer. Merged on top of a hairline default
   * (`line-color` = the `--background` token, `line-width` = 0.5) for thin
   * separators. Override `line-color` if your container differs, or pass
   * `false` to omit the layer.
   */
  linePaint?: MapLinePaint | false;
  /**
   * Paint merged onto the fill layer for the feature under the cursor, applied
   * as a `case` expression keyed on hover feature-state. Requires `promoteId`.
   */
  fillHoverPaint?: MapFillPaint;
  /** Callback when a feature is clicked. */
  onClick?: (e: MapGeoJSONEvent<P>) => void;
  /** Callback fired when the hovered feature changes; `null` when the cursor leaves. */
  onHover?: (e: MapGeoJSONEvent<P> | null) => void;
  /** Whether features respond to mouse events (default: false). */
  interactive?: boolean;
  /** Optional MapLibre layer id to insert the layers before (z-order control). */
  beforeId?: string;
};

/**
 * Renders arbitrary GeoJSON as fill + outline layers on the map. Composes like
 * `MapRoute` / `MapArc` — drop it inside `<MapCanvas>` (typically with `blank`)
 * for choropleths and region/data maps. For full control over expressions and
 * multiple layers, manage layers directly via `useMap()` instead.
 */
export function MapGeoJSON<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties>({
  data,
  id: propId,
  promoteId,
  fillPaint,
  linePaint,
  fillHoverPaint,
  onClick,
  onHover,
  interactive = false,
  beforeId,
}: MapGeoJSONProps<P>) {
  const { map, isLoaded } = useMap();
  const autoId = useId();
  const id = propId ?? autoId;
  const sourceId = `geojson-source-${id}`;
  const fillLayerId = `geojson-fill-${id}`;
  const lineLayerId = `geojson-line-${id}`;

  // Theme-driven neutral defaults: landmass = the mid-neutral `--border` rung,
  // separators = the page surface. Both re-resolve on theme change.
  const defaultFill = useTokenColor("--border");
  const defaultLine = useTokenColor("--background");

  const showFill = fillPaint !== false;
  const showLine = linePaint !== false;

  const mergedFillPaint = useMemo(
    () => mergeHoverPaint({ "fill-color": defaultFill, ...(fillPaint || {}) }, fillHoverPaint),
    [defaultFill, fillPaint, fillHoverPaint],
  );
  const mergedLinePaint = useMemo(
    () => ({
      "line-color": defaultLine,
      "line-width": 0.5,
      ...(linePaint || {}),
    }),
    [defaultLine, linePaint],
  );
  const latestRef = useRef({ onClick, onHover });
  latestRef.current = { onClick, onHover };

  // Add source on mount.
  useEffect(() => {
    if (!isLoaded || !map) return;

    map.addSource(sourceId, {
      type: "geojson",
      data,
      ...(promoteId ? { promoteId } : {}),
    });

    return () => {
      try {
        if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // style may be mid-reload
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- source created once per map; data/layers are synced by the effects below
  }, [isLoaded, map]);

  // Sync data when it changes.
  useEffect(() => {
    if (!isLoaded || !map) return;
    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource | undefined;
    source?.setData(data as never);
  }, [isLoaded, map, data, sourceId]);

  // Sync layers and paint when visibility or styling changes.
  useEffect(() => {
    if (!isLoaded || !map) return;

    const source = map.getSource(sourceId);
    if (!source) return;

    if (showFill && !map.getLayer(fillLayerId)) {
      map.addLayer(
        {
          id: fillLayerId,
          type: "fill",
          source: sourceId,
          paint: mergedFillPaint,
        },
        beforeId,
      );
    } else if (!showFill && map.getLayer(fillLayerId)) {
      map.removeLayer(fillLayerId);
    }

    if (showLine && !map.getLayer(lineLayerId)) {
      map.addLayer(
        {
          id: lineLayerId,
          type: "line",
          source: sourceId,
          paint: mergedLinePaint,
        },
        beforeId,
      );
    } else if (!showLine && map.getLayer(lineLayerId)) {
      map.removeLayer(lineLayerId);
    }

    if (showFill && map.getLayer(fillLayerId)) {
      for (const [key, value] of Object.entries(mergedFillPaint)) {
        map.setPaintProperty(fillLayerId, key as keyof MapFillPaint, value as never);
      }
    }
    if (showLine && map.getLayer(lineLayerId)) {
      for (const [key, value] of Object.entries(mergedLinePaint)) {
        map.setPaintProperty(lineLayerId, key as keyof MapLinePaint, value as never);
      }
    }
  }, [
    isLoaded,
    map,
    sourceId,
    fillLayerId,
    lineLayerId,
    showFill,
    showLine,
    mergedFillPaint,
    mergedLinePaint,
    beforeId,
  ]);

  // Interaction handlers (bound to the fill layer).
  useEffect(() => {
    if (!isLoaded || !map || !interactive || !showFill) return;

    let hoveredId: string | number | null = null;

    const setHover = (next: string | number | null) => {
      if (next === hoveredId) return;
      const sourceExists = !!map.getSource(sourceId);
      if (hoveredId != null && sourceExists) {
        map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
      }
      hoveredId = next;
      if (next != null && sourceExists) {
        map.setFeatureState({ source: sourceId, id: next }, { hover: true });
      }
    };

    const handleMouseMove = (e: MapLibreGL.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      map.getCanvas().style.cursor = "pointer";

      const featureId = feature.id;
      if (featureId === hoveredId) return;
      setHover(featureId ?? null);
      latestRef.current.onHover?.({
        feature: feature as unknown as MapGeoJSONFeature<P>,
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        originalEvent: e,
      });
    };

    const handleMouseLeave = () => {
      setHover(null);
      map.getCanvas().style.cursor = "";
      latestRef.current.onHover?.(null);
    };

    const handleClick = (e: MapLibreGL.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      latestRef.current.onClick?.({
        feature: feature as unknown as MapGeoJSONFeature<P>,
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        originalEvent: e,
      });
    };

    map.on("mousemove", fillLayerId, handleMouseMove);
    map.on("mouseleave", fillLayerId, handleMouseLeave);
    map.on("click", fillLayerId, handleClick);

    return () => {
      map.off("mousemove", fillLayerId, handleMouseMove);
      map.off("mouseleave", fillLayerId, handleMouseLeave);
      map.off("click", fillLayerId, handleClick);
      setHover(null);
      map.getCanvas().style.cursor = "";
    };
  }, [isLoaded, map, fillLayerId, sourceId, interactive, showFill]);

  return null;
}
