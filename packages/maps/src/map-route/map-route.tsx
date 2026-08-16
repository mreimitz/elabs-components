"use client";

import type MapLibreGL from "maplibre-gl";
import { useEffect, useId } from "react";

import { useMap } from "../map-canvas/map-context";
import { useTokenColor } from "../lib/use-token-color";

export interface MapRouteProps {
  /** Optional unique identifier for the route layer. */
  id?: string;
  /** Array of [longitude, latitude] coordinate pairs defining the route. */
  coordinates: [number, number][];
  /** Line color as a CSS color value. Defaults to the theme's `--primary` token. */
  color?: string;
  /** Line width in pixels (default: 3). */
  width?: number;
  /** Line opacity from 0 to 1 (default: 0.8). */
  opacity?: number;
  /** Dash pattern [dash length, gap length] for dashed lines. */
  dashArray?: [number, number];
  /** Callback when the route line is clicked. */
  onClick?: () => void;
  /** Callback when the mouse enters the route line. */
  onMouseEnter?: () => void;
  /** Callback when the mouse leaves the route line. */
  onMouseLeave?: () => void;
  /** Whether the route is interactive — shows a pointer cursor on hover (default: true). */
  interactive?: boolean;
}

/** A GeoJSON line layer for routes/paths. Renders nothing itself — it draws on the map. */
export function MapRoute({
  id: propId,
  coordinates,
  color,
  width = 3,
  opacity = 0.8,
  dashArray,
  onClick,
  onMouseEnter,
  onMouseLeave,
  interactive = true,
}: MapRouteProps) {
  const { map, isLoaded } = useMap();
  const autoId = useId();
  const id = propId ?? autoId;
  const sourceId = `route-source-${id}`;
  const layerId = `route-layer-${id}`;

  const primary = useTokenColor("--primary");
  const lineColor = color ?? primary;

  // Add source and layer on mount.
  useEffect(() => {
    if (!isLoaded || !map) return;

    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [] },
      },
    });

    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": lineColor,
        "line-width": width,
        "line-opacity": opacity,
        ...(dashArray && { "line-dasharray": dashArray }),
      },
    });

    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // style may be mid-reload
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- source/layer created once per map; data + paint are synced by the effects below
  }, [isLoaded, map]);

  // When coordinates change, update the source data.
  useEffect(() => {
    if (!isLoaded || !map || coordinates.length < 2) return;

    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
    if (source) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates },
      });
    }
  }, [isLoaded, map, coordinates, sourceId]);

  // Sync paint when styling (or the resolved theme color) changes.
  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return;

    map.setPaintProperty(layerId, "line-color", lineColor);
    map.setPaintProperty(layerId, "line-width", width);
    map.setPaintProperty(layerId, "line-opacity", opacity);
    map.setPaintProperty(layerId, "line-dasharray", dashArray);
  }, [isLoaded, map, layerId, lineColor, width, opacity, dashArray]);

  // Handle click and hover events.
  useEffect(() => {
    if (!isLoaded || !map || !interactive) return;

    const handleClick = () => {
      onClick?.();
    };
    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
      onMouseEnter?.();
    };
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      onMouseLeave?.();
    };

    map.on("click", layerId, handleClick);
    map.on("mouseenter", layerId, handleMouseEnter);
    map.on("mouseleave", layerId, handleMouseLeave);

    return () => {
      map.off("click", layerId, handleClick);
      map.off("mouseenter", layerId, handleMouseEnter);
      map.off("mouseleave", layerId, handleMouseLeave);
    };
  }, [isLoaded, map, layerId, onClick, onMouseEnter, onMouseLeave, interactive]);

  return null;
}
