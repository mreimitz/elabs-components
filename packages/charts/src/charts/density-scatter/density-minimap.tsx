"use client";

/**
 * density-minimap.tsx — the overview of a zoomed `DensityScatterChart`.
 *
 * A small density picture of every point at the home window, with the current
 * window drawn as a frame. Mounted only while the chart is zoomed. Pointer
 * down / drag inside it re-centres the window there (the keyboard path is the
 * zoom controls and the arrow-key pan on the plot), so the whole control is
 * `aria-hidden`.
 */

import {
  type CSSProperties,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { DensityView } from "./types";

export interface DensityMinimapProps {
  x: Float32Array;
  y: Float32Array;
  n: number;
  home: DensityView;
  view: DensityView;
  /** Re-centre the window on a data point. */
  onCenter: (x: number, y: number) => void;
  width?: number;
  height?: number;
  style?: CSSProperties;
}

export function DensityMinimap({
  x,
  y,
  n,
  home,
  view,
  onCenter,
  width = 132,
  height = 88,
  style,
}: DensityMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);

  // The density picture: points binned per device pixel, alpha by log count.
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    // A partial 2-D context (jsdom's canvas stub, some test doubles) has no
    // pixel access; the minimap then stays blank rather than throwing.
    if (!c || !ctx || typeof ctx.createImageData !== "function") return;
    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    c.width = w;
    c.height = h;
    const counts = new Uint32Array(w * h);
    const fx = w / (home.x1 - home.x0 || 1);
    const fy = h / (home.y1 - home.y0 || 1);
    let max = 0;
    for (let i = 0; i < n; i++) {
      const px = ((x[i]! - home.x0) * fx) | 0;
      const py = ((home.y1 - y[i]!) * fy) | 0;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const k = py * w + px;
      const v = ++counts[k]!;
      if (v > max) max = v;
    }
    const color = getComputedStyle(c).color;
    const m = /(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/.exec(color);
    const [r, g, b] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [90, 90, 90];
    const img = ctx.createImageData(w, h);
    const lm = Math.log1p(max || 1);
    for (let k = 0; k < counts.length; k++) {
      const v = counts[k]!;
      if (!v) continue;
      const o = k * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = Math.round(90 + 165 * (Math.log1p(v) / lm));
    }
    ctx.putImageData(img, 0, 0);
  }, [x, y, n, home.x0, home.x1, home.y0, home.y1, width, height]);

  const sx = (v: number) => ((v - home.x0) / (home.x1 - home.x0)) * width;
  const sy = (v: number) => ((home.y1 - v) / (home.y1 - home.y0)) * height;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const fx0 = clamp(sx(view.x0), 0, width);
  const fx1 = clamp(sx(view.x1), 0, width);
  const fy0 = clamp(sy(view.y1), 0, height);
  const fy1 = clamp(sy(view.y0), 0, height);

  const centerAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = clamp(e.clientX - r.left, 0, width);
    const py = clamp(e.clientY - r.top, 0, height);
    onCenter(
      home.x0 + (px / width) * (home.x1 - home.x0),
      home.y1 - (py / height) * (home.y1 - home.y0),
    );
  };

  return (
    <div
      aria-hidden="true"
      className="absolute z-[3] cursor-move overflow-hidden rounded-control border border-border bg-card shadow-sm"
      data-chart-export="exclude"
      data-slot="density-scatter-chart-minimap"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        centerAt(e);
      }}
      onPointerMove={(e) => {
        if (dragging.current) centerAt(e);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onWheel={(e) => e.stopPropagation()}
      style={{ width, height, ...style }}
    >
      <canvas className="absolute inset-0 size-full text-muted-foreground" ref={canvasRef} />
      <svg className="pointer-events-none absolute inset-0" height={height} width={width}>
        <rect
          fill="none"
          height={Math.max(2, fy1 - fy0)}
          stroke="var(--primary)"
          strokeWidth={1.5}
          width={Math.max(2, fx1 - fx0)}
          x={fx0}
          y={fy0}
        />
      </svg>
    </div>
  );
}

DensityMinimap.displayName = "DensityMinimap";
