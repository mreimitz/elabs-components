"use client";

import type MapLibreGL from "maplibre-gl";
import { createContext, use } from "react";

import type { PlanCrs } from "../lib/plan-crs";

/** Light-or-dark flavor of the active basemap (derived from the brand theme). */
export type BasemapTheme = "light" | "dark";

export interface MapContextValue {
  /** The live MapLibre map instance (`null` until the map has mounted). */
  map: MapLibreGL.Map | null;
  /** True once the map AND its style are fully loaded — gate layer operations on this. */
  isLoaded: boolean;
  /** Which basemap flavor is active. */
  resolvedTheme: BasemapTheme;
  /**
   * Changes whenever the active brand theme changes. Layer components use it
   * as a dependency key to re-resolve semantic token colors for WebGL paint.
   */
  themeKey: string;
  /**
   * The plan coordinate system when this canvas is a CUSTOM (non-geographic)
   * plan map — a floor plan, factory layout or carriage — and `null` for an
   * ordinary geographic map. Layer components read it to convert the plan
   * coordinates they are handed, and to report plan coordinates back.
   */
  plan: PlanCrs | null;
  /** True while the consumer has asked for a loading overlay over the map. */
  loading: boolean;
}

export const MapContext = createContext<MapContextValue | null>(null);

/** Access the map instance + load state from any descendant of `<MapCanvas>`. */
export function useMap(): MapContextValue {
  const context = use(MapContext);
  if (!context) {
    throw new Error("useMap must be used within a <MapCanvas>");
  }
  return context;
}
