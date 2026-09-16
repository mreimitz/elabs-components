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

// tile operations — RM-081: `alignTiles`/`distributeTiles` (edit/align.ts) are pure `TileLayout[]`
// maths kept next to the marquee/toolbar that call them directly too; the store imports the
// same functions rather than re-deriving them, so there is one algorithm, not two.
import {
  alignTiles as pureAlignTiles,
  distributeTiles as pureDistributeTiles,
} from "../edit/align";
import type { AlignEdge, DistributeAxis } from "../edit/align";
import { createHistory, type History } from "./history";
import {
  collides,
  correctBounds,
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
import type {
  BookmarkSpec,
  DashboardSpec,
  GridSpec,
  TileLayout,
  TileSpec,
  VariableValue,
} from "./spec";
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
  /**
   * Change a tile's kind in place: `layout`, `title`, `subtitle`, `footnote`, `source`,
   * `visibleWhen`, `consumes`, `emits` and `container` all survive (so an `interaction`
   * referencing this tile's id still resolves) — only `kind` and `content` change. When
   * `content` is omitted it becomes `{}` (the caller, which has the tile-kind registry
   * `replaceTile` itself never sees, is expected to pass the new kind's `defaultContent`
   * instead). Built-in `chart` → `chart` (a chart-type swap) is the one special case: the
   * previous `content` (the `ChartSpec` — `data`/`x`/`series`/…) is kept and `content`'s own
   * keys (typically just `type`) are merged on top, never replaced wholesale.
   */
  // tile operations — RM-081
  replaceTile(id: string, kind: string, content?: unknown): void;
  /** Bring a tile above every other top-level tile (`fit` z-order only). One history entry. */
  bringForward(id: string): void;
  /** Send a tile below every other top-level tile (`fit` z-order only). One history entry. */
  sendBackward(id: string): void;
  /**
   * Align every tile in `ids` (≥ 2, top level only) to a shared edge/centre line. Returns
   * whether it was applied — rejected (no commit) when the result would overlap. One history
   * entry for the whole multi-selection, never one per tile.
   */
  alignTiles(ids: string[], edge: AlignEdge): boolean;
  /**
   * Space every tile in `ids` (≥ 3, top level only) evenly along `axis`, first and last fixed.
   * Returns whether it was applied — rejected (no commit) when the result would overlap.
   */
  distributeTiles(ids: string[], axis: DistributeAxis): boolean;
  /**
   * Paste clipboard tiles (ids always regenerated, `ref` kept). `at` places the pointer's
   * cell, offsetting each further tile by one cell in `fit` mode so N pasted tiles don't
   * stack exactly; omitted, each tile falls to `findEmptySlot`. One history entry for the
   * whole paste. Returns the new ids, in `tiles` order (short of `tiles.length` when some
   * found no room).
   */
  pasteTiles(tiles: NewTileSpec[], at?: { x: number; y: number }): string[];
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
  /**
   * Save the current selection + variables as a `BookmarkSpec` (RM-083). When
   * `CreateDashboardStoreOptions.bookmarks?.storage === "spec"` it is also appended to
   * `spec.bookmarks` — one history entry, `changeReason` set to `"bookmark"` so
   * `DashboardProvider`'s `onChange` can report it. `storage: "host"` (the default) returns
   * the bookmark without touching `spec` — the host persists it itself (D5).
   */
  // bookmarks — RM-083
  saveBookmark(label: string): BookmarkSpec;
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
  /**
   * Set by the commit right behind it when that specific spec change carries a reason
   * (currently only `saveBookmark`'s spec-storage commit, `"bookmark"`); every OTHER commit
   * resets it to `undefined` so a later, unrelated change never inherits a stale reason.
   * `DashboardProvider` reads it, right after `state.spec` changes, to fill
   * `DashboardChangeMeta.reason`.
   */
  // bookmarks — RM-083
  changeReason?: string;
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
  /**
   * Where "Save bookmark…" persists (RM-083). `"spec"`: `saveBookmark` appends to
   * `spec.bookmarks` itself. `"host"` (default): `saveBookmark` only returns the
   * `BookmarkSpec`; the host is expected to persist it (D5).
   */
  // bookmarks — RM-083
  bookmarks?: { storage: "spec" | "host" };
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

// tile operations — RM-081
/** Any two items in `layout` share a cell — the same primitive `resolveCollisions`'s own
 * `"reject"` strategy uses (`collides`), applied pairwise for a whole moved SET at once
 * (`resolveCollisions` itself only ever moves one item against the rest). */
function hasCollisions(layout: readonly TileLayout[]): boolean {
  for (let i = 0; i < layout.length; i++)
    for (let j = i + 1; j < layout.length; j++)
      if (collides(layout[i] as TileLayout, layout[j] as TileLayout)) return true;
  return false;
}

/** Write a top-level (`scopeLayout(spec, undefined)`) layout back onto tiles/containers. */
function applyScopedLayout(spec: DashboardSpec, layout: readonly TileLayout[]): DashboardSpec {
  const byId = new Map(layout.map((item) => [item.id, item]));
  const strip = ({ id: _id, ...rest }: TileLayout) => rest;
  return {
    ...spec,
    tiles: spec.tiles.map((t) => {
      const l = byId.get(t.id);
      return l && t.container === undefined ? { ...t, layout: strip(l) } : t;
    }),
    containers: spec.containers?.map((c) => {
      const l = byId.get(c.id);
      return l ? { ...c, layout: strip(l) } : c;
    }),
  };
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

// bookmarks — RM-083
/** A `label` slug, deduped against `spec.bookmarks`' existing ids the way `uniqueId` dedupes
 * tile ids — `-2`, `-3`, … on a collision. Falls back to `"bookmark"` for an all-punctuation
 * label. */
function bookmarkId(spec: DashboardSpec, label: string): string {
  const base =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "bookmark";
  const used = new Set((spec.bookmarks ?? []).map((b) => b.id));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
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

      // `reason` (RM-083): set on every sync — undefined for every ordinary commit, so it
      // never leaks onto a later, unrelated change; only `saveBookmark`'s spec-storage
      // commit passes one ("bookmark").
      const sync = (reason?: string) =>
        set({
          spec: history.present,
          dirty: history.isDirtySince(),
          history: historyState(),
          changeReason: reason,
        });

      const commit = (next: DashboardSpec, reason?: string) => {
        const normalized = normalize(next);
        // Specs are small; a no-op gesture must not cost an undo step.
        if (JSON.stringify(normalized) === JSON.stringify(history.present)) return;
        history.push(normalized);
        sync(reason);
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
        // tile operations — RM-081
        replaceTile(id, kind, content) {
          const tile = tileById(id);
          if (!tile) return;
          let nextContent: unknown = content === undefined ? {} : content;
          if (tile.kind === "chart" && kind === "chart" && content && typeof content === "object")
            nextContent = {
              ...(tile.content as Record<string, unknown>),
              ...(content as Record<string, unknown>),
            };
          actions.patchTile(id, { kind, content: nextContent });
        },
        bringForward(id) {
          const spec = history.present;
          const tile = tileById(id);
          if (!tile || tile.container) return;
          const maxZ = Math.max(0, ...spec.tiles.map((t) => t.layout.z ?? 0));
          if ((tile.layout.z ?? 0) > maxZ) return;
          commit({
            ...spec,
            tiles: spec.tiles.map((t) =>
              t.id === id ? { ...t, layout: { ...t.layout, z: maxZ + 1 } } : t,
            ),
          });
        },
        sendBackward(id) {
          const spec = history.present;
          const tile = tileById(id);
          if (!tile || tile.container) return;
          const minZ = Math.min(0, ...spec.tiles.map((t) => t.layout.z ?? 0));
          commit({
            ...spec,
            tiles: spec.tiles.map((t) =>
              t.id === id ? { ...t, layout: { ...t.layout, z: minZ - 1 } } : t,
            ),
          });
        },
        alignTiles(ids, edge) {
          const spec = history.present;
          const scope = scopeLayout(spec, undefined);
          if (scope.filter((item) => ids.includes(item.id)).length < 2) return false;
          const aligned = correctBounds(pureAlignTiles(scope, ids, edge), spec.grid);
          if (hasCollisions(aligned)) return false;
          commit(applyScopedLayout(spec, aligned));
          return true;
        },
        distributeTiles(ids, axis) {
          const spec = history.present;
          const scope = scopeLayout(spec, undefined);
          if (scope.filter((item) => ids.includes(item.id)).length < 3) return false;
          const distributed = correctBounds(pureDistributeTiles(scope, ids, axis), spec.grid);
          if (hasCollisions(distributed)) return false;
          commit(applyScopedLayout(spec, distributed));
          return true;
        },
        pasteTiles(tiles, at) {
          return actions.batch(() => {
            const spec = history.present;
            const ids: string[] = [];
            tiles.forEach((tile, index) => {
              const { layout, id: _id, ...rest } = tile;
              // fit: nudge each further pasted tile by one cell so N tiles pasted onto the
              // same pointer cell don't stack exactly on top of each other.
              const target = at
                ? {
                    x: at.x + (spec.grid.mode === "fit" ? index : 0),
                    y: at.y + (spec.grid.mode === "fit" ? index : 0),
                  }
                : undefined;
              const newId = actions.addTile(
                { ...rest, layout: target ? { w: layout?.w, h: layout?.h } : layout },
                target,
              );
              if (newId) ids.push(newId);
            });
            return ids;
          });
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
        // bookmarks — RM-083
        saveBookmark(label) {
          const snapshot = driver.getSnapshot();
          const selection: BookmarkSpec["selection"] = {};
          for (const [field, state] of Object.entries(snapshot.fields))
            if (state.values.length > 0) selection[field] = [...state.values];
          const bookmark: BookmarkSpec = {
            id: bookmarkId(history.present, label),
            label,
            selection,
            variables: { ...get().variables },
          };
          if (options.bookmarks?.storage === "spec")
            commit(
              { ...history.present, bookmarks: [...(history.present.bookmarks ?? []), bookmark] },
              "bookmark",
            );
          return bookmark;
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
        // bookmarks — RM-083
        changeReason: undefined,
        actions,
      };
    }),
  );
}
