/**
 * `createMockEngine` (RM-085, #433) — an in-memory stand-in for a host's own associative
 * selection engine. Nothing here is a real SDK: the shape mirrors a Qlik `SelectionObject` +
 * `Field.selectValues` — fields, an ASYNCHRONOUS `selectValues` that resolves on the next tick,
 * `getStates()` computed fresh by row intersection, its own `back`/`forward`/`clear` history, and
 * an `onChange` subscription — without a line of Qlik code (`.claude/rules/dashboard.md`:
 * `dashboard/` imports only `charts`/`ui`/`tokens`/`icons`).
 *
 * REFERENCE IMPLEMENTATION, not shipped API. Nothing in `@elabs-ai/components-charts/dashboard`
 * imports this module (it lives beside its story and test, never re-exported from
 * `dashboard/index.ts`) — copy it into your own app and replace the body of `selectValues` with
 * a call into your real engine's client; everything else here — `createEngineDriver`
 * (`./create-engine-driver.ts`) and the tri-state math — carries over unchanged.
 *
 * Simplification worth knowing before you adapt this: every field's values are compared with
 * `===`, so this example only carries STRING categories (`"EMEA"`, not `1`/`"1"` ambiguity) —
 * a real engine's own client normally hands you already-typed values, so this is a fixture
 * limitation, not a `SelectionDriver` one.
 */

/** One field's value state, by row intersection with every OTHER selected field. */
export type MockEngineState = "selected" | "associated" | "excluded";

/** One data row the engine's fields are read from. */
export interface MockEngineRow {
  [field: string]: string | number;
}

/** Options for `createMockEngine`. */
export interface MockEngineOptions {
  /** Selection steps `back()`/`forward()` can walk. Default 50. */
  historyLimit?: number;
  /** ms before `selectValues`/`clear` resolve and `onChange` fires. Default 0 (still a real tick — never synchronous). */
  latencyMs?: number;
}

/**
 * The engine's public surface. `selectValues`/`clear` are the only asynchronous members — every
 * read (`selected`, `getStates`, `canBack`/`canForward`) is synchronous against whatever the
 * engine currently holds, exactly like a real associative engine's own client.
 */
export interface MockEngine {
  readonly fields: readonly string[];
  /** Selected values, in selection order, for `field`. Empty when nothing is selected there. */
  selected(field: string): readonly (string | number)[];
  /**
   * `toggle: false` (the default) REPLACES the field's selection — a real associative engine's
   * `selectValues` sets the selection, it does not add to it (unlike
   * `core/local-selection-driver.ts`'s default "add" behaviour). `toggle: true` flips each value.
   * Resolves once the engine has applied the change and fired `onChange`.
   */
  selectValues(
    field: string,
    values: readonly (string | number)[],
    toggle?: boolean,
  ): Promise<void>;
  /** Every field's value states, recomputed from the CURRENT selection. */
  getStates(): Readonly<Record<string, Readonly<Record<string, MockEngineState>>>>;
  back(): void;
  forward(): void;
  canBack(): boolean;
  canForward(): boolean;
  /** Clear one field, or (without an argument) every field. Resolves like `selectValues`. */
  clear(field?: string): Promise<void>;
  /** Called after every change (a selection, a clear, a back/forward step). */
  onChange(listener: () => void): () => void;
}

type Selected = ReadonlyMap<string, readonly (string | number)[]>;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A row satisfies the CURRENT selection when every selected field (other than `skipField`)
 * includes that row's value for that field. `skipField` lets `getStates` ask "still possible for
 * THIS field" without the field's own selection vetoing every one of its other values.
 */
function rowMatches(row: MockEngineRow, selected: Selected, skipField?: string): boolean {
  for (const [field, values] of selected) {
    if (field === skipField) continue;
    if (!values.includes(row[field] as string | number)) return false;
  }
  return true;
}

/** Build a mock associative engine over `rows`, tracking selection state for each of `fields`. */
export function createMockEngine(
  rows: readonly MockEngineRow[],
  fields: readonly string[],
  options: MockEngineOptions = {},
): MockEngine {
  const historyLimit = Math.max(1, Math.floor(options.historyLimit ?? 50));
  const latency = Math.max(0, options.latencyMs ?? 0);

  let selected: Selected = new Map();
  let ring: Selected[] = [selected];
  let cursor = 0;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of [...listeners]) listener();
  };

  const record = (next: Selected) => {
    selected = next;
    ring = ring.slice(0, cursor + 1);
    ring.push(next);
    if (ring.length > historyLimit + 1) ring = ring.slice(ring.length - historyLimit - 1);
    cursor = ring.length - 1;
  };

  return {
    fields: [...fields],
    selected: (field) => [...(selected.get(field) ?? [])],
    async selectValues(field, values, toggle = false) {
      await wait(latency);
      let next: (string | number)[];
      if (toggle) {
        const set = new Set(selected.get(field) ?? []);
        for (const value of values) {
          if (set.has(value)) set.delete(value);
          else set.add(value);
        }
        next = [...set];
      } else {
        next = [...new Set(values)];
      }
      const nextMap = new Map(selected);
      if (next.length === 0) nextMap.delete(field);
      else nextMap.set(field, next);
      record(nextMap);
      emit();
    },
    getStates() {
      const out: Record<string, Record<string, MockEngineState>> = {};
      for (const field of fields) {
        const own = selected.get(field);
        const domain = new Set<string | number>();
        for (const row of rows) {
          const value = row[field];
          if (value !== undefined) domain.add(value);
        }
        const states: Record<string, MockEngineState> = {};
        for (const value of domain) {
          const key = String(value);
          if (own) {
            states[key] = own.includes(value) ? "selected" : "excluded";
            continue;
          }
          const possible = rows.some(
            (row) => row[field] === value && rowMatches(row, selected, field),
          );
          states[key] = possible ? "associated" : "excluded";
        }
        out[field] = states;
      }
      return out;
    },
    back() {
      if (cursor === 0) return;
      cursor--;
      selected = ring[cursor] as Selected;
      emit();
    },
    forward() {
      if (cursor >= ring.length - 1) return;
      cursor++;
      selected = ring[cursor] as Selected;
      emit();
    },
    canBack: () => cursor > 0,
    canForward: () => cursor < ring.length - 1,
    async clear(field) {
      await wait(latency);
      if (field !== undefined) {
        if (!selected.has(field)) return;
        const next = new Map(selected);
        next.delete(field);
        record(next);
      } else {
        if (selected.size === 0) return;
        record(new Map());
      }
      emit();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
