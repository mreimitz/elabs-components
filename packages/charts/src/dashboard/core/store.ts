/**
 * The per-sheet dashboard store (analysis §5.1 `store.ts`; R12, R15–R19). Framework-free:
 * `zustand/vanilla` + `subscribeWithSelector`, an INSTANCE per sheet, never a singleton.
 *
 * Ownership rules the React layer builds on:
 * - `spec` is always `normalizeDashboardSpec` output. Every spec-mutating action normalises,
 *   pushes one history step (or folds into an open batch) and recomputes `dirty`.
 * - `selection` is owned by the driver. Selection actions delegate; the store mirrors
 *   `driver.getSnapshot()` on the driver's `subscribe`, so an external driver's own changes flow in.
 * - `hover`, `focus`, `variables` and `tileState` never touch history.
 * - `discard()` restores the baseline (the mount spec, or the last `markSaved()` spec) as an
 *   undoable step; `markSaved()` moves the baseline without touching history.
 */
import { subscribeWithSelector } from "zustand/middleware";
import { createStore, type Mutate, type StoreApi } from "zustand/vanilla";

import { createHistory, type History } from "./history";
import {
  DEFAULT_GRID_COLUMNS,
  DEFAULT_GRID_ROWS,
  findEmptySlot,
  resolveCollisions,
  type CollisionStrategy,
} from "./layout";
import { createLocalSelectionDriver } from "./local-selection-driver";
import type {
  SelectionDriver,
  SelectionOptions,
  SelectionSnapshot,
  SelectionValue,
} from "./selection";
import type { DashboardSpec, GridSpec, TileLayout, TileSpec, VariableValue } from "./spec";
import { GRID_DENSITY_PRESETS, normalizeDashboardSpec } from "./validate";

/** View or edit. */
export type DashboardMode = "view" | "edit";

// UI slice — RM-079: which chrome side panels are open. Ephemeral, never in history.
/** Which side panels the chrome shows. Never persisted, never touches history. */
export interface DashboardUiState {
  /** RM-080's asset panel (the "Add" affordance opens it). */
  assets: boolean;
  /** RM-080's properties panel. */
  properties: boolean;
}

/** The shared hover channel (R15): ephemeral, never persisted, never in history. */
export interface DashboardHover {
  field: string;
  value: unknown;
  tileId: string;
}

/** A tile to add; `id` and `layout` are filled in when absent. */
export type NewTileSpec = Omit<TileSpec, "id" | "layout"> & {
  id?: string;
  layout?: Partial<TileSpec["layout"]>;
};

/** Changes to a tile; `id` cannot change. */
export type TilePatch = Partial<Omit<TileSpec, "id">>;

/** Options for `moveTile`/`resizeTile`. */
export interface TileLayoutOptions {
  /** How overlaps are resolved. Default `push` (in `fit`, a push with no room is rejected). */
  strategy?: CollisionStrategy;
}

/** Every store action. */
export interface DashboardActions {
  setMode(mode: DashboardMode): void;
  setSpec(spec: DashboardSpec): void;
  patchTile(id: string, patch: TilePatch): void;
  /** Returns whether the move was applied. */
  moveTile(id: string, to: { x: number; y: number }, opts?: TileLayoutOptions): boolean;
  /** Returns whether the resize was applied. */
  resizeTile(id: string, size: { w: number; h: number }, opts?: TileLayoutOptions): boolean;
  /** Returns the new tile id, or `null` when there is no room. */
  addTile(tile: NewTileSpec, at?: { x: number; y: number }): string | null;
  removeTile(id: string): void;
  /** Returns the copy's id, or `null` when there is no room. */
  duplicateTile(id: string): string | null;
  replaceTile(id: string, kind: string, content?: unknown): void;
  /**
   * Merge `patch` into the grid. When `patch.density` names a preset (`wide`/`medium`/
   * `narrow`) and differs from the current density, every tile's and container's `x, y,
   * w, h` is rescaled by the ratio of the new `columns`/`rows` to the old ones (RM-070's
   * normaliser then clamps the result) — one history entry either way.
   */
  setGrid(patch: Partial<GridSpec>): void;
  setFocus(ids: string[]): void;
  /** UI slice — RM-079: open or close a chrome side panel (RM-080's asset/properties panels). */
  setPanel(panel: keyof DashboardUiState, open: boolean): void;
  undo(): void;
  redo(): void;
  /** Fold every spec change inside `fn` into one undo step. */
  batch<R>(fn: () => R): R;
  /** Open a batch spanning several events (a drag gesture); close with `endBatch`. */
  beginBatch(): void;
  endBatch(): void;
  discard(): void;
  markSaved(): void;
  select(field: string, values: SelectionValue[], opts?: SelectionOptions): void;
  clearSelection(field?: string): void;
  back(): void;
  forward(): void;
  lock(field: string, locked: boolean): void;
  setHover(hover: DashboardHover | null): void;
  setVariable(name: string, value: VariableValue): void;
  setTileState(id: string, patch: Record<string, unknown>): void;
  applyBookmark(id: string): void;
  /** Stop mirroring the driver. Call when the sheet unmounts. */
  dispose(): void;
}

/** The store's state. */
export interface DashboardState {
  spec: DashboardSpec;
  mode: DashboardMode;
  /** Mirrored from the driver; never written by the store itself. */
  selection: SelectionSnapshot;
  variables: Record<string, VariableValue>;
  hover: DashboardHover | null;
  /** Per-tile view state (tab, sort, expanded). */
  tileState: Record<string, Record<string, unknown>>;
  /** Edit-mode selected tile ids. */
  focus: string[];
  dirty: boolean;
  history: { past: number; future: number; canUndo: boolean; canRedo: boolean };
  /** UI slice — RM-079. */
  ui: DashboardUiState;
  actions: DashboardActions;
}

/** Options for `createDashboardStore`. */
export interface CreateDashboardStoreOptions {
  spec: DashboardSpec;
  /** Defaults to a fresh `createLocalSelectionDriver`. */
  driver?: SelectionDriver;
  /** Default `spec.view.mode`, then `view`. */
  mode?: DashboardMode;
  /** Undo steps kept. Default 50. */
  historyLimit?: number;
  /** Called when a bookmark names another sheet (the host routes; D5). */
  onNavigate?: (sheetId: string) => void;
}

/** The store instance type: a zustand `StoreApi` whose `subscribe` also takes a selector. */
export type DashboardStore = Mutate<
  StoreApi<DashboardState>,
  [["zustand/subscribeWithSelector", never]]
>;

const clone = <T>(value: T): T => structuredClone(value);

function normalize(spec: DashboardSpec): DashboardSpec {
  return normalizeDashboardSpec(spec).spec;
}

/** Tiles and containers competing for space with `tile` (same container, or both top level). */
function scopeLayout(spec: DashboardSpec, containerId: string | undefined): TileLayout[] {
  const tiles = spec.tiles
    .filter((tile) => tile.container?.id === containerId)
    .map((tile) => ({ ...tile.layout, id: tile.id }));
  if (containerId !== undefined) return tiles;
  return [...tiles, ...(spec.containers ?? []).map((c) => ({ ...c.layout, id: c.id }))];
}

function uniqueId(spec: DashboardSpec, base: string): string {
  const used = new Set([
    ...spec.tiles.map((t) => t.id),
    ...(spec.containers ?? []).map((c) => c.id),
    ...(spec.library ?? []).map((l) => l.id),
  ]);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function defaultVariables(spec: DashboardSpec): Record<string, VariableValue> {
  return Object.fromEntries((spec.variables ?? []).map((v) => [v.name, v.default]));
}

/** Create one store for one sheet. */
export function createDashboardStore(options: CreateDashboardStoreOptions): DashboardStore {
  const driver =
    options.driver ?? createLocalSelectionDriver({ historyLimit: options.historyLimit });
  const initial = normalize(clone(options.spec));
  const history: History<DashboardSpec> = createHistory(initial, options.historyLimit ?? 50);
  let baseline = history.present;

  return createStore<DashboardState>()(
    subscribeWithSelector((set, get) => {
      const historyState = () => ({
        ...history.size(),
        canUndo: history.canUndo(),
        canRedo: history.canRedo(),
      });

      const sync = () =>
        set({ spec: history.present, dirty: history.isDirtySince(), history: historyState() });

      const commit = (next: DashboardSpec) => {
        const normalized = normalize(next);
        // Specs are small; a no-op gesture must not cost an undo step.
        if (JSON.stringify(normalized) === JSON.stringify(history.present)) return;
        history.push(normalized);
        sync();
      };

      const tileById = (id: string) => history.present.tiles.find((tile) => tile.id === id);

      const place = (id: string, moved: TileLayout, strategy: CollisionStrategy): boolean => {
        const spec = history.present;
        const tile = tileById(id);
        if (!tile) return false;
        const scope = scopeLayout(spec, tile.container?.id);
        const { layout, ok } = resolveCollisions(scope, moved, spec.grid, strategy);
        if (!ok) return false;
        const byId = new Map(layout.map((item) => [item.id, item]));
        const strip = ({ id: _id, ...rest }: TileLayout) => rest;
        const next: DashboardSpec = {
          ...spec,
          tiles: spec.tiles.map((t) => {
            const l = byId.get(t.id);
            return l && t.container?.id === tile.container?.id ? { ...t, layout: strip(l) } : t;
          }),
        };
        if (spec.containers && tile.container === undefined)
          next.containers = spec.containers.map((c) => {
            const l = byId.get(c.id);
            return l ? { ...c, layout: strip(l) } : c;
          });
        commit(next);
        return true;
      };

      // Mirror the driver (whoever changes it).
      const unsubscribe = driver.subscribe(() => set({ selection: driver.getSnapshot() }));

      const actions: DashboardActions = {
        setMode(mode) {
          if (mode === "view") {
            if (history.inBatch()) history.cancel();
            set({ mode, focus: [] });
            sync();
            return;
          }
          set({ mode });
        },
        setSpec(spec) {
          commit(clone(spec));
        },
        patchTile(id, patch) {
          if (!tileById(id)) return;
          const { id: _ignored, ...rest } = clone(patch) as TilePatch & { id?: string };
          commit({
            ...history.present,
            tiles: history.present.tiles.map((t) => (t.id === id ? { ...t, ...rest, id } : t)),
          });
        },
        moveTile(id, to, opts) {
          const tile = tileById(id);
          if (!tile) return false;
          return place(id, { ...tile.layout, ...to, id }, opts?.strategy ?? "push");
        },
        resizeTile(id, size, opts) {
          const tile = tileById(id);
          if (!tile) return false;
          return place(id, { ...tile.layout, ...size, id }, opts?.strategy ?? "push");
        },
        addTile(input, at) {
          const spec = history.present;
          const { id: wanted, layout: partial, ...rest } = clone(input);
          const id = uniqueId(spec, wanted ?? input.kind);
          const w = partial?.w ?? Math.max(1, Math.round(spec.grid.columns / 4));
          const h = partial?.h ?? 2;
          const containerId = rest.container?.id;
          let xy =
            at ??
            (partial?.x !== undefined && partial?.y !== undefined
              ? { x: partial.x, y: partial.y }
              : null);
          if (!xy) xy = findEmptySlot(scopeLayout(spec, containerId), { w, h }, spec.grid);
          if (!xy) return null;
          const layout = { ...partial, w, h, x: xy.x, y: xy.y };
          const scope = scopeLayout(spec, containerId);
          const result = resolveCollisions(scope, { ...layout, id }, spec.grid, "push");
          if (!result.ok) return null;
          const byId = new Map(result.layout.map((item) => [item.id, item]));
          const strip = ({ id: _id, ...r }: TileLayout) => r;
          const tile: TileSpec = { ...rest, id, layout: strip(byId.get(id) as TileLayout) };
          commit({
            ...spec,
            tiles: [
              ...spec.tiles.map((t) => {
                const l = byId.get(t.id);
                return l && t.container?.id === containerId ? { ...t, layout: strip(l) } : t;
              }),
              tile,
            ],
          });
          return id;
        },
        removeTile(id) {
          const spec = history.present;
          if (!tileById(id)) return;
          const next: DashboardSpec = { ...spec, tiles: spec.tiles.filter((t) => t.id !== id) };
          if (spec.interactions)
            next.interactions = spec.interactions.filter((i) => i.from !== id && i.to !== id);
          commit(next);
          const { [id]: _dropped, ...tileState } = get().tileState;
          set({ focus: get().focus.filter((f) => f !== id), tileState });
        },
        duplicateTile(id) {
          const tile = tileById(id);
          if (!tile) return null;
          const { id: _id, layout, ...rest } = tile;
          return actions.addTile({
            ...clone(rest),
            id: `${id}-copy`,
            layout: { ...layout, x: undefined, y: undefined },
          });
        },
        replaceTile(id, kind, content) {
          const tile = tileById(id);
          if (!tile) return;
          actions.patchTile(id, { kind, content: content === undefined ? {} : content });
        },
        setGrid(patch) {
          // UI slice — RM-079: the grid-settings popover is the one caller; density
          // rescale keeps tiles' proportions when the preset (and so columns/rows)
          // changes, matching the RM-070 normaliser's own clamp-after pass.
          const spec = history.present;
          const prevGrid = spec.grid;
          const clonedPatch = clone(patch);
          let nextGrid: GridSpec = { ...prevGrid, ...clonedPatch };
          if (clonedPatch.density && clonedPatch.density !== "custom") {
            const preset = GRID_DENSITY_PRESETS[clonedPatch.density];
            nextGrid = { ...nextGrid, columns: preset.columns, rows: preset.rows };
          }
          // Only a switch BETWEEN NAMED PRESETS (wide/medium/narrow) rescales: it is the one
          // case where the caller means "re-map every coordinate to the new density's own
          // columns × rows" (the acceptance bullet's wide → medium doubling). Switching TO
          // "custom" (including the grid-settings popover's own "Extend sheet", which sets
          // `density: "custom"` precisely so the normaliser's `resolveGrid` stops re-locking
          // `rows` to the OLD preset) is the caller being fully explicit about the next
          // columns/rows already — rescaling on top of that would double-apply the change.
          const isPresetDensity = (d: GridSpec["density"]) =>
            d === "wide" || d === "medium" || d === "narrow";
          const densityChanged =
            clonedPatch.density !== undefined &&
            clonedPatch.density !== prevGrid.density &&
            isPresetDensity(clonedPatch.density);
          if (!densityChanged) {
            commit({ ...spec, grid: nextGrid });
            return;
          }
          const prevColumns = prevGrid.columns || DEFAULT_GRID_COLUMNS;
          const prevRows = prevGrid.rows ?? DEFAULT_GRID_ROWS;
          const scaleX = (nextGrid.columns || DEFAULT_GRID_COLUMNS) / prevColumns;
          // `flow` height is `rowHeight` px, not a bounded row count — only `fit` rescales y/h.
          const scaleY = nextGrid.mode === "fit" ? (nextGrid.rows ?? prevRows) / prevRows : 1;
          const rescale = <L extends Omit<TileLayout, "id">>(layout: L): L => ({
            ...layout,
            x: Math.round(layout.x * scaleX),
            y: Math.round(layout.y * scaleY),
            w: Math.max(1, Math.round(layout.w * scaleX)),
            h: Math.max(1, Math.round(layout.h * scaleY)),
          });
          commit({
            ...spec,
            grid: nextGrid,
            tiles: spec.tiles.map((tile) => ({ ...tile, layout: rescale(tile.layout) })),
            containers: spec.containers?.map((c) => ({ ...c, layout: rescale(c.layout) })),
          });
        },
        setFocus(ids) {
          set({ focus: [...ids] });
        },
        setPanel(panel, open) {
          const ui = get().ui;
          if (ui[panel] === open) return;
          set({ ui: { ...ui, [panel]: open } });
        },
        undo() {
          if (history.undo() !== undefined) sync();
        },
        redo() {
          if (history.redo() !== undefined) sync();
        },
        batch(fn) {
          const result = history.batch(fn);
          sync();
          return result;
        },
        beginBatch() {
          history.begin();
        },
        endBatch() {
          history.end();
          sync();
        },
        discard() {
          if (history.inBatch()) history.cancel();
          if (history.present !== baseline) history.push(baseline);
          history.mark();
          sync();
        },
        markSaved() {
          baseline = history.present;
          history.mark();
          sync();
        },
        select: (field, values, opts) => driver.select(field, values, opts),
        clearSelection: (field) => driver.clear(field),
        back: () => driver.back(),
        forward: () => driver.forward(),
        lock: (field, locked) => driver.lock(field, locked),
        setHover(hover) {
          const prev = get().hover;
          if (prev === hover) return;
          if (
            prev &&
            hover &&
            prev.field === hover.field &&
            prev.value === hover.value &&
            prev.tileId === hover.tileId
          )
            return;
          set({ hover });
        },
        setVariable(name, value) {
          if (get().variables[name] === value) return;
          set({ variables: { ...get().variables, [name]: value } });
        },
        setTileState(id, patch) {
          const tileState = get().tileState;
          set({ tileState: { ...tileState, [id]: { ...tileState[id], ...patch } } });
        },
        applyBookmark(id) {
          const spec = history.present;
          const bookmark = spec.bookmarks?.find((b) => b.id === id);
          if (!bookmark) return;
          const current = driver.getSnapshot().fields;
          for (const field of Object.keys(current))
            if (!(field in bookmark.selection)) driver.clear(field);
          for (const [field, values] of Object.entries(bookmark.selection))
            driver.select(field, values, { replace: true });
          if (bookmark.variables) set({ variables: { ...get().variables, ...bookmark.variables } });
          if (bookmark.sheetId && bookmark.sheetId !== spec.id)
            options.onNavigate?.(bookmark.sheetId);
        },
        dispose() {
          unsubscribe();
        },
      };

      return {
        spec: history.present,
        mode: options.mode ?? initial.view?.mode ?? "view",
        selection: driver.getSnapshot(),
        variables: defaultVariables(initial),
        hover: null,
        tileState: {},
        focus: [],
        dirty: false,
        history: historyState(),
        ui: { assets: false, properties: false },
        actions,
      };
    }),
  );
}
