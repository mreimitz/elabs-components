"use client";

import type MapLibreGL from "maplibre-gl";
import { useEffect, useId, useMemo } from "react";

import { useMap } from "../map-canvas/map-context";
import { useTokenColor } from "../lib/use-token-color";

export type MapClusterLayerProps<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties> =
  {
    /** GeoJSON FeatureCollection data or a URL to fetch GeoJSON from. */
    data: string | GeoJSON.FeatureCollection<GeoJSON.Point, P>;
    /** Maximum zoom level to cluster points on (default: 14). */
    clusterMaxZoom?: number;
    /** Radius of each cluster when clustering points, in pixels (default: 50). */
    clusterRadius?: number;
    /**
     * Colors for cluster circles: [small, medium, large] based on point count.
     * Defaults to the theme's `--success`/`--warning`/`--destructive` tokens.
     */
    clusterColors?: [string, string, string];
    /** Point-count thresholds for the color/size steps: [medium, large] (default: [100, 750]). */
    clusterThresholds?: [number, number];
    /** Color for unclustered individual points. Defaults to the theme's `--primary` token. */
    pointColor?: string;
    /** Callback when an unclustered point is clicked. */
    onPointClick?: (
      feature: GeoJSON.Feature<GeoJSON.Point, P>,
      coordinates: [number, number],
    ) => void;
    /** Callback when a cluster is clicked. If not provided, zooms into the cluster. */
    onClusterClick?: (clusterId: number, coordinates: [number, number], pointCount: number) => void;
  };

const DEFAULT_CLUSTER_THRESHOLDS: [number, number] = [100, 750];

/**
 * Clustered point rendering for large point datasets. Cluster circles step
 * through the status tokens (success → warning → destructive) as the point
 * count grows; strokes and count labels use the page surface for contrast.
 */
export function MapClusterLayer<P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties>({
  data,
  clusterMaxZoom = 14,
  clusterRadius = 50,
  clusterColors,
  clusterThresholds = DEFAULT_CLUSTER_THRESHOLDS,
  pointColor,
  onPointClick,
  onClusterClick,
}: MapClusterLayerProps<P>) {
  const { map, isLoaded } = useMap();
  const id = useId();
  const sourceId = `cluster-source-${id}`;
  const clusterLayerId = `clusters-${id}`;
  const clusterCountLayerId = `cluster-count-${id}`;
  const unclusteredLayerId = `unclustered-point-${id}`;

  const success = useTokenColor("--success");
  const warning = useTokenColor("--warning");
  const destructive = useTokenColor("--destructive");
  const primary = useTokenColor("--primary");
  const surface = useTokenColor("--background");

  const resolvedClusterColors = useMemo<[string, string, string]>(
    () => clusterColors ?? [success, warning, destructive],
    [clusterColors, success, warning, destructive],
  );
  const resolvedPointColor = pointColor ?? primary;

  // Add source and layers on mount.
  useEffect(() => {
    if (!isLoaded || !map) return;

    map.addSource(sourceId, {
      type: "geojson",
      data,
      cluster: true,
      clusterMaxZoom,
      clusterRadius,
    });

    map.addLayer({
      id: clusterLayerId,
      type: "circle",
      source: sourceId,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          resolvedClusterColors[0],
          clusterThresholds[0],
          resolvedClusterColors[1],
          clusterThresholds[1],
          resolvedClusterColors[2],
        ],
        "circle-radius": [
          "step",
          ["get", "point_count"],
          20,
          clusterThresholds[0],
          30,
          clusterThresholds[1],
          40,
        ],
        "circle-stroke-width": 1,
        "circle-stroke-color": surface,
        "circle-opacity": 0.85,
      },
    });

    map.addLayer({
      id: clusterCountLayerId,
      type: "symbol",
      source: sourceId,
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Open Sans"],
        "text-size": 12,
      },
      paint: {
        "text-color": surface,
      },
    });

    map.addLayer({
      id: unclusteredLayerId,
      type: "circle",
      source: sourceId,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": resolvedPointColor,
        "circle-radius": 5,
        "circle-stroke-width": 2,
        "circle-stroke-color": surface,
      },
    });

    return () => {
      try {
        if (map.getLayer(clusterCountLayerId)) map.removeLayer(clusterCountLayerId);
        if (map.getLayer(unclusteredLayerId)) map.removeLayer(unclusteredLayerId);
        if (map.getLayer(clusterLayerId)) map.removeLayer(clusterLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // style may be mid-reload
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- source/layers created once per map; data + paint are synced by the effects below
  }, [isLoaded, map, sourceId]);

  // Update source data when the data prop changes (only for non-URL data).
  useEffect(() => {
    if (!isLoaded || !map || typeof data === "string") return;

    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
    if (source) {
      source.setData(data);
    }
  }, [isLoaded, map, data, sourceId]);

  // Sync layer styles when props (or the resolved theme colors) change.
  useEffect(() => {
    if (!isLoaded || !map) return;

    if (map.getLayer(clusterLayerId)) {
      map.setPaintProperty(clusterLayerId, "circle-color", [
        "step",
        ["get", "point_count"],
        resolvedClusterColors[0],
        clusterThresholds[0],
        resolvedClusterColors[1],
        clusterThresholds[1],
        resolvedClusterColors[2],
      ]);
      map.setPaintProperty(clusterLayerId, "circle-radius", [
        "step",
        ["get", "point_count"],
        20,
        clusterThresholds[0],
        30,
        clusterThresholds[1],
        40,
      ]);
      map.setPaintProperty(clusterLayerId, "circle-stroke-color", surface);
    }

    if (map.getLayer(clusterCountLayerId)) {
      map.setPaintProperty(clusterCountLayerId, "text-color", surface);
    }

    if (map.getLayer(unclusteredLayerId)) {
      map.setPaintProperty(unclusteredLayerId, "circle-color", resolvedPointColor);
      map.setPaintProperty(unclusteredLayerId, "circle-stroke-color", surface);
    }
  }, [
    isLoaded,
    map,
    clusterLayerId,
    clusterCountLayerId,
    unclusteredLayerId,
    resolvedClusterColors,
    clusterThresholds,
    resolvedPointColor,
    surface,
  ]);

  // Handle click events.
  useEffect(() => {
    if (!isLoaded || !map) return;

    // Cluster click handler — zoom into the cluster by default.
    const handleClusterClick = async (e: MapLibreGL.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [clusterLayerId],
      });
      const feature = features[0];
      if (!feature) return;
      const clusterId = feature.properties?.cluster_id as number;
      const pointCount = feature.properties?.point_count as number;
      const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];

      if (onClusterClick) {
        onClusterClick(clusterId, coordinates, pointCount);
      } else {
        const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({
          center: coordinates,
          zoom,
        });
      }
    };

    // Unclustered point click handler.
    const handlePointClick = (
      e: MapLibreGL.MapMouseEvent & {
        features?: MapLibreGL.MapGeoJSONFeature[];
      },
    ) => {
      const feature = e.features?.[0];
      if (!onPointClick || !feature) return;
      const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [
        number,
        number,
      ];

      // Handle world copies.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      onPointClick(feature as unknown as GeoJSON.Feature<GeoJSON.Point, P>, coordinates);
    };

    // Cursor style handlers.
    const handleMouseEnterCluster = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleMouseLeaveCluster = () => {
      map.getCanvas().style.cursor = "";
    };
    const handleMouseEnterPoint = () => {
      if (onPointClick) {
        map.getCanvas().style.cursor = "pointer";
      }
    };
    const handleMouseLeavePoint = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", clusterLayerId, handleClusterClick);
    map.on("click", unclusteredLayerId, handlePointClick);
    map.on("mouseenter", clusterLayerId, handleMouseEnterCluster);
    map.on("mouseleave", clusterLayerId, handleMouseLeaveCluster);
    map.on("mouseenter", unclusteredLayerId, handleMouseEnterPoint);
    map.on("mouseleave", unclusteredLayerId, handleMouseLeavePoint);

    return () => {
      map.off("click", clusterLayerId, handleClusterClick);
      map.off("click", unclusteredLayerId, handlePointClick);
      map.off("mouseenter", clusterLayerId, handleMouseEnterCluster);
      map.off("mouseleave", clusterLayerId, handleMouseLeaveCluster);
      map.off("mouseenter", unclusteredLayerId, handleMouseEnterPoint);
      map.off("mouseleave", unclusteredLayerId, handleMouseLeavePoint);
    };
  }, [isLoaded, map, clusterLayerId, unclusteredLayerId, sourceId, onClusterClick, onPointClick]);

  return null;
}
