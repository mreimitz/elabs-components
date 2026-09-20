"use client";

import type MapLibreGL from "maplibre-gl";
import { useCallback, useEffect, useRef } from "react";

import type { PlanCrs } from "./plan-crs";
import type { MapPlanRegion } from "./plan-regions";

/** Where a region ended up on screen, in CSS pixels relative to the canvas. */
export interface PlanScreenBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UsePlanProjectionOptions {
  map: MapLibreGL.Map | null;
  plan: PlanCrs | null;
  /**
   * The regions to track. Keep this array MEMOIZED: it is an effect dependency,
   * and a fresh array every render re-binds the map listeners every render.
   */
  regions: readonly MapPlanRegion[];
  /** Turn tracking off (while the map is still loading, say). */
  enabled?: boolean;
  /** Called after each frame's DOM writes, with the boxes that were written. */
  onFrame?: (boxes: ReadonlyMap<string, PlanScreenBox>) => void;
}

/**
 * ONE projection pass for every plan overlay element, coalesced into a single
 * `requestAnimationFrame` and writing straight to the DOM — no React state per
 * frame, no per-element listener. A MapLibre `Marker` binds its own `move`
 * listener and projects itself, so forty rooms would mean eighty listeners and
 * forty uncoordinated writes; this is one listener set and one write pass.
 *
 * Each region is projected from its FOUR plan corners to a screen box, so the
 * box stays right even where the projection is not a plain scale.
 */
export function usePlanProjection({
  map,
  plan,
  regions,
  enabled = true,
  onFrame,
}: UsePlanProjectionOptions) {
  const elementsRef = useRef(new Map<string, HTMLElement>());
  const boxesRef = useRef(new Map<string, PlanScreenBox>());
  const frameRef = useRef<number | null>(null);
  const latestRef = useRef({ map, plan, regions, enabled, onFrame });
  latestRef.current = { map, plan, regions, enabled, onFrame };

  /** The whole write pass. Reads refs only, so it never needs re-creating. */
  const write = useCallback(() => {
    frameRef.current = null;
    const {
      map: currentMap,
      plan: currentPlan,
      regions: currentRegions,
      enabled: isEnabled,
      onFrame: notify,
    } = latestRef.current;
    if (!currentMap || !currentPlan || !isEnabled) return;

    const boxes = boxesRef.current;
    boxes.clear();

    for (const region of currentRegions) {
      const element = elementsRef.current.get(region.id);
      const { x, y, width, height } = region.bounds;
      const corners: [number, number][] = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      ];

      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const [cornerX, cornerY] of corners) {
        const point = currentMap.project(currentPlan.toLngLat({ x: cornerX, y: cornerY }));
        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
      }

      const box: PlanScreenBox = {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
      };
      boxes.set(region.id, box);

      if (!element) continue;
      // Physical `left`/`top`, deliberately: `map.project` returns screen
      // pixels, which do not mirror in RTL — a logical inset would put every
      // region on the wrong side of the canvas.
      element.style.left = "0px";
      element.style.top = "0px";
      element.style.width = `${Math.round(box.width)}px`;
      element.style.height = `${Math.round(box.height)}px`;
      element.style.transform = `translate(${Math.round(box.x)}px, ${Math.round(box.y)}px)`;
    }

    notify?.(boxes);
  }, []);

  /** Ask for a frame. Repeated calls inside one frame collapse into one pass. */
  const refresh = useCallback(() => {
    if (!latestRef.current.enabled) return;
    if (frameRef.current != null) return;
    if (typeof requestAnimationFrame !== "function") {
      write();
      return;
    }
    frameRef.current = requestAnimationFrame(write);
  }, [write]);

  /** `ref` callback for a region's element. */
  const register = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (element) elementsRef.current.set(id, element);
      else elementsRef.current.delete(id);
      refresh();
    },
    [refresh],
  );

  useEffect(() => {
    if (!map || !plan || !enabled) return;

    // Write once synchronously, so the first paint already has the geometry
    // rather than a stack of boxes at the origin.
    write();

    map.on("move", refresh);
    map.on("moveend", refresh);
    map.on("resize", refresh);

    return () => {
      map.off("move", refresh);
      map.off("moveend", refresh);
      map.off("resize", refresh);
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [map, plan, enabled, regions, refresh, write]);

  return { register, refresh, boxes: boxesRef };
}
