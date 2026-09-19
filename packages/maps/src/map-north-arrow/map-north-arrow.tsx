"use client";

import { forwardRef, useEffect, useRef, useState, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import { useMap } from "../map-canvas/map-context";
import { MAP_CORNER_CLASSES, type MapCorner } from "../map-legend/map-corner";

/** Below this rotation (degrees) the map counts as north-up and the arrow stays away. */
const NORTH_UP_TOLERANCE = 0.5;

/** A bearing folded into (-180, 180]. */
function normalizeBearing(bearing: number): number {
  const b = ((bearing % 360) + 360) % 360;
  return b > 180 ? b - 360 : b;
}

export interface MapNorthArrowProps extends HTMLAttributes<HTMLDivElement> {
  /** Corner of the map (default `"top-left"`). */
  position?: MapCorner;
  /** The arrow's accessible name (default `"North"`). */
  label?: string;
}

/**
 * A north arrow that appears only while the map is rotated (bearing ≠ 0) and
 * turns with it — a north-up map needs none. Static furniture, not a control:
 * `<MapControls showCompass>` is the button that resets the bearing. Render
 * inside `<MapCanvas>`.
 */
export const MapNorthArrow = forwardRef<HTMLDivElement, MapNorthArrowProps>(function MapNorthArrow(
  { position = "top-left", label = "North", className, ...props },
  ref,
) {
  const { map } = useMap();
  const glyphRef = useRef<SVGSVGElement>(null);
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    if (!map) return undefined;
    const update = () => {
      const bearing = normalizeBearing(map.getBearing());
      setRotated(Math.abs(bearing) > NORTH_UP_TOLERANCE);
      if (glyphRef.current) glyphRef.current.style.transform = `rotate(${-bearing}deg)`;
    };
    update();
    map.on("rotate", update);
    return () => {
      map.off("rotate", update);
    };
  }, [map]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      data-slot="map-north-arrow"
      hidden={!rotated}
      className={cn(
        "pointer-events-none absolute z-10 flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground",
        MAP_CORNER_CLASSES[position],
        className,
      )}
      {...props}
    >
      <svg ref={glyphRef} viewBox="0 0 24 24" aria-hidden="true" className="size-7">
        {/* The arrow: dark north half, hollow south half. */}
        <path d="M12 3 L16 13 L12 11 Z" fill="currentColor" />
        <path d="M12 3 L8 13 L12 11 Z" fill="currentColor" opacity={0.55} />
        {/* The cartographic "N", drawn as strokes so it is not locale text. */}
        <path
          d="M9.5 21 V15.5 L14.5 21 V15.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});
