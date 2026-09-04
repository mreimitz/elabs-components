"use client";

import {
  createContext,
  use,
  useMemo,
  useReducer,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { exportChartPng, exportChartSvg, findChartSvg, type ChartExportKind } from "./export-svg";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChartFrameView = "chart" | "table";

export type ChartFrameFeature = "expand" | "table" | "download" | "export-svg" | "export-png";

export type ChartFrameColumn = { key: string; header?: string };

export interface ChartFrameState {
  expanded: boolean;
  view: ChartFrameView;
  /**
   * Whether the chart body currently contains an `<svg>` — registered by
   * `ChartFrameInner` after render (RM-042). Governs `export-svg`/`export-png`
   * visibility the same way `hasData` governs `table`/`download`: a
   * placeholder body (no chart yet, or the table view is active) has nothing
   * to export.
   */
  hasSvg: boolean;
}

export interface ChartFrameActions {
  setExpanded: (open: boolean) => void;
  toggleView: () => void;
  download: () => void;
  /** Registers whether the chart body currently renders an `<svg>` (RM-042). */
  setHasSvg: (hasSvg: boolean) => void;
  /** Exports the chart body's `<svg>` as a self-contained SVG file. No-op when absent. */
  exportSvg: () => void;
  /** Exports the chart body's `<svg>` as a 2× PNG file. No-op when absent. */
  exportPng: () => void;
}

/** DOM handles the provider needs but does not itself render (RM-042). */
export interface ChartFrameRefs {
  /** Wraps the chart body (the `children` the caller renders) — searched for an `<svg>`. */
  chartBody: MutableRefObject<HTMLDivElement | null>;
  /** The outer `Card` — its resolved background paints the export's `<rect>`. */
  card: MutableRefObject<HTMLDivElement | null>;
}

export interface ChartFrameMeta {
  rows: Record<string, unknown>[];
  columns: ChartFrameColumn[];
  features: ChartFrameFeature[];
  title?: ReactNode;
  description?: ReactNode;
  /** Loading vs ready — inner parts (toolbar, body) read this off context. */
  loading: boolean;
}

export interface ChartFrameContextValue {
  state: ChartFrameState;
  actions: ChartFrameActions;
  meta: ChartFrameMeta;
  /** Not part of the public API — internal DOM handles (RM-042). */
  refs: ChartFrameRefs;
}

// ── Context ───────────────────────────────────────────────────────────────────

export const ChartFrameContext = createContext<ChartFrameContextValue | null>(null);

export function useChartFrame(): ChartFrameContextValue {
  const ctx = use(ChartFrameContext);
  if (!ctx) {
    throw new Error("useChartFrame must be used within a ChartFrameProvider.");
  }
  return ctx;
}

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_EXPANDED"; open: boolean }
  | { type: "TOGGLE_VIEW" }
  | { type: "SET_HAS_SVG"; hasSvg: boolean };

function reducer(state: ChartFrameState, action: Action): ChartFrameState {
  switch (action.type) {
    case "SET_EXPANDED":
      return { ...state, expanded: action.open };
    case "TOGGLE_VIEW":
      return { ...state, view: state.view === "chart" ? "table" : "chart" };
    case "SET_HAS_SVG":
      return state.hasSvg === action.hasSvg ? state : { ...state, hasSvg: action.hasSvg };
    default:
      return state;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export interface ChartFrameProviderProps {
  children: ReactNode;
  rows: Record<string, unknown>[];
  columns: ChartFrameColumn[];
  features: ChartFrameFeature[];
  title?: ReactNode;
  description?: ReactNode;
  /** Attribution footer (RM-019) — also rendered at the bottom of an SVG/PNG export. */
  source?: ReactNode;
  onDownload: (rows: Record<string, unknown>[], columns: ChartFrameColumn[]) => void;
  /**
   * Routes an SVG/PNG export to the caller instead of a local browser
   * download — mirrors `onDownload`. See `ChartFrameProps.onExport`.
   */
  onExport?: (kind: ChartExportKind, blob: Blob, filename: string) => void;
  /** Loading vs ready. Default: false. */
  loading?: boolean;
}

export function ChartFrameProvider({
  children,
  rows,
  columns,
  features,
  title,
  description,
  source,
  onDownload,
  onExport,
  loading = false,
}: ChartFrameProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    expanded: false,
    view: "chart",
    hasSvg: false,
  });

  // Not part of the public API. `ChartFrameInner` attaches these to the DOM
  // nodes it renders; the export actions below read `.current` at click
  // time, so the provider needs no re-render when the ref target changes.
  const chartBodyRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const refs: ChartFrameRefs = useMemo(() => ({ chartBody: chartBodyRef, card: cardRef }), []);

  const titleText = typeof title === "string" ? title : undefined;
  const sourceText = typeof source === "string" ? source : undefined;

  const actions: ChartFrameActions = useMemo(
    () => ({
      setExpanded: (open: boolean) => dispatch({ type: "SET_EXPANDED", open }),
      toggleView: () => dispatch({ type: "TOGGLE_VIEW" }),
      download: () => onDownload(rows, columns),
      setHasSvg: (hasSvg: boolean) => dispatch({ type: "SET_HAS_SVG", hasSvg }),
      exportSvg: () => {
        const svg = findChartSvg(refs.chartBody.current);
        if (!svg) return;
        const backgroundColor = refs.card.current
          ? getComputedStyle(refs.card.current).backgroundColor
          : undefined;
        exportChartSvg({ svg, title: titleText, source: sourceText, backgroundColor, onExport });
      },
      exportPng: () => {
        const svg = findChartSvg(refs.chartBody.current);
        if (!svg) return;
        const backgroundColor = refs.card.current
          ? getComputedStyle(refs.card.current).backgroundColor
          : undefined;
        // Fire-and-forget: rasterisation is async (canvas.toBlob), the
        // toolbar button is a plain click handler with no pending state.
        void exportChartPng({
          svg,
          title: titleText,
          source: sourceText,
          backgroundColor,
          onExport,
        });
      },
    }),
    [onDownload, rows, columns, refs, titleText, sourceText, onExport],
  );

  const meta: ChartFrameMeta = useMemo(
    () => ({ rows, columns, features, title, description, loading }),
    [rows, columns, features, title, description, loading],
  );

  const value = useMemo(() => ({ state, actions, meta, refs }), [state, actions, meta, refs]);

  return <ChartFrameContext value={value}>{children}</ChartFrameContext>;
}
