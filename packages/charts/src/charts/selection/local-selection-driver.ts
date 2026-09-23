"use client";

/**
 * local-selection-driver.ts — a tiny in-package selection driver (RM-145).
 *
 * For stories, tests and small apps that link a few charts without a host
 * engine. Same shapes as the parked dashboard core's `SelectionDriver`
 * (`select(field, values, { toggle, replace })`, `clear(field?)`,
 * `getSnapshot()` → `{ fields, states(field, value), count(field?) }`,
 * `subscribe`) so the dashboard pack can replace it wholesale — minus history,
 * locks and association (the pack's job). States: `selected` when the value is
 * in its field's selection, `excluded` when the field carries a selection that
 * does not hold the value, `associated` otherwise.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ChartSelectionStatesResolver, SelectionState } from "../chart-selection";
import type { ChartSelectionIntent, ChartSelectionValue } from "./types";

/** How `select` combines `values` with the field's selection. Neither flag: add. */
export interface LocalSelectionOptions {
  toggle?: boolean;
  replace?: boolean;
}

/** One field's selection. */
export interface LocalSelectionFieldState {
  values: ChartSelectionValue[];
}

/** An immutable view of the selection; the same object until something changes. */
export interface LocalSelectionSnapshot {
  readonly fields: Readonly<Record<string, Readonly<LocalSelectionFieldState>>>;
  states(field: string, value: unknown): SelectionState;
  /** Selected values in `field`; without a field, how many fields carry a selection. */
  count(field?: string): number;
}

export interface LocalSelectionDriver {
  getSnapshot(): LocalSelectionSnapshot;
  subscribe(listener: () => void): () => void;
  select(field: string, values: readonly ChartSelectionValue[], opts?: LocalSelectionOptions): void;
  /** Clear one field, or every field. */
  clear(field?: string): void;
}

/** Dates compare by time, everything else by type + value. */
function keyOf(value: unknown): string {
  return value instanceof Date ? `d:${value.getTime()}` : `${typeof value}:${String(value)}`;
}

function snapshotOf(selected: ReadonlyMap<string, ChartSelectionValue[]>): LocalSelectionSnapshot {
  const fields: Record<string, LocalSelectionFieldState> = {};
  const sets = new Map<string, Set<string>>();
  for (const [field, values] of selected) {
    fields[field] = Object.freeze({ values: [...values] });
    sets.set(field, new Set(values.map(keyOf)));
  }
  return Object.freeze({
    fields: Object.freeze(fields),
    states(field: string, value: unknown): SelectionState {
      const set = sets.get(field);
      if (!set) return "associated";
      return set.has(keyOf(value)) ? "selected" : "excluded";
    },
    count(field?: string) {
      return field === undefined ? sets.size : (sets.get(field)?.size ?? 0);
    },
  });
}

/** Create a local selection driver — one per group of linked charts. */
export function createLocalSelectionDriver(): LocalSelectionDriver {
  let selected = new Map<string, ChartSelectionValue[]>();
  let snapshot = snapshotOf(selected);
  const listeners = new Set<() => void>();
  const commit = (next: Map<string, ChartSelectionValue[]>) => {
    selected = next;
    snapshot = snapshotOf(next);
    for (const listener of [...listeners]) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select(field, values, opts = {}) {
      const current = selected.get(field) ?? [];
      const byKey = new Map<string, ChartSelectionValue>(
        opts.replace ? [] : current.map((v) => [keyOf(v), v]),
      );
      for (const value of values) {
        const key = keyOf(value);
        if (opts.toggle && byKey.has(key)) byKey.delete(key);
        else byKey.set(key, value);
      }
      const nextValues = [...byKey.values()];
      if (
        nextValues.length === current.length &&
        nextValues.every((v, i) => keyOf(v) === keyOf(current[i]))
      ) {
        return;
      }
      const next = new Map(selected);
      if (nextValues.length === 0) next.delete(field);
      else next.set(field, nextValues);
      commit(next);
    },
    clear(field) {
      if (field === undefined ? selected.size === 0 : !selected.has(field)) return;
      const next = new Map(selected);
      if (field === undefined) next.clear();
      else next.delete(field);
      commit(next);
    },
  };
}

export interface UseSelectionDriverOptions {
  /** Paint against this field only. Default: every field the mark's row carries. */
  field?: string;
}

export interface UseSelectionDriverResult {
  snapshot: LocalSelectionSnapshot;
  /** Hand to a chart's `selectionStates`. */
  selectionStates: ChartSelectionStatesResolver;
  /** Hand to a chart's `onSelectionIntent`: `replace`/`toggle` map to the flags, `add` to neither. */
  apply: (intent: ChartSelectionIntent) => void;
}

/** Subscribes to a driver and adapts it to a chart's selection input + output props. */
export function useSelectionDriver(
  driver: LocalSelectionDriver,
  options: UseSelectionDriverOptions = {},
): UseSelectionDriverResult {
  const snapshot = useSyncExternalStore(driver.subscribe, driver.getSnapshot, driver.getSnapshot);
  const only = options.field;
  const selectionStates = useCallback<ChartSelectionStatesResolver>(
    (category, _seriesKey, datum) => {
      const row = datum as Record<string, unknown> | undefined;
      const fields = only ? [only] : Object.keys(snapshot.fields);
      let state: SelectionState = "associated";
      for (const field of fields) {
        const value = row && field in row ? row[field] : category;
        const next = snapshot.states(field, value);
        if (next === "excluded") return "excluded";
        if (next === "selected") state = "selected";
      }
      return state;
    },
    [only, snapshot],
  );
  const apply = useCallback(
    (intent: ChartSelectionIntent) => {
      driver.select(intent.field, intent.values, {
        toggle: intent.mode === "toggle",
        replace: intent.mode === "replace",
      });
    },
    [driver],
  );
  return useMemo(() => ({ snapshot, selectionStates, apply }), [apply, selectionStates, snapshot]);
}
