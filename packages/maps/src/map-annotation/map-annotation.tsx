"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import { useMap } from "../map-canvas/map-context";
import {
  type MapBreakpoint,
  type MapResponsive,
  useMapBreakpoint,
  resolveMapResponsive,
} from "../lib/use-map-breakpoint";
import { type MapLabelAnchor, clampShift, mapAnchorGeometry } from "./anchor";

// ── Registry ─────────────────────────────────────────────────────────────────
//
// Every `<MapAnnotation>` in a canvas registers here, so the canvas can number
// them and render ONE key under the map at `narrow`. Numbers follow reading
// order — the annotations' DOM order, which is their JSX order — and skip an
// annotation hidden at the current tier (the RM-111 rule `charts` uses).

interface AnnotationEntry {
  id: string;
  el: HTMLElement;
  text: ReactNode;
  hidden: boolean;
}

/** One row of the narrow key. */
export interface MapAnnotationKeyRow {
  id: string;
  number: number;
  text: ReactNode;
}

interface MapAnnotationRegistryValue {
  register: (entry: AnnotationEntry) => () => void;
  /** The number an annotation shows at this tier, or `undefined` when it paints its text. */
  numberOf: (id: string) => number | undefined;
}

const NO_ROWS: MapAnnotationKeyRow[] = [];

const MapAnnotationRegistryContext = createContext<MapAnnotationRegistryValue | null>(null);

function byDocumentOrder(a: AnnotationEntry, b: AnnotationEntry): number {
  if (a.el === b.el) return 0;
  return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/**
 * Internal: the annotation registry a `<MapCanvas>` owns. Returns the context
 * value to provide and the key rows to render under the map (empty unless the
 * tier is `narrow`).
 */
export function useMapAnnotationRegistry(breakpoint: MapBreakpoint): {
  value: MapAnnotationRegistryValue;
  rows: MapAnnotationKeyRow[];
} {
  const [entries, setEntries] = useState<ReadonlyMap<string, AnnotationEntry>>(() => new Map());

  const register = useCallback((entry: AnnotationEntry) => {
    setEntries((prev) => {
      const current = prev.get(entry.id);
      if (
        current &&
        current.el === entry.el &&
        current.text === entry.text &&
        current.hidden === entry.hidden
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(entry.id, entry);
      return next;
    });
    return () => {
      setEntries((prev) => {
        if (!prev.has(entry.id)) return prev;
        const next = new Map(prev);
        next.delete(entry.id);
        return next;
      });
    };
  }, []);

  const rows = useMemo<MapAnnotationKeyRow[]>(() => {
    if (breakpoint !== "narrow") return NO_ROWS;
    return [...entries.values()]
      .filter((entry) => !entry.hidden && entry.el.isConnected)
      .sort(byDocumentOrder)
      .map((entry, index) => ({ id: entry.id, number: index + 1, text: entry.text }));
  }, [entries, breakpoint]);

  const value = useMemo<MapAnnotationRegistryValue>(() => {
    const numbers = new Map(rows.map((row) => [row.id, row.number]));
    return { register, numberOf: (id) => numbers.get(id) };
  }, [register, rows]);

  return { value, rows };
}

/** Internal: provides the registry `useMapAnnotationRegistry` built. */
export const MapAnnotationRegistryProvider = MapAnnotationRegistryContext.Provider;

// ── Key ──────────────────────────────────────────────────────────────────────

export interface MapAnnotationKeyProps extends HTMLAttributes<HTMLOListElement> {
  /** The rows, in reading order. */
  rows: readonly MapAnnotationKeyRow[];
}

/**
 * The numbered list `<MapCanvas>` renders under the map at `narrow`, where each
 * `<MapAnnotation>` shows only its number on the map: "1 Lake Ontario, …".
 * NOT `aria-hidden` — at `narrow` this list is the only place the text lives.
 */
export const MapAnnotationKey = forwardRef<HTMLOListElement, MapAnnotationKeyProps>(
  function MapAnnotationKey({ rows, className, ...props }, ref) {
    return (
      <ol
        ref={ref}
        data-slot="map-annotation-key"
        data-count={rows.length}
        className={cn("m-0 flex list-none flex-col gap-1 p-0", className)}
        {...props}
      >
        {rows.map((row) => (
          <li
            key={row.id}
            data-slot="map-annotation-key-item"
            className="flex items-start gap-1.5 text-caption text-foreground"
          >
            <NumberBadge number={row.number} />
            <span className="min-w-0 break-words">{row.text}</span>
          </li>
        ))}
      </ol>
    );
  },
);

function NumberBadge({ number, className }: { number: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="map-annotation-number"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-meta font-semibold text-background tabular-nums",
        className,
      )}
    >
      {number}
    </span>
  );
}

// ── Annotation ───────────────────────────────────────────────────────────────

/** A leader line from the point to the text; `arrow` puts an arrowhead at the point. */
export interface MapAnnotationConnector {
  arrow?: boolean;
}

export interface MapAnnotationProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Longitude of the point the note is about. */
  longitude: number;
  /** Latitude of the point the note is about. */
  latitude: number;
  /** The note. Plain text reads best; it moves into the key at `narrow`. */
  text: ReactNode;
  /** Where the text sits relative to the point (default `"top-right"`). */
  anchor?: MapLabelAnchor;
  /**
   * The leader line from the point to the text (default: a plain line). Pass
   * `false` to set the text right beside the point with no line.
   */
  connector?: MapAnnotationConnector | false;
  /**
   * Whether the note shows at a tier (default `true` everywhere). A hidden note
   * takes no number, so the key stays gap-free.
   */
  showAt?: MapResponsive<boolean>;
  /** Paint order among annotations: a higher one paints on top (0–8, default 0). */
  priority?: number;
}

const LEADER_DISTANCE = 28;
const PLAIN_DISTANCE = 6;

/**
 * A text note pinned to a lon / lat with a leader line — an HTML overlay that
 * follows the map. At `narrow` the text gives way to a numbered marker and
 * `<MapCanvas>` lists the notes, in reading order, in a key under the map.
 * The text box clamps inside the map on both axes. Render inside `<MapCanvas>`.
 */
export const MapAnnotation = forwardRef<HTMLDivElement, MapAnnotationProps>(function MapAnnotation(
  {
    longitude,
    latitude,
    text,
    anchor = "top-right",
    connector = {},
    showAt = true,
    priority = 0,
    className,
    style,
    ...props
  },
  forwardedRef,
) {
  const { map } = useMap();
  const registry = useContext(MapAnnotationRegistryContext);
  const breakpoint = useMapBreakpoint();
  const id = useId();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);

  const hidden = !resolveMapResponsive(showAt, breakpoint);
  const number = registry?.numberOf(id);
  const keyed = number !== undefined;

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setRoot(node);
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  // Depend on the stable `register`, never the registry value: that changes
  // with every registration and would re-register in a loop.
  const register = registry?.register;
  useLayoutEffect(() => {
    if (!register || !root) return undefined;
    return register({ id, el: root, text, hidden });
  }, [register, id, root, text, hidden]);

  const distance = connector === false ? PLAIN_DISTANCE : LEADER_DISTANCE;

  // Follow the map. Transforms are written straight to the DOM on every move
  // (no React render per frame); the text box is measured and clamped inside
  // the map, and the leader line's end moves with it.
  useLayoutEffect(() => {
    if (!map || !root || hidden) return undefined;
    const container = map.getContainer();
    const { dx, dy, fx, fy } = mapAnchorGeometry(anchor, distance);
    const update = () => {
      const point = map.project([longitude, latitude]);
      const width = container.clientWidth;
      const height = container.clientHeight;
      const inside = point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height;
      root.style.visibility = inside ? "" : "hidden";
      root.style.transform = `translate(${point.x}px, ${point.y}px)`;
      const box = boxRef.current;
      if (!box) return;
      const boxWidth = box.offsetWidth;
      const boxHeight = box.offsetHeight;
      const left = point.x + dx + fx * boxWidth;
      const top = point.y + dy + fy * boxHeight;
      const { sx, sy } = clampShift(left, top, boxWidth, boxHeight, width, height);
      box.style.transform = `translate(${dx + sx + fx * boxWidth}px, ${dy + sy + fy * boxHeight}px)`;
      const line = lineRef.current;
      if (line) {
        line.setAttribute("x2", String(dx + sx));
        line.setAttribute("y2", String(dy + sy));
      }
    };
    update();
    map.on("move", update);
    map.on("resize", update);
    return () => {
      map.off("move", update);
      map.off("resize", update);
    };
  }, [map, root, hidden, keyed, anchor, distance, longitude, latitude, text]);

  const arrowId = `${id}-arrow`;

  return (
    <div
      ref={setRefs}
      data-slot="map-annotation"
      data-display={hidden ? "hidden" : keyed ? "keyed" : "painted"}
      hidden={hidden}
      className={cn("pointer-events-none absolute", className)}
      // Geographic overlay: a projected pixel offset from the map's top-left
      // corner, physical in every writing direction (like MapLibre's markers).
      style={{ left: 0, top: 0, zIndex: 1 + Math.max(0, Math.min(8, priority)), ...style }}
      {...props}
    >
      {keyed ? (
        <NumberBadge number={number} className="absolute -translate-x-1/2 -translate-y-1/2" />
      ) : (
        <>
          {connector !== false && (
            <svg
              aria-hidden="true"
              data-slot="map-annotation-connector"
              className="absolute overflow-visible text-foreground"
              width={1}
              height={1}
            >
              {connector.arrow && (
                <defs>
                  <marker
                    id={arrowId}
                    viewBox="0 0 8 8"
                    refX={0}
                    refY={4}
                    markerWidth={8}
                    markerHeight={8}
                    orient="auto"
                  >
                    <path d="M8 0 L0 4 L8 8 Z" fill="currentColor" />
                  </marker>
                </defs>
              )}
              <line
                ref={lineRef}
                x1={0}
                y1={0}
                x2={0}
                y2={0}
                stroke="currentColor"
                strokeWidth={1}
                markerStart={connector.arrow ? `url(#${arrowId})` : undefined}
              />
            </svg>
          )}
          <div
            ref={boxRef}
            data-slot="map-annotation-text"
            className="absolute w-max max-w-48 rounded-sm bg-background/85 px-1 text-caption text-foreground"
          >
            {text}
          </div>
        </>
      )}
    </div>
  );
});
