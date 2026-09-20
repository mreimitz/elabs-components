"use client";

import type MapLibreGL from "maplibre-gl";
import { useEffect, useId, useMemo } from "react";

import { useMap } from "../map-canvas/map-context";
import { useTokenColor } from "../lib/use-token-color";
import { createRouteArrowImage, routeArrowImageId } from "../lib/route-arrow";

/** Which way the route runs, drawn as chevrons along the line. */
export type MapRouteDirection = "none" | "forward" | "backward";

export interface MapRouteProps {
  /** Optional unique identifier for the route layer. */
  id?: string;
  /**
   * Array of [longitude, latitude] coordinate pairs defining the route — or, in
   * a `<MapCanvas plan>`, [x, y] pairs in plan units.
   */
  coordinates: [number, number][];
  /** Line color as a CSS color value. Defaults to the theme's `--primary` token. */
  color?: string;
  /** Line width in pixels (default: 3). */
  width?: number;
  /** Line opacity from 0 to 1 (default: 0.8). */
  opacity?: number;
  /** Dash pattern [dash length, gap length] for dashed lines. */
  dashArray?: [number, number];
  /**
   * Draw chevrons along the line to show which way it runs (default: "none").
   * A conveyor, a one-way aisle and a walking route all need this, and an arrow
   * is a second channel that greyscale keeps.
   */
  direction?: MapRouteDirection;
  /** Distance between chevrons in px (default: 80). */
  directionSpacing?: number;
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
  direction = "none",
  directionSpacing = 80,
  onClick,
  onMouseEnter,
  onMouseLeave,
  interactive = true,
}: MapRouteProps) {
  const { map, isLoaded, plan } = useMap();
  const autoId = useId();
  const id = propId ?? autoId;
  const sourceId = `route-source-${id}`;
  const layerId = `route-layer-${id}`;
  const arrowLayerId = `route-arrows-${id}`;
  const arrowImageId = routeArrowImageId(id);

  const primary = useTokenColor("--primary");
  const lineColor = color ?? primary;

  // On a plan map the pairs are plan units; on a geographic one they are handed
  // through untouched, identity included.
  const resolvedCoordinates = useMemo(
    () => (plan ? coordinates.map((point) => plan.toLngLat(point)) : coordinates),
    [plan, coordinates],
  );

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
    if (!isLoaded || !map || resolvedCoordinates.length < 2) return;

    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
    if (source) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: resolvedCoordinates },
      });
    }
  }, [isLoaded, map, resolvedCoordinates, sourceId]);

  // Direction chevrons: a generated icon, re-registered whenever the ink
  // changes, with the layer added only once the image really exists.
  useEffect(() => {
    if (!isLoaded || !map || direction === "none") return;

    const image = createRouteArrowImage(lineColor);
    if (!image) return;

    let cancelled = false;

    const register = () => {
      try {
        if (map.hasImage(arrowImageId)) {
          map.updateImage(arrowImageId, image as unknown as ImageData);
        } else {
          map.addImage(arrowImageId, image as unknown as ImageData, { pixelRatio: 2 });
        }
        if (!map.getLayer(arrowLayerId)) {
          map.addLayer({
            id: arrowLayerId,
            type: "symbol",
            source: sourceId,
            layout: {
              "symbol-placement": "line",
              "symbol-spacing": directionSpacing,
              "icon-image": arrowImageId,
              "icon-rotate": direction === "backward" ? 180 : 0,
              "icon-rotation-alignment": "map",
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
            paint: { "icon-opacity": opacity },
          });
        } else {
          map.setLayoutProperty(arrowLayerId, "symbol-spacing", directionSpacing);
          map.setLayoutProperty(arrowLayerId, "icon-rotate", direction === "backward" ? 180 : 0);
          map.setPaintProperty(arrowLayerId, "icon-opacity", opacity);
        }
      } catch {
        // style mid-reload; `styledata` re-runs this
      }
    };

    register();
    // A theme swap calls setStyle, which drops every style image AND every layer
    // this component added.
    const onStyleData = () => {
      if (!cancelled) register();
    };
    map.on("styledata", onStyleData);

    return () => {
      cancelled = true;
      map.off("styledata", onStyleData);
      try {
        if (map.getLayer(arrowLayerId)) map.removeLayer(arrowLayerId);
        if (map.hasImage(arrowImageId)) map.removeImage(arrowImageId);
      } catch {
        // style may be mid-reload
      }
    };
  }, [
    isLoaded,
    map,
    direction,
    directionSpacing,
    lineColor,
    opacity,
    sourceId,
    arrowLayerId,
    arrowImageId,
  ]);

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
