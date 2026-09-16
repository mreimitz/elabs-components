"use client";

import type {
  SelectionFieldState,
  SelectionOptions,
  SelectionSnapshot,
  SelectionValue,
} from "../core/selection";
import { useDashboard, useDashboardActions } from "./use-dashboard";

/** One field's selection plus the intents that change it. */
export interface FieldSelection {
  field: string;
  /** The field's state, or `undefined` when nothing is selected or locked in it. */
  state: Readonly<SelectionFieldState> | undefined;
  snapshot: SelectionSnapshot;
  select(values: SelectionValue[], opts?: SelectionOptions): void;
  clear(): void;
}

/** The whole selection snapshot. */
export function useSelection(): SelectionSnapshot;
/** One field's selection and its intents. */
export function useSelection(field: string): FieldSelection;
export function useSelection(field?: string): SelectionSnapshot | FieldSelection {
  const snapshot = useDashboard((state) => state.selection);
  const actions = useDashboardActions();
  if (field === undefined) return snapshot;
  return {
    field,
    state: snapshot.fields[field],
    snapshot,
    select: (values, opts) => actions.select(field, values, opts),
    clear: () => actions.clearSelection(field),
  };
}
