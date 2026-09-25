/**
 * grid-state.ts — DataTable / DataGrid view state as a VERSIONED JSON
 * document: what a saved view, a URL, a database row or an agent writes.
 * `serializeGridState` stamps the version; `parseGridState` validates any
 * input (including older, unversioned snapshots), migrates it forward and
 * reports what it had to drop instead of throwing. `GRID_STATE_JSON_SCHEMA`
 * is the contract an agent can be given.
 */
import type { DataTableViewState } from "./data-table";

export const GRID_STATE_VERSION = 1;

/** A serialised view: `DataTableViewState` plus its format version. */
export type GridState = DataTableViewState & { version: typeof GRID_STATE_VERSION };

export interface ParsedGridState {
  state: DataTableViewState;
  /** Paths that were invalid and dropped (the rest of the state still applies). */
  dropped: string[];
  /** The version the input was written in (0 = an unversioned snapshot). */
  fromVersion: number;
}

/** Stamps the current version; drops empty optional slices so saved views stay small. */
export function serializeGridState(view: DataTableViewState): GridState {
  const out: Record<string, unknown> = { version: GRID_STATE_VERSION };
  for (const [key, value] of Object.entries(view)) {
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0 && !REQUIRED.has(key)) continue;
    if (isPlainObject(value) && Object.keys(value).length === 0 && !REQUIRED.has(key)) continue;
    out[key] = value;
  }
  return out as unknown as GridState;
}

const REQUIRED = new Set(["sorting", "columnVisibility", "columnFilters"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Per-slice validators: return the cleaned value, or `undefined` to drop it. */
const SLICES: Record<string, (value: unknown) => unknown> = {
  sorting: (v) =>
    Array.isArray(v) &&
    v.every((s) => isPlainObject(s) && typeof s.id === "string" && typeof s.desc === "boolean")
      ? v.map((s) => ({ id: s.id, desc: s.desc }))
      : undefined,
  columnVisibility: (v) =>
    isPlainObject(v) && Object.values(v).every((x) => typeof x === "boolean")
      ? { ...v }
      : undefined,
  columnFilters: (v) =>
    Array.isArray(v) && v.every((f) => isPlainObject(f) && typeof f.id === "string" && "value" in f)
      ? v.map((f) => ({ id: f.id, value: f.value }))
      : undefined,
  globalFilter: (v) => (typeof v === "string" ? v : undefined),
  pagination: (v) =>
    isPlainObject(v) &&
    isFiniteNumber(v.pageIndex) &&
    isFiniteNumber(v.pageSize) &&
    v.pageIndex >= 0 &&
    v.pageSize > 0
      ? { pageIndex: Math.floor(v.pageIndex), pageSize: Math.floor(v.pageSize) }
      : undefined,
  columnPinning: (v) =>
    isPlainObject(v) &&
    (v.left === undefined || isStringArray(v.left)) &&
    (v.right === undefined || isStringArray(v.right))
      ? { left: (v.left as string[]) ?? [], right: (v.right as string[]) ?? [] }
      : undefined,
  rowSelection: (v) =>
    isPlainObject(v) && Object.values(v).every((x) => typeof x === "boolean")
      ? { ...v }
      : undefined,
  columnSizing: (v) =>
    isPlainObject(v) && Object.values(v).every((x) => isFiniteNumber(x) && x > 0)
      ? { ...v }
      : undefined,
  cellSelection: (v) =>
    Array.isArray(v) &&
    v.every(
      (r) =>
        isPlainObject(r) &&
        ["anchorRowId", "anchorColumnId", "focusRowId", "focusColumnId"].every(
          (k) => typeof r[k] === "string",
        ) &&
        (r.operation === undefined || r.operation === "include" || r.operation === "exclude"),
    )
      ? v
      : undefined,
  columnOrder: (v) => (isStringArray(v) ? [...v] : undefined),
  grouping: (v) => (isStringArray(v) ? [...v] : undefined),
  expanded: (v) =>
    v === true || (isPlainObject(v) && Object.values(v).every((x) => typeof x === "boolean"))
      ? v
      : undefined,
};

/** Forward migrations, keyed by the version they upgrade FROM. */
const MIGRATIONS: Record<number, (input: Record<string, unknown>) => Record<string, unknown>> = {
  // v0 → v1: unversioned snapshots; v8-era pinning keys `start` / `end` read as left / right.
  0: (input) => {
    const pinning = input.columnPinning;
    if (isPlainObject(pinning) && ("start" in pinning || "end" in pinning)) {
      return {
        ...input,
        columnPinning: { left: pinning.start ?? pinning.left, right: pinning.end ?? pinning.right },
      };
    }
    return input;
  },
};

/**
 * Reads a saved view (object or JSON text). Unknown keys and invalid slices
 * are dropped and listed in `dropped`; `sorting`, `columnVisibility` and
 * `columnFilters` default to empty. Throws only for input that is not an
 * object at all, or a version newer than this build understands.
 */
export function parseGridState(input: unknown): ParsedGridState {
  let raw: unknown = input;
  if (typeof raw === "string") raw = JSON.parse(raw);
  if (!isPlainObject(raw)) throw new TypeError("Grid state must be an object.");
  const fromVersion = raw.version === undefined ? 0 : Number(raw.version);
  if (!Number.isInteger(fromVersion) || fromVersion < 0)
    throw new TypeError("Invalid grid state version.");
  if (fromVersion > GRID_STATE_VERSION) {
    throw new RangeError(
      `Grid state version ${fromVersion} is newer than this build supports (${GRID_STATE_VERSION}).`,
    );
  }
  let doc: Record<string, unknown> = { ...raw };
  for (let v = fromVersion; v < GRID_STATE_VERSION; v++) doc = MIGRATIONS[v]?.(doc) ?? doc;

  const dropped: string[] = [];
  const state: Record<string, unknown> = { sorting: [], columnVisibility: {}, columnFilters: [] };
  for (const [key, value] of Object.entries(doc)) {
    if (key === "version") continue;
    const clean = SLICES[key];
    if (!clean) {
      dropped.push(key);
      continue;
    }
    if (value === undefined) continue;
    const next = clean(value);
    if (next === undefined) dropped.push(key);
    else state[key] = next;
  }
  return { state: state as unknown as DataTableViewState, dropped, fromVersion };
}

const stringArray = { type: "array", items: { type: "string" } } as const;
const booleanMap = { type: "object", additionalProperties: { type: "boolean" } } as const;

/** JSON Schema (draft 2020-12) of `GridState` — the contract to hand an agent. */
export const GRID_STATE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://github.com/mreimitz/elabs-components/packages/data/schemas/grid-state.v1.schema.json",
  title: "GridState",
  description:
    "A DataTable / DataGrid view: sorting, filters, column layout, grouping and selection. Column ids are the table's column ids.",
  type: "object",
  required: ["version"],
  additionalProperties: false,
  properties: {
    version: { const: GRID_STATE_VERSION },
    sorting: {
      type: "array",
      description: "Sort order, first entry wins.",
      items: {
        type: "object",
        required: ["id", "desc"],
        properties: { id: { type: "string" }, desc: { type: "boolean" } },
        additionalProperties: false,
      },
    },
    columnVisibility: { ...booleanMap, description: "Column id → shown (false hides)." },
    columnFilters: {
      type: "array",
      description:
        "Per-column filters. value is a filter model: {type:'text'|'number'|'date', conditions:[{op, value?, to?, preset?}], join?:'and'|'or'} | {type:'set', values: string[]} | {type:'boolean', value: boolean}.",
      items: {
        type: "object",
        required: ["id", "value"],
        properties: { id: { type: "string" }, value: {} },
        additionalProperties: false,
      },
    },
    globalFilter: { type: "string", description: "Search across all columns." },
    pagination: {
      type: "object",
      required: ["pageIndex", "pageSize"],
      properties: {
        pageIndex: { type: "integer", minimum: 0 },
        pageSize: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    },
    columnPinning: {
      type: "object",
      properties: { left: stringArray, right: stringArray },
      additionalProperties: false,
    },
    rowSelection: { ...booleanMap, description: "Row id → checked." },
    columnSizing: {
      type: "object",
      additionalProperties: { type: "number", exclusiveMinimum: 0 },
      description: "Column id → width in px.",
    },
    cellSelection: {
      type: "array",
      items: {
        type: "object",
        required: ["anchorRowId", "anchorColumnId", "focusRowId", "focusColumnId"],
        properties: {
          anchorRowId: { type: "string" },
          anchorColumnId: { type: "string" },
          focusRowId: { type: "string" },
          focusColumnId: { type: "string" },
          operation: { enum: ["include", "exclude"] },
        },
        additionalProperties: false,
      },
    },
    columnOrder: { ...stringArray, description: "Leaf column ids in display order." },
    grouping: { ...stringArray, description: "Row grouping, outermost first." },
    expanded: {
      description: "true expands every group / tree row; else row id → expanded.",
      oneOf: [{ const: true }, booleanMap],
    },
  },
} as const;
