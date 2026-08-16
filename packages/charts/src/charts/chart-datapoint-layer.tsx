"use client";

/**
 * `ChartDatapointLayer` — the keyboard/AT half of the chart interaction
 * contract (#349).
 *
 * ## Why a separate DOM layer at all
 *
 * Every chart SVG body in this package is `aria-hidden="true"` (see
 * `chart-a11y.tsx`): the raw paths carry no meaning for AT. A focusable element
 * inside an `aria-hidden` subtree is the axe `aria-hidden-focus` violation, and
 * axe is BLOCKING on a ratchet in this repo — so `tabIndex` on an SVG `<rect>`
 * is not an option. The keyboard targets therefore live OUTSIDE the `<svg>`, as
 * real `<button>`s in a positioned sibling layer.
 *
 * ## The three constraints that shape this file
 *
 * 1. **`pointer-events: none` on the layer.** The SVG underneath still owns
 *    mousemove (crosshair, tooltip) and click. A layer that swallowed pointer
 *    events would silently kill hover tooltips on line/area — the single most
 *    likely way to break this feature, and the reason a regression test asserts
 *    tooltips still appear with `onDatapointClick` set. Keyboard activation of a
 *    focused `<button>` is unaffected by `pointer-events`.
 * 2. **One tab stop.** Roving tabindex: exactly one target is `tabIndex={0}`,
 *    the rest `-1`. Arrow keys move within/between series, Home/End jump. A
 *    500-point series must not add 500 tab stops.
 * 3. **No layout reads.** Targets carry geometry the shapes ALREADY computed
 *    from the scales — never `getBBox()`/`getBoundingClientRect()` (see
 *    `.claude/rules/interaction-guidelines.md`, "No layout reads in render").
 *
 * ## Registration
 *
 * Shapes/containers publish their targets through `useRegisterDatapointTargets`
 * into a ref-backed store; the layer subscribes with `useSyncExternalStore`. So
 * a registry write re-renders the LAYER only, never the shapes — which is what
 * keeps a large series from re-render-storming.
 */

import {
  createContext,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn, useCopyToClipboard, useLocale } from "@elabs-ai/components-ui";
import type {
  ChartDatapoint,
  ChartDatapointClickHandler,
  ChartDatapointLabel,
} from "./chart-datapoint";
import { shortDateFmt } from "./chart-formatters";
import { exactValueString } from "./value-format";

/** WCAG 2.5.8 (Target Size, Minimum). Every hit box is padded up to this. */
export const MIN_DATAPOINT_TARGET_SIZE = 24;

/** Default dev-warning threshold on the number of keyboard targets. */
export const DEFAULT_MAX_INTERACTIVE_DATAPOINTS = 500;

/** A registered keyboard target: a datapoint plus where it sits in the chart box. */
export interface ChartDatapointTarget extends Omit<ChartDatapoint, "source"> {
  /** Stable key, unique within the chart. */
  id: string;
  /**
   * Which arrow-key ROW this target belongs to (one row per series). Left/Right
   * move within a row, Up/Down across rows.
   */
  seriesIndex: number;
  /** Hit box in the chart container's own coordinate space, already padded. */
  rect: { x: number; y: number; width: number; height: number };
}

/**
 * Pads a hit box up to the minimum target size, keeping it centred on the real
 * geometry. A 3px-wide line point or a 6px bar becomes a comfortable 24×24
 * without moving where it appears to be.
 */
export function padDatapointRect(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): ChartDatapointTarget["rect"] {
  const width = Math.max(rect.width, MIN_DATAPOINT_TARGET_SIZE);
  const height = Math.max(rect.height, MIN_DATAPOINT_TARGET_SIZE);
  return {
    x: rect.x - (width - rect.width) / 2,
    y: rect.y - (height - rect.height) / 2,
    width,
    height,
  };
}

// ---------------------------------------------------------------------------
// Target store (external, so a registry write re-renders only the layer)
// ---------------------------------------------------------------------------

interface TargetStore {
  set: (groupId: string, targets: ChartDatapointTarget[]) => void;
  remove: (groupId: string) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ChartDatapointTarget[];
}

const EMPTY_TARGETS: ChartDatapointTarget[] = [];

function createTargetStore(): TargetStore {
  const groups = new Map<string, ChartDatapointTarget[]>();
  const listeners = new Set<() => void>();
  let snapshot: ChartDatapointTarget[] = EMPTY_TARGETS;

  const recompute = () => {
    const next: ChartDatapointTarget[] = [];
    for (const targets of groups.values()) {
      next.push(...targets);
    }
    // Row-major: series first, then position within the series. The roving
    // arrow-key model reads straight off this ordering.
    next.sort((a, b) => a.seriesIndex - b.seriesIndex || a.index - b.index);
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    set(groupId, targets) {
      groups.set(groupId, targets);
      recompute();
    },
    remove(groupId) {
      if (groups.delete(groupId)) {
        recompute();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ChartDatapointContextValue {
  store: TargetStore;
  /** Fires the consumer handler. Stable for the provider's lifetime. */
  activate: (
    target: ChartDatapointTarget,
    event: React.MouseEvent | React.KeyboardEvent,
    source: ChartDatapoint["source"],
  ) => void;
  /** Accessible name for a target. */
  labelFor: (target: ChartDatapointTarget) => string;
  maxInteractiveDatapoints: number;
}

const ChartDatapointContext = createContext<ChartDatapointContextValue | null>(null);

export interface ChartDatapointProviderProps {
  /** Consumer drill-down handler. Optional so `copyValueOnActivate` can stand alone. */
  onDatapointClick?: ChartDatapointClickHandler;
  /** Copy the datapoint's exact value when it is activated and no handler is set. */
  copyValueOnActivate?: boolean;
  datapointLabel?: ChartDatapointLabel;
  maxInteractiveDatapoints?: number;
  children: ReactNode;
}

/**
 * Wraps a chart whose consumer passed `onDatapointClick` — or asked for
 * `copyValueOnActivate`. Charts render this ONLY in those cases, so the opt-out
 * path adds no context, no layer and no DOM.
 */
export function ChartDatapointProvider({
  children,
  copyValueOnActivate = false,
  datapointLabel,
  maxInteractiveDatapoints = DEFAULT_MAX_INTERACTIVE_DATAPOINTS,
  onDatapointClick,
}: ChartDatapointProviderProps) {
  const { t } = useLocale();
  const { copied, copy } = useCopyToClipboard();
  const storeRef = useRef<TargetStore | null>(null);
  storeRef.current ??= createTargetStore();

  // Latest-handler refs keep the context value stable across renders, so a
  // consumer passing an inline arrow function does not churn every shape.
  const handlerRef = useRef(onDatapointClick);
  handlerRef.current = onDatapointClick;
  const labelRef = useRef(datapointLabel);
  labelRef.current = datapointLabel;
  const copyOnActivateRef = useRef(copyValueOnActivate);
  copyOnActivateRef.current = copyValueOnActivate;

  const value = useMemo<ChartDatapointContextValue>(() => {
    const store = storeRef.current as TargetStore;
    return {
      store,
      activate: (target, event, source) => {
        const { id: _id, rect: _rect, seriesIndex: _seriesIndex, ...point } = target;
        const handler = handlerRef.current;
        // A consumer handler always wins — the copy is the fallback that makes
        // compact labels recoverable, not a second thing that also fires.
        if (handler) {
          handler({ ...point, source }, event);
          return;
        }
        if (copyOnActivateRef.current && typeof point.value === "number") {
          void copy(exactValueString(point.value));
        }
      },
      labelFor: (target) => {
        const { id: _id, rect: _rect, seriesIndex: _seriesIndex, ...point } = target;
        const custom = labelRef.current;
        if (custom) {
          return custom(point);
        }
        const category =
          point.category instanceof Date
            ? shortDateFmt.format(point.category)
            : String(point.category ?? "");
        const value_ = point.value == null ? "" : String(point.value);
        const series = point.seriesLabel ?? point.seriesKey;
        return series
          ? t("charts.datapoint.label", { series, category, value: value_ })
          : t("charts.datapoint.labelNoSeries", { category, value: value_ });
      },
      maxInteractiveDatapoints,
    };
  }, [copy, maxInteractiveDatapoints, t]);

  return (
    <ChartDatapointContext value={value}>
      {children}
      {/*
        Mounted from first paint whenever copying is on, contents-only change:
        an `aria-live` region inserted at the same moment its text appears is
        frequently missed (ARIA22). Absent otherwise, so a chart that only takes
        `onDatapointClick` keeps the DOM it had.
      */}
      {copyValueOnActivate ? (
        <span aria-live="polite" className="sr-only" role="status">
          {copied ? t("charts.datapoint.copied") : ""}
        </span>
      ) : null}
    </ChartDatapointContext>
  );
}

/** True when the chart is interactive — i.e. a `ChartDatapointProvider` is mounted. */
export function useChartDatapointsEnabled(): boolean {
  return use(ChartDatapointContext) != null;
}

/**
 * Publishes a shape's (or a container's) keyboard targets.
 *
 * A NO-OP without a provider, so every shape primitive can call it
 * unconditionally. `targets` MUST be memoized by the caller — it is the
 * registration's identity.
 */
export function useRegisterDatapointTargets(
  groupId: string,
  targets: ChartDatapointTarget[],
): void {
  const context = use(ChartDatapointContext);
  const store = context?.store;

  useEffect(() => {
    if (!store) {
      return;
    }
    store.set(groupId, targets);
    return () => store.remove(groupId);
  }, [groupId, store, targets]);
}

/**
 * The pointer-side activator for shapes that are already discrete DOM elements
 * (a bar `<rect>`, a pie slice `<path>`). Returns `undefined` when the chart is
 * not interactive, so a shape can spread `onClick={activate && (…)}` cheaply.
 */
export function useActivateDatapoint():
  | ((
      target: ChartDatapointTarget,
      event: React.MouseEvent,
      source?: ChartDatapoint["source"],
    ) => void)
  | undefined {
  const context = use(ChartDatapointContext);
  const activate = context?.activate;
  return useMemo(() => {
    if (!activate) {
      return undefined;
    }
    return (target, event, source = "pointer") => activate(target, event, source);
  }, [activate]);
}

// ---------------------------------------------------------------------------
// The layer
// ---------------------------------------------------------------------------

/** Groups targets into arrow-key rows (one row per series), preserving order. */
function toRows(targets: ChartDatapointTarget[]): ChartDatapointTarget[][] {
  const rows: ChartDatapointTarget[][] = [];
  let currentSeries: number | null = null;
  for (const target of targets) {
    if (target.seriesIndex !== currentSeries) {
      currentSeries = target.seriesIndex;
      rows.push([]);
    }
    (rows.at(-1) as ChartDatapointTarget[]).push(target);
  }
  return rows;
}

export interface ChartDatapointLayerProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name for the target group. Defaults to a localized generic name. */
  label?: string;
}

/**
 * The keyboard-operable target layer. Render it as a POSITIONED SIBLING of the
 * chart `<svg>` (never inside it) whenever `onDatapointClick` is set; it
 * renders nothing without a `ChartDatapointProvider`.
 */
export const ChartDatapointLayer = forwardRef<HTMLDivElement, ChartDatapointLayerProps>(
  function ChartDatapointLayer({ className, label, ...props }, ref) {
    const context = use(ChartDatapointContext);
    const { t } = useLocale();
    const [activeId, setActiveId] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const pendingFocusRef = useRef<string | null>(null);
    const warnedRef = useRef(false);

    const store = context?.store;
    const subscribe = useCallback(
      (listener: () => void) => store?.subscribe(listener) ?? (() => {}),
      [store],
    );
    const getSnapshot = useCallback(() => store?.getSnapshot() ?? EMPTY_TARGETS, [store]);
    const targets = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const rows = useMemo(() => toRows(targets), [targets]);

    // Roving tabindex: the active target is whichever the user last landed on,
    // falling back to the first one whenever that target disappears (a data
    // change, a brush) — so the chart always has exactly one tab stop.
    const activeTarget = targets.find((target) => target.id === activeId) ?? targets[0];

    useEffect(() => {
      const id = pendingFocusRef.current;
      if (!id) {
        return;
      }
      pendingFocusRef.current = null;
      rootRef.current
        ?.querySelector<HTMLButtonElement>(`[data-target-id="${CSS.escape(id)}"]`)
        ?.focus();
    });

    const max = context?.maxInteractiveDatapoints ?? DEFAULT_MAX_INTERACTIVE_DATAPOINTS;
    useEffect(() => {
      if (targets.length > max && !warnedRef.current && process.env.NODE_ENV !== "production") {
        warnedRef.current = true;
        console.warn(
          `[ChartDatapointLayer] ${targets.length} interactive datapoints exceed maxInteractiveDatapoints ` +
            `(${max}). Every point stays keyboard-reachable (a keyboard user must reach what a mouse user ` +
            "can click), but consider ChartFrame's flip-to-table for a series this dense.",
        );
      }
    }, [max, targets.length]);

    if (!(context && targets.length > 0)) {
      return null;
    }

    const moveTo = (target: ChartDatapointTarget | undefined) => {
      if (!target) {
        return;
      }
      setActiveId(target.id);
      pendingFocusRef.current = target.id;
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.targetId;
      const rowIndex = rows.findIndex((row) => row.some((target) => target.id === id));
      const row = rows[rowIndex];
      if (!row) {
        return;
      }
      const columnIndex = row.findIndex((target) => target.id === id);

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          moveTo(row[Math.min(columnIndex + 1, row.length - 1)]);
          break;
        case "ArrowLeft":
          event.preventDefault();
          moveTo(row[Math.max(columnIndex - 1, 0)]);
          break;
        case "ArrowDown": {
          event.preventDefault();
          const next = rows[Math.min(rowIndex + 1, rows.length - 1)];
          moveTo(next?.[Math.min(columnIndex, next.length - 1)]);
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          const previous = rows[Math.max(rowIndex - 1, 0)];
          moveTo(previous?.[Math.min(columnIndex, previous.length - 1)]);
          break;
        }
        case "Home":
          event.preventDefault();
          moveTo(row[0]);
          break;
        case "End":
          event.preventDefault();
          moveTo(row.at(-1));
          break;
        default:
          break;
      }
    };

    return (
      <div
        aria-label={label ?? t("charts.datapointLayer.label")}
        className={cn("pointer-events-none absolute inset-0", className)}
        data-slot="chart-datapoint-layer"
        ref={(node) => {
          rootRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        role="group"
        {...props}
      >
        {targets.map((target) => (
          <button
            aria-label={context.labelFor(target)}
            className="absolute rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-slot="chart-datapoint-layer-target"
            data-target-id={target.id}
            key={target.id}
            onClick={(event) => {
              setActiveId(target.id);
              context.activate(target, event, event.detail === 0 ? "keyboard" : "pointer");
            }}
            onKeyDown={handleKeyDown}
            style={{
              left: target.rect.x,
              top: target.rect.y,
              width: target.rect.width,
              height: target.rect.height,
            }}
            tabIndex={activeTarget?.id === target.id ? 0 : -1}
            type="button"
          />
        ))}
      </div>
    );
  },
);
