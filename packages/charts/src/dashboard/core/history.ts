/**
 * Linear undo/redo history (R17). Framework-free.
 *
 * The history holds a `present` value plus bounded `past` and `future` stacks. `batch` (or a
 * `begin`/`end` pair spanning several events, e.g. a drag gesture) folds many pushes into one
 * undo step. Values are deep-frozen outside production so an accidental mutation throws.
 */

/** A bounded undo/redo history. */
export interface History<T> {
  /** The current value. */
  readonly present: T;
  /** Record `value` as the new present. Clears redo. Inside a batch it only replaces the present. */
  push(value: T): void;
  /** Step back; returns the new present, or `undefined` when there is nothing to undo. */
  undo(): T | undefined;
  /** Step forward; returns the new present, or `undefined` when there is nothing to redo. */
  redo(): T | undefined;
  /** Run `fn`; every push inside it becomes ONE undo step. Nests. */
  batch<R>(fn: () => R): R;
  /** Open a batch that spans several events. Pair with `end()` or `cancel()`. */
  begin(): void;
  /** Close the outermost open batch, committing its pushes as one step. */
  end(): void;
  /** Abandon every open batch; returns the present from before it (now the present again). */
  cancel(): T;
  /** Whether a batch is open. */
  inBatch(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Remember the present as the clean point. */
  mark(): void;
  /** Whether the present differs from the last `mark()` (or the initial value). */
  isDirtySince(): boolean;
  /** Sizes of the undo and redo stacks. */
  size(): { past: number; future: number };
}

function isDev(): boolean {
  return typeof process === "undefined" || process.env?.NODE_ENV !== "production";
}

/** Deep-freeze a plain value in place (dev only) and return it. */
export function freezeDeep<T>(value: T): T {
  if (!isDev() || value === null || typeof value !== "object" || Object.isFrozen(value))
    return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object))
    freezeDeep((value as Record<string, unknown>)[key]);
  return value;
}

/** Create a history holding `initial`, keeping at most `limit` undo steps (default 50). */
export function createHistory<T>(initial: T, limit = 50): History<T> {
  const max = Math.max(1, Math.floor(limit));
  let present = freezeDeep(initial);
  let past: T[] = [];
  let future: T[] = [];
  let marked: T = present;
  let depth = 0;
  let batchBase: T = present;
  let batchChanged = false;

  const commit = (previous: T) => {
    past.push(previous);
    if (past.length > max) past = past.slice(past.length - max);
    future = [];
  };

  const history: History<T> = {
    get present() {
      return present;
    },
    push(value) {
      const next = freezeDeep(value);
      if (depth > 0) {
        batchChanged = true;
        present = next;
        return;
      }
      commit(present);
      present = next;
    },
    undo() {
      if (depth > 0 || past.length === 0) return undefined;
      future.push(present);
      present = past.pop() as T;
      return present;
    },
    redo() {
      if (depth > 0 || future.length === 0) return undefined;
      past.push(present);
      present = future.pop() as T;
      return present;
    },
    batch(fn) {
      history.begin();
      try {
        return fn();
      } finally {
        if (depth > 0) history.end();
      }
    },
    begin() {
      if (depth === 0) {
        batchBase = present;
        batchChanged = false;
      }
      depth++;
    },
    end() {
      if (depth === 0) return;
      depth--;
      if (depth === 0 && batchChanged) commit(batchBase);
    },
    cancel() {
      if (depth > 0) {
        depth = 0;
        present = batchBase;
        batchChanged = false;
      }
      return present;
    },
    inBatch: () => depth > 0,
    canUndo: () => depth === 0 && past.length > 0,
    canRedo: () => depth === 0 && future.length > 0,
    mark() {
      marked = present;
    },
    isDirtySince: () => present !== marked,
    size: () => ({ past: past.length, future: future.length }),
  };
  return history;
}
