"use client";

import { createContext, use, useMemo, useReducer, type ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChartFrameView = "chart" | "table";

export type ChartFrameFeature = "expand" | "table" | "download";

export type ChartFrameColumn = { key: string; header?: string };

export interface ChartFrameState {
  expanded: boolean;
  view: ChartFrameView;
}

export interface ChartFrameActions {
  setExpanded: (open: boolean) => void;
  toggleView: () => void;
  download: () => void;
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

type Action = { type: "SET_EXPANDED"; open: boolean } | { type: "TOGGLE_VIEW" };

function reducer(state: ChartFrameState, action: Action): ChartFrameState {
  switch (action.type) {
    case "SET_EXPANDED":
      return { ...state, expanded: action.open };
    case "TOGGLE_VIEW":
      return { ...state, view: state.view === "chart" ? "table" : "chart" };
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
  onDownload: (rows: Record<string, unknown>[], columns: ChartFrameColumn[]) => void;
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
  onDownload,
  loading = false,
}: ChartFrameProviderProps) {
  const [state, dispatch] = useReducer(reducer, { expanded: false, view: "chart" });

  const actions: ChartFrameActions = useMemo(
    () => ({
      setExpanded: (open: boolean) => dispatch({ type: "SET_EXPANDED", open }),
      toggleView: () => dispatch({ type: "TOGGLE_VIEW" }),
      download: () => onDownload(rows, columns),
    }),
    [onDownload, rows, columns],
  );

  const meta: ChartFrameMeta = useMemo(
    () => ({ rows, columns, features, title, description, loading }),
    [rows, columns, features, title, description, loading],
  );

  const value = useMemo(() => ({ state, actions, meta }), [state, actions, meta]);

  return <ChartFrameContext value={value}>{children}</ChartFrameContext>;
}
