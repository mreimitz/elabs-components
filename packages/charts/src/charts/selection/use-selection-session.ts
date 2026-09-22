"use client";

/**
 * use-selection-session.ts — one chart's selection session (RM-145, ADR 0040 §4).
 *
 * The session sits between the gesture engine (`use-chart-gesture.ts`, which
 * always resolves each gesture to an intent at once) and the host's
 * `onSelectionIntent`:
 *
 * - `confirm: "immediate"` (default): every gesture is forwarded as it lands —
 *   today's behaviour; the session only tracks the tool mode and the count.
 * - `confirm: "explicit"` (the associative BI suite's confirm model): gestures accumulate a
 *   PROVISIONAL set — a plain click toggles a value in or out, a plain range /
 *   rectangle / lasso adds (Shift adds, Ctrl/Cmd toggles, as always). ✓, Enter
 *   or a press outside the chart commits ONE `replace` intent carrying the
 *   union (the last gesture's geometry, the accumulated datapoints); ✕ or Esc
 *   cancels and nothing is emitted.
 *
 * While a session is open the chart paints the provisional set through the
 * `selectionStates` seam (selected = in, associated = the rest — exclusion is
 * the host's job after commit) and its root carries
 * `data-selection-provisional="true"`, so a theme styles the preview with
 * CSS / tokens only. Open, commit and cancel are announced in a polite live
 * region.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useControllableState, useLocale } from "@elabs-ai/components-ui";
import type { ChartSelectionStatesResolver } from "../chart-selection";
import type { GestureEngineMode } from "./gesture-machine";
import type {
  ChartSelectionConfirm,
  ChartSelectionGesture,
  ChartSelectionIntent,
  ChartSelectionIntentHandler,
  ChartSelectionValue,
} from "./types";
import { accumulateProvisional, initialGestureMode } from "./use-chart-gesture";

/** A toolbar tool: pointer (click), or one of the drawing gestures. */
export type ChartSelectionToolMode = "pointer" | "range" | "rect" | "lasso" | "radial";

/** Toolbar order. `pointer` is always offered; the rest only when the container lists them. */
const TOOL_ORDER: readonly ChartSelectionToolMode[] = [
  "pointer",
  "range",
  "rect",
  "lasso",
  "radial",
];

export interface UseSelectionSessionOptions<TDatum = Record<string, unknown>> {
  /** The gestures the container enabled. */
  gestures: readonly ChartSelectionGesture[];
  /** Default `"immediate"`. */
  confirm?: ChartSelectionConfirm;
  /** The intents' field — the provisional paint matches a mark's row on it. */
  field?: string;
  onSelectionIntent?: ChartSelectionIntentHandler<TDatum>;
  /** Controlled tool mode. */
  mode?: ChartSelectionToolMode;
  /** Initial tool mode. Default: the first drawing gesture listed, else `pointer`. */
  defaultMode?: ChartSelectionToolMode;
  onModeChange?: (mode: ChartSelectionToolMode) => void;
  /** Off → a pass-through (no listeners). Default `true`. */
  enabled?: boolean;
}

export interface SelectionSession<TDatum = Record<string, unknown>> {
  enabled: boolean;
  /** The intents' field (for a click the session builds itself — a keyboard datapoint activation). */
  field: string | undefined;
  confirm: ChartSelectionConfirm;
  /** The tools the toolbar offers, in order. */
  modes: readonly ChartSelectionToolMode[];
  mode: ChartSelectionToolMode;
  setMode: (mode: ChartSelectionToolMode) => void;
  /** An explicit session holds a provisional set. */
  isOpen: boolean;
  /** The accumulated (explicit) intent, or `null`. */
  provisional: ChartSelectionIntent<TDatum> | null;
  /** Provisional values (explicit), or the last intent's values (immediate). */
  count: number;
  /** Feed a resolved gesture intent in (the engine calls this). */
  receive: (intent: ChartSelectionIntent<TDatum>) => void;
  /** Emit the provisional set as ONE `replace` intent. */
  commit: () => ChartSelectionIntent<TDatum> | null;
  /** Drop the provisional set (and any band the engine still paints). */
  cancel: () => void;
  /** The provisional paint, `undefined` while no session is open. */
  selectionStates: ChartSelectionStatesResolver | undefined;
  /** The polite live-region text. */
  announcement: string;
  /** Attach to the chart root: click-outside and Enter/Esc are scoped to it. */
  rootRef: (node: HTMLElement | null) => void;
  /** Elements that count as "inside" (a toolbar mounted in a frame). */
  registerInside: (node: HTMLElement) => () => void;
  /** Called on cancel — the engine clears its in-flight gesture and range band. */
  registerReset: (reset: () => void) => () => void;
}

/** The engine mode a tool drives. `range` arms a band along the dimension axis. */
export function toolModeToEngineMode(
  mode: ChartSelectionToolMode,
  dimensionAxis: "x" | "y" = "x",
): GestureEngineMode {
  if (mode === "range") return dimensionAxis === "y" ? "range-y" : "range-x";
  return mode;
}

/** Tools offered for a gesture list. */
export function selectionToolModes(
  gestures: readonly ChartSelectionGesture[],
): ChartSelectionToolMode[] {
  return TOOL_ORDER.filter((mode) => mode === "pointer" || gestures.includes(mode));
}

/** The tool a gesture list starts in: its first drawing gesture (RM-142's `initialGestureMode`). */
export function defaultToolMode(
  gestures: readonly ChartSelectionGesture[],
): ChartSelectionToolMode {
  const mode = initialGestureMode(gestures);
  return mode === "rect" || mode === "lasso" || mode === "radial" ? mode : "pointer";
}

function valueKey(value: unknown): string {
  return value instanceof Date ? `d:${value.getTime()}` : `${typeof value}:${String(value)}`;
}

/**
 * Explicit mode: a plain click toggles, a plain drawn gesture adds; modifier
 * modes (Shift add, Ctrl/Cmd toggle) are kept.
 */
export function provisionalMode<TDatum>(
  intent: ChartSelectionIntent<TDatum>,
): ChartSelectionIntent<TDatum> {
  if (intent.mode !== "replace") return intent;
  return { ...intent, mode: intent.gesture.kind === "click" ? "toggle" : "add" };
}

const INTERACTIVE = 'button, input, select, textarea, a[href], [role="slider"], [contenteditable]';

export function useSelectionSession<TDatum = Record<string, unknown>>(
  options: UseSelectionSessionOptions<TDatum>,
): SelectionSession<TDatum> {
  const { gestures, field, onSelectionIntent } = options;
  const enabled = options.enabled !== false;
  const confirm: ChartSelectionConfirm = options.confirm ?? "immediate";
  const { t } = useLocale();

  const modes = useMemo(() => selectionToolModes(gestures), [gestures]);
  const [mode, setModeState] = useControllableState<ChartSelectionToolMode>(
    options.mode,
    options.defaultMode ?? defaultToolMode(gestures),
    options.onModeChange,
  );

  const [provisional, setProvisional] = useState<ChartSelectionIntent<TDatum> | null>(null);
  const provisionalRef = useRef<ChartSelectionIntent<TDatum> | null>(null);
  const [lastCount, setLastCount] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const live = useRef({ onSelectionIntent, confirm, t });
  live.current = { onSelectionIntent, confirm, t };

  const rootNode = useRef<HTMLElement | null>(null);
  const inside = useRef(new Set<HTMLElement>());
  const resets = useRef(new Set<() => void>());

  const setPending = useCallback((next: ChartSelectionIntent<TDatum> | null) => {
    provisionalRef.current = next;
    setProvisional(next);
  }, []);

  const gestureName = useCallback((intent: ChartSelectionIntent<TDatum>) => {
    const { t: tr } = live.current;
    switch (intent.gesture.kind) {
      case "range":
        return tr("charts.selection.gesture.range");
      case "rect":
        return tr("charts.selection.gesture.rect");
      case "lasso":
        return tr("charts.selection.gesture.lasso");
      case "radial":
        return tr("charts.selection.gesture.radial");
      default:
        return tr("charts.selection.gesture.click");
    }
  }, []);

  const receive = useCallback(
    (intent: ChartSelectionIntent<TDatum>) => {
      const { confirm: confirmMode, onSelectionIntent: emit, t: tr } = live.current;
      if (confirmMode !== "explicit") {
        setLastCount(intent.values.length);
        emit?.(intent);
        return;
      }
      const folded = accumulateProvisional(provisionalRef.current, provisionalMode(intent));
      setPending(folded);
      setAnnouncement(
        folded
          ? tr("charts.selection.session.open", {
              gesture: gestureName(intent),
              count: folded.values.length,
            })
          : tr("charts.selection.announce.cancelled"),
      );
    },
    [gestureName, setPending],
  );

  const commit = useCallback((): ChartSelectionIntent<TDatum> | null => {
    const pending = provisionalRef.current;
    if (!pending) return null;
    setPending(null);
    const intent: ChartSelectionIntent<TDatum> = { ...pending, mode: "replace" };
    setLastCount(intent.values.length);
    setAnnouncement(
      live.current.t("charts.selection.session.committed", { count: intent.values.length }),
    );
    live.current.onSelectionIntent?.(intent);
    return intent;
  }, [setPending]);

  const cancel = useCallback(() => {
    const hadPending = provisionalRef.current !== null;
    setPending(null);
    for (const reset of [...resets.current]) reset();
    if (hadPending) setAnnouncement(live.current.t("charts.selection.announce.cancelled"));
  }, [setPending]);

  // A confirm switch (a frame default flipping) drops a half-built set.
  useEffect(() => {
    if (confirm === "immediate" && provisionalRef.current) setPending(null);
  }, [confirm, setPending]);

  const setMode = useCallback(
    (next: ChartSelectionToolMode) => {
      if (modes.includes(next)) setModeState(next);
    },
    [modes, setModeState],
  );

  const isOpen = enabled && confirm === "explicit" && provisional !== null;

  const isInside = useCallback((target: Node | null) => {
    if (!target) return false;
    if (rootNode.current?.contains(target)) return true;
    for (const node of inside.current) if (node.contains(target)) return true;
    return false;
  }, []);

  // Enter / Esc and click-outside, only while a session is open.
  const liveOpen = useRef({ commit, cancel, isInside });
  liveOpen.current = { commit, cancel, isInside };
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const unfocused = !target || target === document.body || target === document.documentElement;
      if (!unfocused && !liveOpen.current.isInside(target)) return;
      // Keys aimed at the engine's own controls (range bubbles, thumbs, the
      // keyboard rectangle) are theirs.
      if (target?.closest?.('[data-slot="chart-selection-gesture-controls"]')) return;
      if (event.key === "Escape") {
        liveOpen.current.cancel();
      } else if (event.key === "Enter") {
        // Enter on a button (a datapoint target, a toolbar toggle) activates it.
        if (!unfocused && target?.closest?.(INTERACTIVE)) return;
        event.preventDefault();
        liveOpen.current.commit();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (liveOpen.current.isInside(event.target as Node | null)) return;
      liveOpen.current.commit();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [isOpen]);

  const selectionStates = useMemo<ChartSelectionStatesResolver | undefined>(() => {
    if (!isOpen || !provisional) return undefined;
    const keys = new Set(provisional.values.map(valueKey));
    return (category, _seriesKey, datum) => {
      const row = datum as Record<string, unknown> | undefined;
      const own = field && row && field in row ? (row[field] as ChartSelectionValue) : undefined;
      return keys.has(valueKey(own ?? category)) ? "selected" : "associated";
    };
  }, [field, isOpen, provisional]);

  const rootRef = useCallback((node: HTMLElement | null) => {
    rootNode.current = node;
  }, []);
  const registerInside = useCallback((node: HTMLElement) => {
    inside.current.add(node);
    return () => {
      inside.current.delete(node);
    };
  }, []);
  const registerReset = useCallback((reset: () => void) => {
    resets.current.add(reset);
    return () => {
      resets.current.delete(reset);
    };
  }, []);

  const count = confirm === "explicit" ? (provisional?.values.length ?? 0) : lastCount;

  return useMemo(
    () => ({
      enabled,
      field,
      confirm,
      modes,
      mode: modes.includes(mode) ? mode : "pointer",
      setMode,
      isOpen,
      provisional,
      count,
      receive,
      commit,
      cancel,
      selectionStates,
      announcement,
      rootRef,
      registerInside,
      registerReset,
    }),
    [
      announcement,
      cancel,
      commit,
      confirm,
      count,
      enabled,
      field,
      isOpen,
      mode,
      modes,
      provisional,
      receive,
      registerInside,
      registerReset,
      rootRef,
      selectionStates,
      setMode,
    ],
  );
}
