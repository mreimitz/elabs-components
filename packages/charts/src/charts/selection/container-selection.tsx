"use client";

/**
 * container-selection.tsx — wires a container's selection props to a session
 * and its chrome (RM-145).
 *
 * A gesture-aware container calls `useContainerSelection(props, xDataKey)`
 * once and wraps its whole tree (legend included) in `selection.wrap(…)`,
 * exactly like `useContainerLegend`. With gestures off `wrap` returns its
 * argument untouched — the DOM stays byte-identical. With gestures on it adds:
 *
 * - the session context (the gesture scope inside routes intents into it),
 * - the provisional-paint context (read by `ChartSelectionProvider`),
 * - a root element (`data-slot="chart-selection-root"`) carrying
 *   `data-selection-provisional="true"` while a session is open — `display:
 *   contents` unless the toolbar renders inside it,
 * - the toolbar above the plot (raw container, `selectionToolbar: "auto"`) —
 *   or nothing, when a `ChartFrame` hosts it in its action slot,
 * - the session's polite live region.
 */

import { type ReactNode, use, useCallback, useEffect, useMemo } from "react";
import { cn } from "@elabs-ai/components-ui";
import {
  type ChartSelectionCategory,
  ChartSelectionProvisionalContext,
  type ChartSelectionStatesResolver,
} from "../chart-selection";
import { ChartSelectionToolbar } from "./chart-selection-toolbar";
import { isSelectionGestureEnabled } from "./chart-gesture-layer";
import { FrameSelectionSlotContext, SelectionSessionContext } from "./selection-session-context";
import type { ChartSelectionGestureProps } from "./types";
import { type SelectionSession, useSelectionSession } from "./use-selection-session";

export interface ContainerSelectionResult {
  session: SelectionSession;
  /** Wrap the container's outermost node. A pass-through with gestures off. */
  wrap: (node: ReactNode) => ReactNode;
}

/** What the host currently paints — the immediate-mode toolbar counts it. */
export interface ContainerSelectionHost<TDatum = Record<string, unknown>> {
  /** The container's rows. */
  rows?: readonly TDatum[];
  /** The host's own resolver (the family's `selectionStates` prop). */
  selectionStates?: ChartSelectionStatesResolver<TDatum>;
}

function selectionKey(value: unknown): string {
  return value instanceof Date ? `d:${value.getTime()}` : `${typeof value}:${String(value)}`;
}

/**
 * Distinct `field` values the host paints `selected`, or `undefined` when the
 * host paints nothing (no resolver) — the session then falls back to the last
 * intent's size.
 */
export function countHostSelected<TDatum>(
  host: ContainerSelectionHost<TDatum> | undefined,
  field: string | undefined,
): number | undefined {
  const resolver = host?.selectionStates;
  if (typeof resolver !== "function" || !host?.rows || !field) return undefined;
  const seen = new Set<string>();
  for (const row of host.rows) {
    const value = (row as Record<string, unknown>)[field];
    if (value === undefined || value === null) continue;
    const key = selectionKey(value);
    if (seen.has(key)) continue;
    if (resolver(value as ChartSelectionCategory, undefined, row) === "selected") seen.add(key);
  }
  return seen.size;
}

/**
 * The session + chrome of one gesture-aware container. `defaultField` is the
 * container's `xDataKey` (the intents' field unless `selectionField` is set).
 * `host` (rows + the host's `selectionStates`) lets the immediate-mode toolbar
 * count what the host paints rather than the last gesture.
 */
export function useContainerSelection<TDatum = Record<string, unknown>>(
  props: ChartSelectionGestureProps<TDatum>,
  defaultField?: string,
  host?: ContainerSelectionHost<TDatum>,
): ContainerSelectionResult {
  const slot = use(FrameSelectionSlotContext);
  const enabled = isSelectionGestureEnabled(props as ChartSelectionGestureProps);
  const confirm = props.selectionConfirm ?? slot?.defaults?.confirm ?? "immediate";
  const toolbar = props.selectionToolbar ?? slot?.defaults?.toolbar ?? "auto";
  const field = props.selectionField ?? defaultField;
  const hostRows = host?.rows;
  const hostStates = host?.selectionStates;
  const selectedCount = useMemo(
    () =>
      enabled && confirm !== "explicit"
        ? countHostSelected({ rows: hostRows, selectionStates: hostStates }, field)
        : undefined,
    [confirm, enabled, field, hostRows, hostStates],
  );
  const session = useSelectionSession<TDatum>({
    enabled,
    gestures: props.selectionGestures ?? [],
    confirm,
    field,
    onSelectionIntent: props.onSelectionIntent,
    selectedCount,
  }) as unknown as SelectionSession;

  const framed = Boolean(slot?.hasSlot);
  const register = slot?.register;
  useEffect(() => {
    if (!enabled || !framed || toolbar === "none" || !register) return;
    return register(session);
  }, [enabled, framed, register, session, toolbar]);

  const inlineToolbar = enabled && toolbar !== "none" && !framed;
  const provisional = session.selectionStates;
  const { rootRef } = session;
  const open = session.isOpen;
  const announcement = session.announcement;

  const wrap = useCallback(
    (node: ReactNode): ReactNode => {
      if (!enabled) return node;
      return (
        <SelectionSessionContext value={session}>
          <ChartSelectionProvisionalContext value={{ selectionStates: provisional }}>
            <div
              // `h-full` passes a fill-height host's height through (auto otherwise);
              // the plot box below flexes into what the toolbar leaves.
              className={cn(
                inlineToolbar ? "flex h-full min-h-0 min-w-0 flex-col gap-2" : "contents",
              )}
              data-selection-confirm={session.confirm}
              data-selection-provisional={open ? "true" : undefined}
              data-slot="chart-selection-root"
              ref={rootRef}
            >
              {inlineToolbar ? <ChartSelectionToolbar session={session} /> : null}
              <div
                className={cn(inlineToolbar ? "min-h-0 min-w-0 flex-1" : "contents")}
                data-slot="chart-selection-plot"
              >
                {node}
              </div>
              <span
                aria-live="polite"
                className="sr-only"
                data-slot="chart-selection-status"
                role="status"
              >
                {announcement}
              </span>
            </div>
          </ChartSelectionProvisionalContext>
        </SelectionSessionContext>
      );
    },
    [announcement, enabled, inlineToolbar, open, provisional, rootRef, session],
  );

  return { session, wrap };
}
