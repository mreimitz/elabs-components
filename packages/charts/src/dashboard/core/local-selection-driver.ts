/**
 * The bundled `SelectionDriver` (analysis §5.3). Framework-free, prototype scale.
 *
 * Every consuming tile registers its rows and the fields it shows. Association for a field is
 * the intersection, across the tiles that show it, of the values still present in each tile's
 * rows after that tile's rows are narrowed by every selected field it also shows. It is not a
 * full associative engine: a selection does not propagate through a tile that lacks the
 * selected field. Past ~100 k rows, bring an engine driver.
 */
import {
  applySelectionValues,
  createSelectionSnapshot,
  type SelectionDriver,
  type SelectionFieldState,
  type SelectionSnapshot,
  type SelectionValue,
} from "./selection";

/** Options for `createLocalSelectionDriver`. */
export interface LocalSelectionDriverOptions {
  /** Selection steps `back()` can walk. Default 50. */
  historyLimit?: number;
}

/** The local driver; `register` is always present. */
export interface LocalSelectionDriver extends SelectionDriver {
  register(
    tileId: string,
    rows: readonly Record<string, unknown>[],
    fields: readonly string[],
  ): () => void;
}

type Selected = ReadonlyMap<string, readonly SelectionValue[]>;

/** Per-field index built once at registration: value → row indices. */
interface Dataset {
  rows: readonly Record<string, unknown>[];
  index: Map<string, Map<unknown, number[]>>;
  mark: Uint32Array;
}

interface Registration {
  dataset: Dataset;
  fields: readonly string[];
}

function buildIndex(dataset: Dataset, field: string): Map<unknown, number[]> {
  let byValue = dataset.index.get(field);
  if (byValue) return byValue;
  byValue = new Map();
  const { rows } = dataset;
  for (let i = 0; i < rows.length; i++) {
    const value = rows[i]?.[field];
    const list = byValue.get(value);
    if (list) list.push(i);
    else byValue.set(value, [i]);
  }
  dataset.index.set(field, byValue);
  return byValue;
}

function sameValues(a: readonly SelectionValue[], b: readonly SelectionValue[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** Create a local selection driver. One instance per sheet. */
export function createLocalSelectionDriver(
  options: LocalSelectionDriverOptions = {},
): LocalSelectionDriver {
  const limit = Math.max(1, Math.floor(options.historyLimit ?? 50));
  let selected: Selected = new Map();
  const locked = new Set<string>();
  let ring: Selected[] = [selected];
  let cursor = 0;
  const registrations = new Map<string, Registration>();
  const datasets = new WeakMap<object, Dataset>();
  const listeners = new Set<() => void>();
  let snapshot: SelectionSnapshot | null = null;
  let generation = 1;

  const emit = () => {
    snapshot = null;
    for (const listener of [...listeners]) listener();
  };

  const record = (next: Selected) => {
    selected = next;
    ring = ring.slice(0, cursor + 1);
    ring.push(next);
    if (ring.length > limit + 1) ring = ring.slice(ring.length - limit - 1);
    cursor = ring.length - 1;
    emit();
  };

  const withField = (field: string, values: readonly SelectionValue[]): Selected => {
    const next = new Map(selected);
    if (values.length === 0) next.delete(field);
    else next.set(field, values);
    return next;
  };

  const computeAssociated = (): Record<string, ReadonlySet<unknown>> => {
    const out: Record<string, Set<unknown>> = {};
    if (selected.size === 0) return out;
    generation++;
    if (generation >= 0xffffffff) generation = 1;
    // Group by dataset so tiles sharing one rows array are narrowed once.
    const perDataset = new Map<Dataset, Set<string>>();
    for (const { dataset, fields } of registrations.values()) {
      let set = perDataset.get(dataset);
      if (!set) perDataset.set(dataset, (set = new Set()));
      for (const field of fields) set.add(field);
    }
    for (const [dataset, fieldSet] of perDataset) {
      const fields = [...fieldSet];
      const constraints = fields.filter((field) => selected.has(field));
      if (constraints.length === 0) continue; // unconstrained: every value stays possible
      // Seed from the most selective constraint via its index, then check the rest per row.
      let seedField = "";
      let best = Number.POSITIVE_INFINITY;
      for (const field of constraints) {
        const index = buildIndex(dataset, field);
        let size = 0;
        for (const value of selected.get(field) ?? []) size += index.get(value)?.length ?? 0;
        if (size < best) {
          best = size;
          seedField = field;
        }
      }
      const seedIndex = buildIndex(dataset, seedField);
      const rest = constraints
        .filter((field) => field !== seedField)
        .map((field) => [field, new Set<unknown>(selected.get(field))] as const);
      const { rows, mark } = dataset;
      const stamp = generation;
      for (const value of selected.get(seedField) ?? []) {
        for (const i of seedIndex.get(value) ?? []) {
          if (rest.length === 0 || rest.every(([field, allowed]) => allowed.has(rows[i]?.[field])))
            mark[i] = stamp;
        }
      }
      for (const field of fields) {
        if (selected.has(field)) continue;
        const possible = new Set<unknown>();
        for (const [value, list] of buildIndex(dataset, field)) {
          for (const i of list) {
            if (mark[i] === stamp) {
              possible.add(value);
              break;
            }
          }
        }
        const prior = out[field];
        if (!prior) out[field] = possible;
        else for (const value of prior) if (!possible.has(value)) prior.delete(value);
      }
    }
    return out;
  };

  const driver: LocalSelectionDriver = {
    getSnapshot() {
      if (snapshot) return snapshot;
      const fields: Record<string, SelectionFieldState> = {};
      for (const [field, values] of selected) fields[field] = { values: [...values] };
      for (const field of locked)
        fields[field] = { values: fields[field]?.values ?? [], locked: true };
      snapshot = createSelectionSnapshot(fields, computeAssociated());
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select(field, values, opts) {
      if (locked.has(field)) return;
      const current = selected.get(field) ?? [];
      const next = applySelectionValues(current, values, opts);
      if (sameValues(current, next)) return;
      record(withField(field, next));
    },
    clear(field) {
      if (field !== undefined) {
        if (locked.has(field) || !selected.has(field)) return;
        record(withField(field, []));
        return;
      }
      const next = new Map([...selected].filter(([name]) => locked.has(name)));
      if (next.size === selected.size) return;
      record(next);
    },
    lock(field, isLocked) {
      if (locked.has(field) === isLocked) return;
      if (isLocked) locked.add(field);
      else locked.delete(field);
      emit();
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
    register(tileId, rows, fields) {
      let dataset = datasets.get(rows);
      if (!dataset) {
        dataset = { rows, index: new Map(), mark: new Uint32Array(rows.length) };
        datasets.set(rows, dataset);
      }
      for (const field of fields) buildIndex(dataset, field);
      const registration: Registration = { dataset, fields: [...fields] };
      registrations.set(tileId, registration);
      emit();
      return () => {
        if (registrations.get(tileId) !== registration) return;
        registrations.delete(tileId);
        emit();
      };
    },
  };
  return driver;
}
