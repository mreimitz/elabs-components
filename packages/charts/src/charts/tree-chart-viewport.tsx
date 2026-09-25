/**
 * The TreeChart viewport: zoom in / out / fit and a minimap, so a tree that
 * outgrows its box can be read like a canvas — the same controls, the same
 * gestures and the same look as `CanvasShell` + `ZoomControls` + `FlowMiniMap`
 * in `@elabs-ai/components-flow`, without the React Flow dependency:
 *
 *  - the wheel zooms around the pointer, dragging the empty canvas pans,
 *    pinch on a trackpad zooms (a ctrl-wheel in the browser's eyes);
 *  - `+` / `−` / fit buttons in the corner, in the flow package's chrome;
 *  - the minimap draws every node's box and the part of the tree in view;
 *    click or drag on it to move the view.
 *
 * Zoom is a CSS `scale()` on the drawn canvas inside the chart's existing
 * scroll box: pan IS scroll, so the scroll-edge fade, the flight scroll and
 * the keyboard model all keep working at every zoom.
 */
import { Maximize, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cn, useLocale } from "@elabs-ai/components-ui";

/** The zoom range and step `CanvasShell` uses (React Flow's defaults). */
export const TREE_ZOOM_MIN = 0.5;
export const TREE_ZOOM_MAX = 2;
export const TREE_ZOOM_STEP = 1.2;

export interface TreeViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface UseTreeZoomOptions {
  /** The scroll box the canvas lives in. */
  scroller: RefObject<HTMLElement | null>;
  enabled: boolean;
  min?: number;
  max?: number;
  defaultZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

/**
 * Zoom state plus the gestures: wheel-to-zoom around the pointer and
 * drag-to-pan on the scroller. Both are installed as native listeners
 * (wheel must be non-passive to stop the page from scrolling too).
 */
export function useTreeZoom({
  scroller,
  enabled,
  min = TREE_ZOOM_MIN,
  max = TREE_ZOOM_MAX,
  defaultZoom = 1,
  onZoomChange,
}: UseTreeZoomOptions) {
  const [zoom, setZoomState] = useState(() => clamp(defaultZoom, min, max));
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;
  // Where the box should scroll once the canvas has been laid out at the new
  // zoom — applied in a layout effect, after React has committed the scaled
  // stage, so the scroll is not clamped against the old size.
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    const next = pendingScroll.current;
    if (!el || !next) return;
    pendingScroll.current = null;
    el.scrollLeft = next.left;
    el.scrollTop = next.top;
  }, [zoom, scroller]);

  /**
   * Set the zoom keeping the canvas point under (`clientX`, `clientY`) still;
   * without a point, the centre of the box stays put.
   */
  const zoomTo = useCallback(
    (next: number, clientX?: number, clientY?: number) => {
      const el = scroller.current;
      const k = clamp(next, min, max);
      const prev = zoomRef.current;
      if (k === prev) return;
      if (el) {
        const rect = el.getBoundingClientRect();
        const mx = clientX == null ? rect.width / 2 : clientX - rect.left;
        const my = clientY == null ? rect.height / 2 : clientY - rect.top;
        const ratio = k / prev;
        pendingScroll.current = {
          left: (el.scrollLeft + mx) * ratio - mx,
          top: (el.scrollTop + my) * ratio - my,
        };
      }
      zoomRef.current = k;
      setZoomState(k);
      onZoomChangeRef.current?.(k);
    },
    [scroller, min, max],
  );

  const zoomIn = useCallback(() => zoomTo(zoomRef.current * TREE_ZOOM_STEP), [zoomTo]);
  const zoomOut = useCallback(() => zoomTo(zoomRef.current / TREE_ZOOM_STEP), [zoomTo]);

  /** Zoom so the whole tree (`width` × `height` at zoom 1) fits the box, then centre it. */
  const fitView = useCallback(
    (width: number, height: number) => {
      const el = scroller.current;
      if (!el || width <= 0 || height <= 0) return;
      const pad = 16;
      const k = clamp(
        Math.min((el.clientWidth - pad) / width, (el.clientHeight - pad) / height),
        min,
        max,
      );
      pendingScroll.current = {
        left: Math.max(0, (width * k - el.clientWidth) / 2),
        top: Math.max(0, (height * k - el.clientHeight) / 2),
      };
      if (k === zoomRef.current) {
        // Same zoom, only the scroll changes: nothing re-renders, so apply it now.
        el.scrollLeft = pendingScroll.current.left;
        el.scrollTop = pendingScroll.current.top;
        pendingScroll.current = null;
        return;
      }
      zoomRef.current = k;
      setZoomState(k);
      onZoomChangeRef.current?.(k);
    },
    [scroller, min, max],
  );

  // Wheel zooms around the pointer (React Flow's own delta curve); a ctrl-wheel
  // is how a trackpad pinch arrives, and it zooms the same way.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !enabled) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
      zoomTo(zoomRef.current * Math.pow(2, delta), event.clientX, event.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scroller, enabled, zoomTo]);

  // Dragging the empty canvas pans. Nodes, pills and the tree items keep their
  // own pointer handling: a drag that starts on them is not a pan.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !enabled) return;
    let start: { x: number; y: number; left: number; top: number; id: number } | null = null;
    const isInteractive = (target: EventTarget | null) =>
      target instanceof Element &&
      target.closest(
        '[role="treeitem"], button, a, [data-slot="tree-chart-toggle"], [data-slot="tree-chart-node-toggle"], [data-slot="tree-chart-viewport-controls"], [data-slot="tree-chart-minimap"]',
      ) != null;
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || isInteractive(event.target)) return;
      start = {
        x: event.clientX,
        y: event.clientY,
        left: el.scrollLeft,
        top: el.scrollTop,
        id: event.pointerId,
      };
      el.setPointerCapture(event.pointerId);
      el.dataset.panning = "true";
    };
    const onMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      el.scrollLeft = start.left - (event.clientX - start.x);
      el.scrollTop = start.top - (event.clientY - start.y);
    };
    const onUp = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      start = null;
      delete el.dataset.panning;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [scroller, enabled]);

  return { zoom, zoomTo, zoomIn, zoomOut, fitView, min, max };
}

// ── Controls ─────────────────────────────────────────────────────────────

function ControlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  // The same recipe as the flow package's `ZoomControls`, so a tree and a
  // canvas side by side read as one system.
  return (
    <button
      aria-disabled={disabled || undefined}
      aria-label={label}
      className={cn(
        "flex size-8 items-center justify-center text-foreground transition-colors duration-fast focus-ring hover:bg-surface-muted [&_svg]:size-4",
        disabled && "opacity-50 hover:bg-transparent",
      )}
      onClick={() => {
        if (!disabled) onClick();
      }}
      type="button"
    >
      {children}
    </button>
  );
}

export interface TreeChartZoomControlsProps {
  zoom: number;
  min: number;
  max: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  className?: string;
}

/** Zoom in / out / fit, in the flow package's chrome. Sits in the frame's bottom-right corner. */
export function TreeChartZoomControls({
  zoom,
  min,
  max,
  onZoomIn,
  onZoomOut,
  onFitView,
  className,
}: TreeChartZoomControlsProps) {
  const { t } = useLocale();
  return (
    <div
      className={cn(
        "pointer-events-auto flex divide-x overflow-hidden rounded-lg bg-surface-elevated shadow-ring-sm",
        className,
      )}
      data-slot="tree-chart-viewport-controls"
      data-zoom={zoom.toFixed(2)}
      role="group"
      aria-label={t("charts.treeChart.zoom")}
    >
      <ControlButton disabled={zoom >= max} label={t("charts.treeChart.zoomIn")} onClick={onZoomIn}>
        <Plus aria-hidden="true" />
      </ControlButton>
      <ControlButton
        disabled={zoom <= min}
        label={t("charts.treeChart.zoomOut")}
        onClick={onZoomOut}
      >
        <Minus aria-hidden="true" />
      </ControlButton>
      <ControlButton label={t("charts.treeChart.fitView")} onClick={onFitView}>
        <Maximize aria-hidden="true" />
      </ControlButton>
    </div>
  );
}

// ── Minimap ──────────────────────────────────────────────────────────────

export interface TreeChartMiniMapProps {
  /** The tree's size at zoom 1. */
  width: number;
  height: number;
  /** Every drawn node's box, at zoom 1. */
  nodes: ReadonlyArray<TreeViewportRect & { id: string }>;
  /** The part of the tree in view, at zoom 1. */
  viewport: TreeViewportRect;
  /** Move the view so its centre lands on this tree point (zoom-1 coordinates). */
  onCenter: (x: number, y: number) => void;
  className?: string;
}

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 112;

/**
 * The tree at a glance: every node as a box, the visible part as a window in
 * a mask — React Flow's `MiniMap`, in this design system's tokens
 * (`--flow-minimap-*`), drawn from the tree layout instead of the flow store.
 * Click or drag to move the view there.
 */
export function TreeChartMiniMap({
  width,
  height,
  nodes,
  viewport,
  onCenter,
  className,
}: TreeChartMiniMapProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const scale = Math.min(MINIMAP_WIDTH / Math.max(width, 1), MINIMAP_HEIGHT / Math.max(height, 1));
  const boxW = Math.max(1, width * scale);
  const boxH = Math.max(1, height * scale);
  const dragging = useRef(false);
  const { t } = useLocale();

  const centerFrom = (event: React.PointerEvent) => {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    onCenter((event.clientX - rect.left) / scale, (event.clientY - rect.top) / scale);
  };

  return (
    <svg
      aria-label={t("charts.treeChart.minimap")}
      className={cn(
        "pointer-events-auto cursor-pointer rounded-lg bg-surface-elevated shadow-ring-sm",
        className,
      )}
      data-slot="tree-chart-minimap"
      height={boxH}
      onPointerDown={(event) => {
        dragging.current = true;
        centerFrom(event);
        // Keep the drag even when the pointer leaves the tiny map.
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* a synthetic pointer has nothing to capture */
        }
      }}
      onPointerMove={(event) => {
        if (dragging.current) centerFrom(event);
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      ref={ref}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      width={boxW}
    >
      {nodes.map((node) => (
        <rect
          fill="var(--flow-minimap-node)"
          height={node.height}
          key={node.id}
          rx={Math.min(6, node.height / 4) / scale}
          width={node.width}
          x={node.x}
          y={node.y}
        />
      ))}
      {/* Everything outside the view is veiled; the window is the hole in the mask. */}
      <path
        d={`M0,0H${width}V${height}H0Z M${viewport.x},${viewport.y}H${viewport.x + viewport.width}V${viewport.y + viewport.height}H${viewport.x}Z`}
        fill="var(--flow-minimap-mask)"
        fillRule="evenodd"
      />
      <rect
        fill="none"
        height={viewport.height}
        stroke="var(--flow-minimap-node)"
        strokeWidth={1 / scale}
        width={viewport.width}
        x={viewport.x}
        y={viewport.y}
      />
    </svg>
  );
}
