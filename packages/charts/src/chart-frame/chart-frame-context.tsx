"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  DEFAULT_CHART_INTERACTIONS,
  type ChartDensity,
  type ChartInteractions,
} from "../charts/chart-config-context";
import {
  exportChartPng,
  exportChartSvg,
  findChartSvg,
  type ChartExportKind,
  type ChartExportRequest,
} from "./export-svg";
import { measureChartExportLayer } from "./export-layer";

/** `ChartFrame`'s `onExport` (RM-042): the built file, routed to the caller. */
export type ChartFrameExportHandler = (kind: ChartExportKind, blob: Blob, filename: string) => void;

/** "Chart: Author" — the byline a frame's footer opens with (RM-117). */
export interface ChartFrameByline {
  /** Which word leads the byline. Default `"chart"`. */
  kind?: "chart" | "map" | "table";
  author: ReactNode;
}

/** A named, optionally linked source (RM-117): "Source: Name". */
export interface ChartFrameSourceLink {
  name: ReactNode;
  href?: string;
}

/**
 * Editorial chrome a chart inside the frame may hand up (RM-117) — `AutoChart`
 * does, from its `ChartSpec`. The frame's own props win over these.
 */
export interface ChartFrameChromeInput {
  /** A title handed up from the chart inside the frame — the frame's own explicit `title` prop wins over this. */
  title?: ReactNode;
  notes?: ReactNode;
  byline?: ChartFrameByline;
  source?: ReactNode | ChartFrameSourceLink;
  altText?: string;
}

/** One series colour a chart publishes to its frame (RM-117) — read by `InlineChip`. */
export interface ChartFrameSeriesEntry {
  key: string;
  color: string;
  label?: string;
}

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
  /**
   * Exports the frame as a self-contained SVG file — the chart `<svg>` plus an
   * SVG twin of its HTML text (RM-117). No-op when absent. `request`
   * overrides the frame's `exportOptions`.
   */
  exportSvg: (request?: ChartExportRequest) => void;
  /** Exports the same picture as a PNG (2× unless `request.scale` says otherwise). */
  exportPng: (request?: ChartExportRequest) => void;
  /** A chart hands its series colours up (RM-117). Returns the unregister. */
  registerSeries: (id: string, entries: readonly ChartFrameSeriesEntry[]) => () => void;
  /** A chart hands editorial chrome up (RM-117). Returns the unregister. */
  registerChrome: (id: string, chrome: ChartFrameChromeInput) => () => void;
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
  /**
   * The frame's own explicit `title` prop, or — when absent — the chrome
   * title a chart in the body handed up (`useChartFrameChrome`). Resolved
   * once here so the dialog heading, the table caption and the export
   * filename all agree with the header.
   */
  title?: ReactNode;
  description?: ReactNode;
  /** Loading vs ready — inner parts (toolbar, body) read this off context. */
  loading: boolean;
  /** Furniture tier forwarded to every chart family (RM-072). Default `"md"`. */
  density: ChartDensity;
  /** Resolved interaction switches forwarded to every chart family (RM-072). */
  interactions: Required<ChartInteractions>;
  /** Series key → colour and name, from every chart in the body (RM-117). */
  series: Readonly<Record<string, ChartFrameSeriesEntry>>;
  /** Chrome handed up by a chart in the body (RM-117); the frame's props win. */
  chrome: ChartFrameChromeInput;
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

type Registry<T> = Readonly<Record<string, T>>;

/** Adds/replaces (`value`) or removes (`undefined`) one registrant; same object when unchanged. */
function updateRegistry<T>(
  registry: Registry<T>,
  id: string,
  value: T | undefined,
  same: (a: T, b: T) => boolean,
): Registry<T> {
  const prev = registry[id];
  if (value === undefined) {
    if (prev === undefined) return registry;
    const next = { ...registry };
    delete next[id];
    return next;
  }
  if (prev !== undefined && same(prev, value)) return registry;
  return { ...registry, [id]: value };
}

const sameSeries = (a: readonly ChartFrameSeriesEntry[], b: readonly ChartFrameSeriesEntry[]) =>
  a.length === b.length &&
  a.every((e, i) => e.key === b[i]!.key && e.color === b[i]!.color && e.label === b[i]!.label);

const sameChrome = (a: ChartFrameChromeInput, b: ChartFrameChromeInput) =>
  a.title === b.title &&
  a.notes === b.notes &&
  a.byline === b.byline &&
  a.source === b.source &&
  a.altText === b.altText;

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
  onExport?: ChartFrameExportHandler;
  /** Defaults for every export the frame starts (RM-117). */
  exportOptions?: ChartExportRequest;
  /** Loading vs ready. Default: false. */
  loading?: boolean;
  /** Furniture tier (RM-072). Default `"md"`. */
  density?: ChartDensity;
  /** Interaction switches (RM-072); missing keys keep their defaults. */
  interactions?: ChartInteractions;
  /** Fires whenever the expand modal opens or closes (RM-072). */
  onExpandChange?: (open: boolean) => void;
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
  exportOptions,
  loading = false,
  density = "md",
  interactions,
  onExpandChange,
}: ChartFrameProviderProps) {
  const [seriesRegistry, setSeriesRegistry] = useReducerState<
    Registry<readonly ChartFrameSeriesEntry[]>
  >({});
  const [chromeRegistry, setChromeRegistry] = useReducerState<Registry<ChartFrameChromeInput>>({});
  const registerSeries = useCallback(
    (id: string, entries: readonly ChartFrameSeriesEntry[]) => {
      setSeriesRegistry((r) => updateRegistry(r, id, entries, sameSeries));
      return () => setSeriesRegistry((r) => updateRegistry(r, id, undefined, sameSeries));
    },
    [setSeriesRegistry],
  );
  const registerChrome = useCallback(
    (id: string, chrome: ChartFrameChromeInput) => {
      setChromeRegistry((r) => updateRegistry(r, id, chrome, sameChrome));
      return () => setChromeRegistry((r) => updateRegistry(r, id, undefined, sameChrome));
    },
    [setChromeRegistry],
  );
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

  // The frame's own `title` prop always wins; with none, fall back to the
  // chrome title a chart in the body (AutoChart) handed up. Resolved once
  // here — the dialog heading, the table caption default and the export
  // filename all read this same value, never the raw prop alone.
  const chrome = useMemo(() => mergeChrome(chromeRegistry), [chromeRegistry]);
  // The table view remounts the body under a fresh `key` (`ChartFrameInner`),
  // which unmounts the chart entirely and, with it, unregisters whatever
  // chrome title it handed up — a card with only a spec title (no frame-level
  // `title` prop) would otherwise lose both its header AND its table caption
  // on every flip to table view. Keep the last registered title while the
  // table view shows: track it only while the CHART view is showing —
  // including the chart genuinely dropping its title, which must clear the
  // tracked value too, or a stale title would reappear once the caller flips
  // to table view after removing it.
  const lastChromeTitleRef = useRef<ReactNode>(undefined);
  if (state.view !== "table") lastChromeTitleRef.current = chrome.title;
  const resolvedTitle =
    title ?? chrome.title ?? (state.view === "table" ? lastChromeTitleRef.current : undefined);
  const titleText = typeof resolvedTitle === "string" ? resolvedTitle : undefined;
  const sourceText = typeof source === "string" ? source : undefined;

  // Latest-callback ref: an inline `onExpandChange` must not churn `actions`.
  const scale = exportOptions?.scale;
  const plainDefault = exportOptions?.plain;
  /**
   * Everything one export needs, read at click time (RM-117): the chart
   * `<svg>`, the card's resolved background, and the HTML layer measured over
   * the whole frame — or over the chart body only when `plain`.
   */
  const exportParams = useCallback(
    (request?: ChartExportRequest) => {
      const svg = findChartSvg(refs.chartBody.current);
      if (!svg) return undefined;
      const card = refs.card.current;
      const plain = request?.plain ?? plainDefault ?? false;
      const box = plain ? refs.chartBody.current : card;
      const backgroundColor = card ? getComputedStyle(card).backgroundColor : undefined;
      const layer = box ? measureChartExportLayer(box, { svg, box }) : undefined;
      return {
        svg,
        title: titleText,
        // The measured layer already carries the frame's own source row.
        source: layer ? undefined : sourceText,
        backgroundColor,
        layer,
        scale: request?.scale ?? scale ?? 2,
        onExport,
      };
    },
    [refs, titleText, sourceText, onExport, scale, plainDefault],
  );

  const onExpandChangeRef = useRef(onExpandChange);
  onExpandChangeRef.current = onExpandChange;

  const actions: ChartFrameActions = useMemo(
    () => ({
      setExpanded: (open: boolean) => {
        dispatch({ type: "SET_EXPANDED", open });
        onExpandChangeRef.current?.(open);
      },
      toggleView: () => dispatch({ type: "TOGGLE_VIEW" }),
      download: () => onDownload(rows, columns),
      setHasSvg: (hasSvg: boolean) => dispatch({ type: "SET_HAS_SVG", hasSvg }),
      exportSvg: (request?: ChartExportRequest) => {
        const params = exportParams(request);
        if (params) exportChartSvg(params);
      },
      exportPng: (request?: ChartExportRequest) => {
        const params = exportParams(request);
        if (params) void exportChartPng(params);
      },
      registerSeries,
      registerChrome,
    }),
    [onDownload, rows, columns, exportParams, registerSeries, registerChrome],
  );

  const { passive, active, select, edit } = { ...DEFAULT_CHART_INTERACTIONS, ...interactions };
  const meta: ChartFrameMeta = useMemo(
    () => ({
      rows,
      columns,
      features,
      title: resolvedTitle,
      description,
      loading,
      density,
      interactions: { passive, active, select, edit },
      series: mergeSeries(seriesRegistry),
      chrome,
    }),
    [
      rows,
      columns,
      features,
      resolvedTitle,
      description,
      loading,
      density,
      passive,
      active,
      select,
      edit,
      seriesRegistry,
      chrome,
    ],
  );

  const value = useMemo(() => ({ state, actions, meta, refs }), [state, actions, meta, refs]);

  return <ChartFrameContext value={value}>{children}</ChartFrameContext>;
}
// ── Registries (RM-117) ───────────────────────────────────────────────────────

/** `useState` over a reducer — the setter takes an updater and keeps one identity. */
function useReducerState<T>(initial: T): [T, (update: (prev: T) => T) => void] {
  return useReducer((prev: T, update: (prev: T) => T) => update(prev), initial);
}

function mergeSeries(
  registry: Registry<readonly ChartFrameSeriesEntry[]>,
): Record<string, ChartFrameSeriesEntry> {
  const out: Record<string, ChartFrameSeriesEntry> = {};
  for (const entries of Object.values(registry)) {
    for (const entry of entries) out[entry.key] ??= entry;
  }
  return out;
}

function mergeChrome(registry: Registry<ChartFrameChromeInput>): ChartFrameChromeInput {
  const out: ChartFrameChromeInput = {};
  for (const chrome of Object.values(registry)) {
    out.title ??= chrome.title;
    out.notes ??= chrome.notes;
    out.byline ??= chrome.byline;
    out.source ??= chrome.source;
    out.altText ??= chrome.altText;
  }
  return out;
}

/** The frame around this subtree, or `null` outside one (RM-117). */
export function useOptionalChartFrame(): ChartFrameContextValue | null {
  return use(ChartFrameContext);
}

// `useLayoutEffect` warns when it never runs (SSR) — this repo has no shared
// helper for the isomorphic swap, so it is local to the one registration
// effect that needs it (below).
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Hands editorial chrome up to the enclosing frame (RM-117), including a
 * `title` — `AutoChart` uses this to hand up `spec.title` so a `ChartFrame`
 * wrapping it shows it in the frame's own header instead of a second,
 * in-plot title. No-op outside a frame.
 *
 * Registration runs in a layout effect, not a plain effect: it lands before
 * the browser paints, so a chart mounting inside a frame never paints its own
 * body title and the frame's header title in two separate frames — the swap
 * is atomic. Neither runs during SSR, so a server render (and the matching
 * first client paint, before hydration's effects fire) always has the chart's
 * own title — the frame has nothing registered yet to draw instead.
 */
export function useChartFrameChrome(chrome: ChartFrameChromeInput): void {
  const frame = use(ChartFrameContext);
  const id = useId();
  const register = frame?.actions.registerChrome;
  const { title, notes, byline, source, altText } = chrome;
  useIsomorphicLayoutEffect(() => {
    if (!register) return undefined;
    if (!title && !notes && !byline && !source && !altText) return undefined;
    return register(id, { title, notes, byline, source, altText });
  }, [register, id, title, notes, byline, source, altText]);
}

/**
 * `false` outside a `ChartFrame`, or wherever the enclosing frame will NOT
 * draw the chrome-registered title as its own header — `true` only where it
 * will: a `chrome="card"`, or a `chrome="tile"` with no `headerSlot`, and no
 * explicit `ChartFrame.title` prop overriding it (an explicit title keeps
 * both). Populated by `ChartFrameInner`, which sits between the provider and
 * the chart body, so it needs no provider prop-drilling. `AutoChart` reads
 * this to decide whether its own in-body title is now redundant.
 */
export const ChartFrameChromeTitleContext = createContext<boolean>(false);

/** See `ChartFrameChromeTitleContext`. */
export function useChartFrameShowsChromeTitle(): boolean {
  return use(ChartFrameChromeTitleContext);
}
