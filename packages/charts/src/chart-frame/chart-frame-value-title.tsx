"use client";

import {
  createContext,
  use,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/*
 * Value in the title (#610, RM-119 follow-up) — `<ChartTooltip valueInTitle>`
 * drops its own box title, and the enclosing `ChartFrame` shows the hovered
 * (or pinned, or keyboard-focused) value in ITS title instead. No consumer
 * wiring: the frame provides a store, the tooltip publishes into it.
 *
 * A store (not React state on the frame's context) on purpose: the hovered
 * value changes on every pointer move across categories, and putting it on
 * `ChartFrameContext` would re-render every chart part that reads the frame.
 * Only the title text and its status region subscribe, and a publish only
 * notifies when the shown text actually changes — a pointer moving inside
 * one category is a no-op.
 */

/** What the frame's title reads. Replaced (never mutated) on every change. */
export interface ChartFrameValueTitleSnapshot {
  /** How many `valueInTitle` tooltips inside the frame are mounted. */
  publishers: number;
  /** The hovered value text, or `null` when nothing is hovered. */
  text: string | null;
}

export interface ChartFrameValueTitleStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ChartFrameValueTitleSnapshot;
  /** A `valueInTitle` tooltip mounted. Returns the release (clears its value). */
  register: (id: string) => () => void;
  /** The tooltip's current value text, or `null` on leave. */
  publish: (id: string, text: string | null) => void;
}

const EMPTY: ChartFrameValueTitleSnapshot = { publishers: 0, text: null };

export function createChartFrameValueTitleStore(): ChartFrameValueTitleStore {
  const values = new Map<string, string | null>();
  const listeners = new Set<() => void>();
  let snapshot = EMPTY;
  // The most recent non-null publisher wins; when it clears, any other
  // publisher still showing a value takes over (two charts in one frame).
  let shownBy: string | null = null;

  const commit = () => {
    let text: string | null = shownBy === null ? null : (values.get(shownBy) ?? null);
    if (text === null) {
      shownBy = null;
      for (const [id, value] of values) {
        if (value !== null) {
          shownBy = id;
          text = value;
        }
      }
    }
    if (snapshot.publishers === values.size && snapshot.text === text) {
      return;
    }
    snapshot = { publishers: values.size, text };
    for (const listener of listeners) listener();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    register: (id) => {
      if (!values.has(id)) values.set(id, null);
      commit();
      return () => {
        values.delete(id);
        commit();
      };
    },
    publish: (id, text) => {
      if (!values.has(id) || values.get(id) === text) {
        return;
      }
      values.set(id, text);
      if (text !== null) shownBy = id;
      commit();
    },
  };
}

/**
 * The frame's store, or `null` — outside a `ChartFrame`, or inside one that
 * shows no title the value could replace (`chrome="bare"`, no `title`, a
 * custom `headerSlot`, the expanded dialog's copy).
 */
export const ChartFrameValueTitleContext = createContext<ChartFrameValueTitleStore | null>(null);

/** Owns one store for the frame's lifetime. */
export function useChartFrameValueTitleStore(): ChartFrameValueTitleStore {
  const [store] = useState(createChartFrameValueTitleStore);
  return store;
}

function useSnapshot(store: ChartFrameValueTitleStore): ChartFrameValueTitleSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * Publishes `text` into the enclosing frame's title while `enabled`. Returns
 * whether a frame consumes it — the tooltip then leaves announcing to the
 * frame's status region (one `role="status"` per region). No-op outside one.
 */
export function useChartFrameValueTitlePublisher(enabled: boolean, text: string | null): boolean {
  const store = use(ChartFrameValueTitleContext);
  const id = useId();
  const active = enabled && store !== null;

  useEffect(() => {
    if (!(active && store)) return undefined;
    return store.register(id);
  }, [active, store, id]);

  useEffect(() => {
    if (!(active && store)) return;
    store.publish(id, text);
  }, [active, store, id, text]);

  return active;
}

/** The frame title's text: the hovered value while one is published, else `title`. */
export function ChartFrameTitleText({
  store,
  title,
}: {
  store: ChartFrameValueTitleStore;
  title: ReactNode;
}) {
  const { text } = useSnapshot(store);
  if (text === null) return <>{title}</>;
  return <span data-slot="chart-frame-title-value">{text}</span>;
}

/**
 * The one polite status for the swap. Mounted (empty) as soon as a
 * `valueInTitle` tooltip registers, so the FIRST change is announced too — a
 * live region inserted together with its text is often skipped.
 */
export function ChartFrameValueTitleStatus({ store }: { store: ChartFrameValueTitleStore }) {
  const { publishers, text } = useSnapshot(store);
  if (publishers === 0) return null;
  return (
    <span
      aria-live="polite"
      className="sr-only"
      data-slot="chart-frame-value-title-status"
      role="status"
    >
      {text ?? ""}
    </span>
  );
}
