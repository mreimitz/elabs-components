"use client";

import { resolveTokenColor } from "@qlik-coe-emea/qlabs-components-tokens";
import { useLayoutEffect, useState } from "react";

import { useMap } from "../map-canvas/map-context";

/**
 * Resolve a semantic token (e.g. `"--primary"`) to a concrete color MapLibre's
 * WebGL paint can consume, re-resolving whenever the brand theme changes.
 * This is how default layer paints stay token-driven: WebGL can't read CSS
 * custom properties, so we read them at runtime off the map container.
 */
export function useTokenColor(name: string, fallback = "#000000"): string {
  const { map, themeKey } = useMap();
  const [color, setColor] = useState(fallback);

  useLayoutEffect(() => {
    setColor(resolveTokenColor(name, { el: map?.getContainer(), fallback }));
  }, [name, fallback, map, themeKey]);

  return color;
}
