/**
 * validate.ts — `validateDashboardSpec` (typed errors) and `normalizeDashboardSpec`
 * (defaults, clamping, ids, repairs) for `DashboardSpec` (R4).
 *
 * The validator never throws and never repairs; the normaliser never rejects. Run the
 * validator on untrusted input (an agent tool-call, a stored document), then normalise
 * before rendering. Unknown tile kinds are a warning, not an error: the renderer decides
 * what to draw for them.
 */

import { compileCondition } from "./expression";
import {
  DEFAULT_GRID_COLUMNS,
  DEFAULT_GRID_GAP,
  DEFAULT_GRID_ROWS,
  DEFAULT_ROW_HEIGHT,
  collides,
  compact,
  correctBounds,
} from "./layout";
import type {
  DashboardSpec,
  DashboardSpecError,
  DashboardSpecWarning,
  GridSpec,
  TileLayout,
  TileSpec,
} from "./spec";

/** Result of `validateDashboardSpec`. */
export type DashboardSpecValidation =
  | { ok: true; spec: DashboardSpec }
  | { ok: false; errors: DashboardSpecError[] };

/** Result of `normalizeDashboardSpec`. */
export interface DashboardSpecNormalization {
  spec: DashboardSpec;
  warnings: DashboardSpecWarning[];
}

/** Options for `normalizeDashboardSpec`. */
export interface NormalizeDashboardSpecOptions {
  /** Tile kinds the host can render; when given, any other kind produces an `unknown-kind` warning. */
  kinds?: readonly string[];
}

/** `columns × rows` each `GridSpec.density` preset resolves to (R3). */
export const GRID_DENSITY_PRESETS = {
  wide: { columns: 24, rows: 12 },
  medium: { columns: 48, rows: 24 },
  narrow: { columns: 72, rows: 36 },
} as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Check an unknown value against the `DashboardSpec` contract. Collects every problem
 * rather than stopping at the first. Missing tile ids and grid defaults are allowed (the
 * normaliser fills them); duplicate ids, dangling `ref`s, nested containers, bad
 * `visibleWhen` conditions and `fit`-mode overlaps are errors.
 */
export function validateDashboardSpec(input: unknown): DashboardSpecValidation {
  const errors: DashboardSpecError[] = [];
  const err = (path: string, code: DashboardSpecError["code"], message: string) =>
    errors.push({ path, code, message });

  const string = (obj: UnknownRecord, key: string, path: string, required: boolean) => {
    const value = obj[key];
    if (value === undefined) {
      if (required) err(`${path}.${key}`, "missing", `${key} is required`);
      return false;
    }
    if (typeof value !== "string") {
      err(`${path}.${key}`, "type", `${key} must be a string`);
      return false;
    }
    return true;
  };
  const number = (
    obj: UnknownRecord,
    key: string,
    path: string,
    opts: { required?: boolean; min?: number; integer?: boolean } = {},
  ) => {
    const value = obj[key];
    if (value === undefined) {
      if (opts.required) err(`${path}.${key}`, "missing", `${key} is required`);
      return;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      err(`${path}.${key}`, "type", `${key} must be a finite number`);
      return;
    }
    if (opts.integer && !Number.isInteger(value))
      err(`${path}.${key}`, "type", `${key} must be an integer`);
    if (opts.min !== undefined && value < opts.min)
      err(`${path}.${key}`, "range", `${key} must be ≥ ${opts.min}`);
  };
  const oneOf = (obj: UnknownRecord, key: string, path: string, allowed: readonly string[]) => {
    const value = obj[key];
    if (value === undefined) return;
    if (typeof value !== "string") err(`${path}.${key}`, "type", `${key} must be a string`);
    else if (!allowed.includes(value))
      err(`${path}.${key}`, "range", `${key} must be one of ${allowed.join(", ")}`);
  };
  const array = (obj: UnknownRecord, key: string, path: string, required: boolean) => {
    const value = obj[key];
    if (value === undefined) {
      if (required) err(`${path}.${key}`, "missing", `${key} is required`);
      return [] as unknown[];
    }
    if (!Array.isArray(value)) {
      err(`${path}.${key}`, "type", `${key} must be an array`);
      return [] as unknown[];
    }
    return value as unknown[];
  };

  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: "$", code: "type", message: "spec must be an object" }] };
  }
  if (input.version === undefined) err("$.version", "missing", "version is required");
  else if (input.version !== 1) err("$.version", "version", "only version 1 is supported");
  string(input, "id", "$", true);
  string(input, "title", "$", false);
  string(input, "description", "$", false);

  // grid
  let grid: GridSpec = { mode: "fit", columns: DEFAULT_GRID_COLUMNS };
  if (input.grid === undefined) err("$.grid", "missing", "grid is required");
  else if (!isRecord(input.grid)) err("$.grid", "type", "grid must be an object");
  else {
    const g = input.grid;
    oneOf(g, "mode", "$.grid", ["fit", "flow"]);
    number(g, "columns", "$.grid", { min: 1, integer: true });
    number(g, "rows", "$.grid", { min: 1, integer: true });
    number(g, "rowHeight", "$.grid", { min: 1 });
    number(g, "gap", "$.grid", { min: 0 });
    oneOf(g, "density", "$.grid", ["narrow", "medium", "wide", "custom"]);
    if (g.extendable !== undefined && typeof g.extendable !== "boolean")
      err("$.grid.extendable", "type", "extendable must be a boolean");
    grid = resolveGrid(g as Partial<GridSpec>);
  }

  const ids = new Map<string, string>();
  const claim = (id: unknown, path: string) => {
    if (typeof id !== "string") return;
    const first = ids.get(id);
    if (first) err(path, "duplicate-id", `id “${id}” is already used at ${first}`);
    else ids.set(id, path);
  };

  const layoutOf = (obj: UnknownRecord, path: string): TileLayout | null => {
    if (obj.layout === undefined) {
      err(`${path}.layout`, "missing", "layout is required");
      return null;
    }
    if (!isRecord(obj.layout)) {
      err(`${path}.layout`, "type", "layout must be an object");
      return null;
    }
    const before = errors.length;
    const l = obj.layout;
    const lp = `${path}.layout`;
    number(l, "x", lp, { required: true, min: 0 });
    number(l, "y", lp, { required: true, min: 0 });
    number(l, "w", lp, { required: true, min: 1 });
    number(l, "h", lp, { required: true, min: 1 });
    for (const key of ["minW", "minH", "maxW", "maxH", "aspect"]) number(l, key, lp, { min: 0 });
    number(l, "z", lp);
    if (errors.length > before) return null;
    return { ...(l as Omit<TileLayout, "id">), id: typeof obj.id === "string" ? obj.id : path };
  };

  // library
  const libraryIds = new Set<string>();
  array(input, "library", "$", false).forEach((entry, i) => {
    const path = `$.library[${i}]`;
    if (!isRecord(entry)) return err(path, "type", "library entry must be an object");
    if (string(entry, "id", path, true)) libraryIds.add(entry.id as string);
    string(entry, "kind", path, true);
    string(entry, "label", path, true);
    claim(entry.id, path);
  });

  // containers
  const containerIds = new Set<string>();
  const containers = array(input, "containers", "$", false);
  const topLevel: Array<{ layout: TileLayout; path: string }> = [];
  containers.forEach((entry, i) => {
    const path = `$.containers[${i}]`;
    if (!isRecord(entry)) return err(path, "type", "container must be an object");
    if (string(entry, "id", path, true)) containerIds.add(entry.id as string);
    claim(entry.id, path);
    if (entry.kind === undefined) err(`${path}.kind`, "missing", "kind is required");
    else oneOf(entry, "kind", path, ["tabs", "stack"]);
    const layout = layoutOf(entry, path);
    if (layout) topLevel.push({ layout, path: `${path}.layout` });
    array(entry, "children", path, true);
  });

  // tiles
  const tileIds = new Set<string>();
  const tiles = array(input, "tiles", "$", true);
  tiles.forEach((entry, i) => {
    const path = `$.tiles[${i}]`;
    if (!isRecord(entry)) return err(path, "type", "tile must be an object");
    if (string(entry, "id", path, false)) tileIds.add(entry.id as string);
    claim(entry.id, path);
    string(entry, "kind", path, true);
    for (const key of ["title", "subtitle", "footnote", "source"]) string(entry, key, path, false);
    const layout = layoutOf(entry, path);
    const inContainer = entry.container !== undefined;
    if (layout && !inContainer) topLevel.push({ layout, path: `${path}.layout` });
    if (string(entry, "ref", path, false) && !libraryIds.has(entry.ref as string))
      err(`${path}.ref`, "unknown-ref", `no library tile “${String(entry.ref)}”`);
    if (inContainer) {
      if (!isRecord(entry.container) || typeof entry.container.id !== "string")
        err(`${path}.container`, "type", "container must be { id: string; slot?: string }");
      else if (!containerIds.has(entry.container.id))
        err(`${path}.container.id`, "unknown-ref", `no container “${entry.container.id}”`);
    }
    if (string(entry, "visibleWhen", path, false)) {
      try {
        compileCondition(entry.visibleWhen as string);
      } catch (error) {
        err(`${path}.visibleWhen`, "expression", (error as Error).message);
      }
    }
  });

  containers.forEach((entry, i) => {
    if (!isRecord(entry) || !Array.isArray(entry.children)) return;
    entry.children.forEach((child, j) => {
      const path = `$.containers[${i}].children[${j}]`;
      if (typeof child !== "string") err(path, "type", "child must be a tile id");
      else if (containerIds.has(child))
        err(path, "nested-container", `container “${child}” cannot live inside a container`);
      else if (!tileIds.has(child)) err(path, "unknown-ref", `no tile “${child}”`);
    });
  });

  // filters, variables, bookmarks, interactions
  array(input, "filters", "$", false).forEach((entry, i) => {
    const path = `$.filters[${i}]`;
    if (!isRecord(entry)) return err(path, "type", "filter must be an object");
    string(entry, "id", path, true);
    string(entry, "field", path, true);
    oneOf(entry, "kind", path, ["single", "multi", "range"]);
    claim(entry.id, path);
  });
  const variableNames = new Set<string>();
  array(input, "variables", "$", false).forEach((entry, i) => {
    const path = `$.variables[${i}]`;
    if (!isRecord(entry)) return err(path, "type", "variable must be an object");
    if (string(entry, "name", path, true)) {
      const name = entry.name as string;
      if (variableNames.has(name))
        err(`${path}.name`, "duplicate-id", `variable “${name}” is already defined`);
      variableNames.add(name);
    }
    if (entry.type === undefined) err(`${path}.type`, "missing", "type is required");
    else oneOf(entry, "type", path, ["string", "number", "boolean", "date"]);
    if (entry.default === undefined) err(`${path}.default`, "missing", "default is required");
  });
  array(input, "bookmarks", "$", false).forEach((entry, i) => {
    const path = `$.bookmarks[${i}]`;
    if (!isRecord(entry)) return err(path, "type", "bookmark must be an object");
    string(entry, "id", path, true);
    string(entry, "label", path, true);
    if (!isRecord(entry.selection))
      err(
        `${path}.selection`,
        entry.selection === undefined ? "missing" : "type",
        "selection must be an object",
      );
    claim(entry.id, path);
  });
  array(input, "interactions", "$", false).forEach((entry, i) => {
    const path = `$.interactions[${i}]`;
    if (!isRecord(entry)) return err(path, "type", "interaction must be an object");
    if (string(entry, "from", path, true) && !tileIds.has(entry.from as string))
      err(`${path}.from`, "unknown-ref", `no tile “${String(entry.from)}”`);
    if (string(entry, "to", path, true) && entry.to !== "*" && !tileIds.has(entry.to as string))
      err(`${path}.to`, "unknown-ref", `no tile “${String(entry.to)}”`);
  });

  if (grid.mode === "fit") {
    for (let a = 0; a < topLevel.length; a++) {
      for (let b = a + 1; b < topLevel.length; b++) {
        const first = topLevel[a] as { layout: TileLayout; path: string };
        const second = topLevel[b] as { layout: TileLayout; path: string };
        if (collides(first.layout, second.layout))
          err(
            second.path,
            "overlap",
            `“${second.layout.id}” overlaps “${first.layout.id}” in a fit grid`,
          );
      }
    }
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, spec: input as unknown as DashboardSpec };
}

/** Fill grid defaults: `fit`, 24 columns, 12 rows (`fit`) / 30 px rows (`flow`), gap 8, density presets. */
function resolveGrid(grid: Partial<GridSpec>): GridSpec {
  const mode = grid.mode ?? "fit";
  const preset =
    grid.density && grid.density !== "custom" ? GRID_DENSITY_PRESETS[grid.density] : undefined;
  const out: GridSpec = {
    ...grid,
    mode,
    columns: preset?.columns ?? grid.columns ?? DEFAULT_GRID_COLUMNS,
    gap: grid.gap ?? DEFAULT_GRID_GAP,
  };
  if (mode === "fit") out.rows = preset?.rows ?? grid.rows ?? DEFAULT_GRID_ROWS;
  else out.rowHeight = grid.rowHeight ?? DEFAULT_ROW_HEIGHT;
  return out;
}

function sameLayout(a: Omit<TileLayout, "id">, b: Omit<TileLayout, "id">): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/**
 * Fill defaults and repair what can be repaired, without rejecting anything. Idempotent:
 * normalising a normalised spec returns a deep-equal spec and no warnings.
 *
 * - grid defaults (`fit`, 24 columns, 12 rows / 30 px row height, gap 8; density presets)
 * - `tile-<n>` ids for tiles without one
 * - every layout clamped with `correctBounds`
 * - `flow` overlaps repaired by `compact`
 * - `unknown-kind` warnings when `options.kinds` is given
 */
export function normalizeDashboardSpec(
  spec: DashboardSpec,
  options: NormalizeDashboardSpecOptions = {},
): DashboardSpecNormalization {
  const warnings: DashboardSpecWarning[] = [];
  const grid = resolveGrid(spec.grid ?? {});

  const used = new Set<string>(
    [...spec.tiles, ...(spec.containers ?? []), ...(spec.library ?? [])]
      .map((item) => item.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  let counter = 0;
  const nextId = () => {
    let id: string;
    do {
      counter++;
      id = `tile-${counter}`;
    } while (used.has(id));
    used.add(id);
    return id;
  };

  const clampLayout = (layout: Omit<TileLayout, "id">, id: string, path: string) => {
    const [bounded] = correctBounds([{ ...layout, id }], grid);
    const { id: _drop, ...rest } = bounded as TileLayout;
    void _drop;
    if (!sameLayout(rest, layout))
      warnings.push({
        path,
        code: "clamped",
        message: `layout of “${id}” was clamped to the grid`,
      });
    return rest;
  };

  let tiles: TileSpec[] = spec.tiles.map((tile, i) => {
    const path = `$.tiles[${i}]`;
    let id = tile.id;
    if (typeof id !== "string" || id.length === 0) {
      id = nextId();
      warnings.push({ path: `${path}.id`, code: "id-assigned", message: `assigned id “${id}”` });
    }
    if (options.kinds && !options.kinds.includes(tile.kind))
      warnings.push({
        path: `${path}.kind`,
        code: "unknown-kind",
        message: `no renderer registered for kind “${tile.kind}”`,
      });
    return { ...tile, id, layout: clampLayout(tile.layout, id, `${path}.layout`) };
  });
  let containers = spec.containers?.map((container, i) => ({
    ...container,
    layout: clampLayout(container.layout, container.id, `$.containers[${i}].layout`),
  }));

  if (grid.mode === "flow") {
    const top: TileLayout[] = [
      ...tiles.filter((tile) => !tile.container).map((tile) => ({ ...tile.layout, id: tile.id })),
      ...(containers ?? []).map((c) => ({ ...c.layout, id: c.id })),
    ];
    const overlapping = top.some((a, i) => top.slice(i + 1).some((b) => collides(a, b)));
    if (overlapping) {
      const compacted = new Map(compact(top, grid).map((item) => [item.id, item]));
      const place = (id: string, layout: Omit<TileLayout, "id">) => {
        const next = compacted.get(id);
        return next ? { ...layout, x: next.x, y: next.y } : layout;
      };
      tiles = tiles.map((tile) =>
        tile.container ? tile : { ...tile, layout: place(tile.id, tile.layout) },
      );
      containers = containers?.map((c) => ({ ...c, layout: place(c.id, c.layout) }));
      warnings.push({
        path: "$.tiles",
        code: "overlap-repaired",
        message: "overlapping tiles in a flow grid were compacted",
      });
    }
  }

  const out: DashboardSpec = { ...spec, grid, tiles };
  if (containers) out.containers = containers;
  return { spec: out, warnings };
}
