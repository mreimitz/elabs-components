"use client";

/**
 * density-scatter/density-shape-glyph.tsx — the legend-size picture of a
 * `DensityPointShape`: the same ten glyphs the renderer draws, as one SVG
 * path, so a legend row, a shape key or a picker shows exactly what the dots
 * look like. Ink only (`aria-hidden`); the row's label carries the name.
 */

import { forwardRef, type SVGAttributes } from "react";
import type { DensityPointShape } from "./types";

const r2 = (v: number) => Math.round(v * 100) / 100;

/** A closed path for `shape`, centred in a `size` × `size` box (`r` = size / 2). */
export function densityShapePath(shape: DensityPointShape, size: number): string {
  const c = size / 2;
  const r = size / 2;
  const pt = (x: number, y: number) => `${r2(c + x)} ${r2(c + y)}`;
  const poly = (pts: Array<[number, number]>) => `M${pts.map(([x, y]) => pt(x, y)).join("L")}Z`;
  const w = Math.max(0.9, r * 0.32); // bar half-thickness of plus / minus / cross
  switch (shape) {
    case "square": {
      const s = r * 0.86;
      return poly([
        [-s, -s],
        [s, -s],
        [s, s],
        [-s, s],
      ]);
    }
    case "diamond":
      return poly([
        [0, -r],
        [r, 0],
        [0, r],
        [-r, 0],
      ]);
    case "triangle": {
      const k = r * 1.08;
      return poly([
        [0, -k],
        [k * 0.95, k * 0.62],
        [-k * 0.95, k * 0.62],
      ]);
    }
    case "triangle-down": {
      const k = r * 1.08;
      return poly([
        [0, k],
        [k * 0.95, -k * 0.62],
        [-k * 0.95, -k * 0.62],
      ]);
    }
    case "plus":
      return poly([
        [-w, -r],
        [w, -r],
        [w, -w],
        [r, -w],
        [r, w],
        [w, w],
        [w, r],
        [-w, r],
        [-w, w],
        [-r, w],
        [-r, -w],
        [-w, -w],
      ]);
    case "minus":
      return poly([
        [-r, -w],
        [r, -w],
        [r, w],
        [-r, w],
      ]);
    case "cross": {
      // The plus, turned 45°.
      const a = Math.SQRT1_2;
      const rot = ([x, y]: [number, number]): [number, number] => [a * (x - y), a * (x + y)];
      const k = r * 1.1;
      return poly(
        (
          [
            [-w, -k],
            [w, -k],
            [w, -w],
            [k, -w],
            [k, w],
            [w, w],
            [w, k],
            [-w, k],
            [-w, w],
            [-k, w],
            [-k, -w],
            [-w, -w],
          ] as Array<[number, number]>
        ).map(rot),
      );
    }
    case "star": {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r * 1.08 : r * 0.5;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      return poly(pts);
    }
    case "hexagon": {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return poly(pts);
    }
    case "circle":
    default:
      return `M${pt(-r, 0)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`;
  }
}

export interface DensityShapeGlyphProps extends Omit<SVGAttributes<SVGSVGElement>, "fill"> {
  shape: DensityPointShape;
  /** Box size in CSS px. Default 10. */
  size?: number;
  /** Fill colour; default `currentColor`. */
  color?: string;
}

/** A `shape` as a small inline SVG — decorative, the surrounding text names it. */
export const DensityShapeGlyph = forwardRef<SVGSVGElement, DensityShapeGlyphProps>(
  function DensityShapeGlyph({ shape, size = 10, color = "currentColor", ...props }, ref) {
    return (
      <svg
        aria-hidden="true"
        data-shape={shape}
        data-slot="density-shape-glyph"
        height={size}
        overflow="visible"
        ref={ref}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        {...props}
      >
        <path d={densityShapePath(shape, size)} fill={color} />
      </svg>
    );
  },
);
DensityShapeGlyph.displayName = "DensityShapeGlyph";
