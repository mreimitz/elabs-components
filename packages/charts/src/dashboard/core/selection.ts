/**
 * The selection seam (analysis §5.1, §5.3; R13, R14). Framework-free.
 *
 * Tiles never filter data themselves: they read `SelectionSnapshot.states(field, value)` and
 * paint, and they emit `select(field, values, opts)` intents. Who computes the states is the
 * `SelectionDriver`'s business — the bundled local driver intersects registered rows; a host
 * engine driver replaces it wholesale.
 */

/** A value a field can be selected on. */
export type SelectionValue = string | number;

/** The one tri-state vocabulary (the encoding `@elabs-ai/components-process` ships). */
export type SelectionState = "selected" | "associated" | "excluded";

/** One field's selection as the selection bar shows it. */
export interface SelectionFieldState {
  /** Selected values, in selection order. Empty only when the field is locked with nothing selected. */
  values: SelectionValue[];
  /** A locked field ignores `select` and `clear` until unlocked. */
  locked?: boolean;
}

/** An immutable view of the selection at one moment. */
export interface SelectionSnapshot {
  /** Fields that carry a selection or a lock. */
  readonly fields: Readonly<Record<string, Readonly<SelectionFieldState>>>;
  /** State of one value of one field. */
  states(field: string, value: unknown): SelectionState;
  /** Selected values in `field`; without a field, how many fields carry a selection. */
  count(field?: string): number;
}

/** How `select` combines `values` with the field's current selection. */
export interface SelectionOptions {
  /** Flip each value in or out of the selection. */
  toggle?: boolean;
  /** Make `values` the field's whole selection (an empty list clears the field). */
  replace?: boolean;
}

/** A tile's selection intent. Without `toggle`/`replace`, `values` are added to the field. */
export interface SelectionIntent extends SelectionOptions {
  field: string;
  values: SelectionValue[];
}

/** Computes and owns selection state; the store only mirrors `getSnapshot()`. */
export interface SelectionDriver {
  /** The current snapshot. Returns the SAME object until something changes. */
  getSnapshot(): SelectionSnapshot;
  /** Called after every change; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  select(field: string, values: SelectionValue[], opts?: SelectionOptions): void;
  /** Clear one field, or every unlocked field. */
  clear(field?: string): void;
  lock(field: string, locked: boolean): void;
  /** Step back through selection history. */
  back(): void;
  /** Step forward through selection history. */
  forward(): void;
  canBack(): boolean;
  canForward(): boolean;
  /** Local driver only: declare a consuming tile's rows; returns the unregister function. */
  register?(
    tileId: string,
    rows: readonly Record<string, unknown>[],
    fields: readonly string[],
  ): () => void;
}

/**
 * Build an immutable snapshot.
 *
 * `associated` maps a field to the values still possible under the current selection. State
 * resolution: a selected value is `selected`; another value in a field that carries a
 * selection is `excluded`; a field with an `associated` set is `associated` for members and
 * `excluded` for the rest; any other field (no selection, no association known) is `associated`.
 */
export function createSelectionSnapshot(
  fields: Record<string, SelectionFieldState>,
  associated: Record<string, ReadonlySet<unknown>> = {},
): SelectionSnapshot {
  const frozen: Record<string, Readonly<SelectionFieldState>> = {};
  const selectedSets = new Map<string, Set<unknown>>();
  for (const [field, state] of Object.entries(fields)) {
    const values = Object.freeze([...state.values]);
    const entry: SelectionFieldState = { values: values as SelectionValue[] };
    if (state.locked) entry.locked = true;
    frozen[field] = Object.freeze(entry);
    if (values.length > 0) selectedSets.set(field, new Set(values));
  }
  Object.freeze(frozen);
  const associatedSets = new Map(Object.entries(associated));

  return Object.freeze({
    fields: frozen,
    states(field: string, value: unknown): SelectionState {
      const selected = selectedSets.get(field);
      if (selected) return selected.has(value) ? "selected" : "excluded";
      const possible = associatedSets.get(field);
      if (possible) return possible.has(value) ? "associated" : "excluded";
      return "associated";
    },
    count(field?: string): number {
      if (field === undefined) return selectedSets.size;
      return selectedSets.get(field)?.size ?? 0;
    },
  });
}

/** Apply `opts` to a field's current values. Pure; returns the next values in selection order. */
export function applySelectionValues(
  current: readonly SelectionValue[],
  values: readonly SelectionValue[],
  opts: SelectionOptions = {},
): SelectionValue[] {
  if (opts.replace) return [...new Set(values)];
  const next = new Set(current);
  for (const value of values) {
    if (opts.toggle && next.has(value)) next.delete(value);
    else next.add(value);
  }
  return [...next];
}

/** The empty selection. */
export const EMPTY_SELECTION: SelectionSnapshot = createSelectionSnapshot({});
