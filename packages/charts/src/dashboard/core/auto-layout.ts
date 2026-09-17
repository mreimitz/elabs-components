/**
 * auto-layout.ts — `autoLayout`: give positionless tiles a sensible, deterministic layout
 * (RM-086, analysis §4 R38). An agent emits tiles without `layout`; this places them the
 * way Databricks Genie / Power BI Copilot lay out for the user, instead of making the
 * agent guess `x/y/w/h` (Lightdash's model).
 *
 * Pure and framework-free. Every placement goes through `findEmptySlot`, tiles that
 * already carry a layout are respected (never moved) and the result never overlaps.
 */

import { DEFAULT_GRID_COLUMNS, DEFAULT_GRID_ROWS, extendRows, findEmptySlot } from "./layout";
import type { GridSpec, TileLayout, TileSpec } from "./spec";

/** A cell size, `w` columns × `h` rows. */
export interface AutoLayoutCellSize {
  w: number;
  h: number;
}

/** The sizing `autoLayout` reads from a tile kind — a `DashboardTileKind` satisfies it. */
export interface AutoLayoutKindSizing {
  defaultSize: AutoLayoutCellSize;
  minSize?: AutoLayoutCellSize;
}

/** Kind sizing, keyed by kind or as a list of kinds carrying their own `kind`. */
export type AutoLayoutKinds =
  | Readonly<Record<string, AutoLayoutKindSizing>>
  | ReadonlyArray<AutoLayoutKindSizing & { kind: string }>;

/** How `autoLayout` arranges tiles. */
export type AutoLayoutStrategy = "reading-order" | "by-kind";

/** Options for `autoLayout`. */
export interface AutoLayoutOptions {
  /** `by-kind` (default) groups metrics, filters, bands, charts and tables; `reading-order` fills row-major. */
  strategy?: AutoLayoutStrategy;
}

/** A tile `autoLayout` accepts: with or without a `layout`. */
export type AutoLayoutTileInput = TileSpec | Omit<TileSpec, "layout">;

/** Result of `autoLayout`: every tile with a layout, and the grid (extended rows when needed). */
export interface AutoLayoutResult {
  tiles: TileSpec[];
  grid: GridSpec;
}

/** Kinds `by-kind` treats as a metric (top row). */
export const AUTO_LAYOUT_METRIC_KINDS: readonly string[] = ["metric", "kpi"];
/** Kinds `by-kind` stacks in the left column. */
export const AUTO_LAYOUT_COLUMN_KINDS: readonly string[] = ["filter", "variable"];
/** Kinds `by-kind` lays out as full-width bands where they appear. */
export const AUTO_LAYOUT_BAND_KINDS: readonly string[] = ["heading", "text"];
/** `ChartSpec.type`s that read well wide and short (12×4 instead of 12×6). */
export const AUTO_LAYOUT_WIDE_CHART_TYPES: readonly string[] = ["line", "area", "bar-horizontal"];

/** Sizes on the 24-column reference grid; scaled to the grid's `columns`. */
const REFERENCE_COLUMNS = 24;
const METRIC_SIZE = { w: 4, h: 2 };
const COLUMN_WIDTH = 4;
const CHART_SIZE = { w: 12, h: 6 };
const CHART_SIZE_MANY = { w: 8, h: 4 };
const CHART_SIZE_WIDE = { w: 12, h: 4 };
const MANY_CHARTS = 4;
const FALLBACK_SIZE = { w: 6, h: 4 };

const hasLayout = (tile: AutoLayoutTileInput): tile is TileSpec =>
  typeof (tile as TileSpec).layout === "object" && (tile as TileSpec).layout !== null;

function sizingOf(kinds: AutoLayoutKinds, kind: string): AutoLayoutKindSizing | undefined {
  if (Array.isArray(kinds)) return kinds.find((entry) => entry.kind === kind);
  return (kinds as Readonly<Record<string, AutoLayoutKindSizing>>)[kind];
}

function chartTypeOf(tile: AutoLayoutTileInput): string | undefined {
  const content = tile.content as { type?: unknown; orientation?: unknown } | null;
  if (typeof content !== "object" || content === null || typeof content.type !== "string")
    return undefined;
  return content.type === "bar" && content.orientation === "horizontal"
    ? "bar-horizontal"
    : content.type;
}

const bottomOf = (layout: readonly TileLayout[]) =>
  layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);

/**
 * Lay out tiles that have no `layout`, deterministically.
 *
 * - `by-kind` (default): `metric`/`kpi` tiles fill the top rows at 4×2 (six across on 24
 *   columns); `filter`/`variable` tiles stack in a 4-wide left column under them;
 *   `heading`/`text` tiles are full-width bands where they appear in reading order;
 *   `chart` tiles go two across at 12×6 (8×4, three across, when there are more than four
 *   charts; 12×4 for line/area/horizontal bar); a kind whose `defaultSize.w` spans the
 *   whole grid (a host `table`) goes full width at the bottom. Other kinds use their
 *   `defaultSize`. Sizes scale with `grid.columns` and never drop below a kind's `minSize`.
 * - `reading-order`: every tile in input order at its kind's `defaultSize`, row-major.
 *
 * Both place through `findEmptySlot`, skip (and route around) tiles that already have a
 * layout, keep the input order in the output, and never overlap. A `fit` grid that is
 * `extendable` gains rows (`extendRows`) until everything fits; a non-extendable grid
 * keeps its `rows` (the tiles below it scroll out of the fitted view). Tiles inside a
 * container get a container-local `{ x: 0, y: 0 }` layout at their default size.
 */
export function autoLayout(
  tiles: readonly AutoLayoutTileInput[],
  grid: GridSpec,
  kinds: AutoLayoutKinds,
  opts: AutoLayoutOptions = {},
): AutoLayoutResult {
  const strategy = opts.strategy ?? "by-kind";
  const columns = Math.max(1, Math.round(grid.columns || DEFAULT_GRID_COLUMNS));
  const scale = (w: number) =>
    Math.max(1, Math.min(columns, Math.round((w * columns) / REFERENCE_COLUMNS)));

  const occupied: TileLayout[] = [];
  const placed = new Map<number, Omit<TileLayout, "id">>();
  const pending: number[] = [];
  tiles.forEach((tile, index) => {
    if (hasLayout(tile)) {
      if (!tile.container) occupied.push({ ...tile.layout, id: tile.id });
    } else if (tile.container) {
      const size = sizingOf(kinds, tile.kind)?.defaultSize ?? FALLBACK_SIZE;
      placed.set(index, { x: 0, y: 0, w: Math.min(size.w, columns), h: size.h });
    } else pending.push(index);
  });

  const fit = (size: AutoLayoutCellSize, kind: string, width = columns): AutoLayoutCellSize => {
    const min = sizingOf(kinds, kind)?.minSize;
    const w = Math.min(width, Math.max(Math.round(size.w), min?.w ?? 1, 1));
    const h = Math.max(Math.round(size.h), min?.h ?? 1, 1);
    return { w, h };
  };

  /** Place a `size` tile within columns `[left, left + width)` at or below row `top`. */
  const place = (index: number, size: AutoLayoutCellSize, left = 0, width = columns, top = 0) => {
    const w = Math.min(size.w, width);
    const local: TileLayout[] = [];
    if (top > 0) local.push({ id: "\u0000top", x: 0, y: 0, w: width, h: top });
    for (const item of occupied) {
      const x0 = Math.max(item.x, left);
      const x1 = Math.min(item.x + item.w, left + width);
      if (x1 > x0) local.push({ ...item, x: x0 - left, w: x1 - x0 });
    }
    const slot = findEmptySlot(local, { w, h: size.h }, { mode: "flow", columns: width }) ?? {
      x: 0,
      y: Math.max(top, bottomOf(local)),
    };
    const layout = {
      id: tiles[index]?.id ?? `\u0000${index}`,
      x: slot.x + left,
      y: slot.y,
      w,
      h: size.h,
    };
    occupied.push(layout);
    placed.set(index, { x: layout.x, y: layout.y, w: layout.w, h: layout.h });
    return layout;
  };

  const kindOf = (index: number) => (tiles[index] as AutoLayoutTileInput).kind;

  if (strategy === "reading-order") {
    for (const index of pending) {
      const kind = kindOf(index);
      place(index, fit(sizingOf(kinds, kind)?.defaultSize ?? FALLBACK_SIZE, kind), 0, columns);
    }
  } else {
    const metrics = pending.filter((i) => AUTO_LAYOUT_METRIC_KINDS.includes(kindOf(i)));
    const column = pending.filter((i) => AUTO_LAYOUT_COLUMN_KINDS.includes(kindOf(i)));
    const wide = pending.filter((i) => {
      const kind = kindOf(i);
      const size = sizingOf(kinds, kind)?.defaultSize;
      return (
        !metrics.includes(i) &&
        !column.includes(i) &&
        !AUTO_LAYOUT_BAND_KINDS.includes(kind) &&
        kind !== "chart" &&
        size !== undefined &&
        size.w >= Math.max(REFERENCE_COLUMNS, columns)
      );
    });
    const body = pending.filter(
      (i) => !metrics.includes(i) && !column.includes(i) && !wide.includes(i),
    );

    for (const index of metrics)
      place(index, fit({ w: scale(METRIC_SIZE.w), h: METRIC_SIZE.h }, kindOf(index)));
    const headerBottom = bottomOf(occupied);

    const columnWidth = column.length > 0 ? Math.min(columns, scale(COLUMN_WIDTH)) : 0;
    for (const index of column) {
      const kind = kindOf(index);
      const size = sizingOf(kinds, kind)?.defaultSize ?? { w: COLUMN_WIDTH, h: 2 };
      place(
        index,
        fit({ w: columnWidth, h: size.h }, kind, columnWidth),
        0,
        columnWidth,
        headerBottom,
      );
    }

    const left = columnWidth < columns ? columnWidth : 0;
    const width = columns - left;
    const chartCount = body.filter((i) => kindOf(i) === "chart").length;
    let cursor = headerBottom;
    for (const index of body) {
      const kind = kindOf(index);
      const tile = tiles[index] as AutoLayoutTileInput;
      let size: AutoLayoutCellSize;
      if (AUTO_LAYOUT_BAND_KINDS.includes(kind)) {
        const h = sizingOf(kinds, kind)?.defaultSize.h ?? 1;
        const bandTop = Math.max(cursor, bottomWithin(occupied, left, width));
        const layout = place(index, fit({ w: width, h }, kind, width), left, width, bandTop);
        cursor = layout.y + layout.h;
        continue;
      }
      if (kind === "chart") {
        const ref =
          chartCount > MANY_CHARTS
            ? CHART_SIZE_MANY
            : AUTO_LAYOUT_WIDE_CHART_TYPES.includes(chartTypeOf(tile) ?? "")
              ? CHART_SIZE_WIDE
              : CHART_SIZE;
        size = { w: Math.max(1, Math.floor((width * ref.w) / REFERENCE_COLUMNS)), h: ref.h };
      } else {
        const d = sizingOf(kinds, kind)?.defaultSize ?? FALLBACK_SIZE;
        size = { w: Math.min(width, scale(d.w)), h: d.h };
      }
      place(index, fit(size, kind, width), left, width, cursor);
    }

    for (const index of wide) {
      const kind = kindOf(index);
      const h = sizingOf(kinds, kind)?.defaultSize.h ?? FALLBACK_SIZE.h;
      place(index, fit({ w: columns, h }, kind), 0, columns, bottomOf(occupied));
    }
  }

  let nextGrid = grid;
  if (grid.mode === "fit" && grid.extendable === true) {
    const bottom = bottomOf(occupied);
    while ((nextGrid.rows ?? DEFAULT_GRID_ROWS) < bottom) nextGrid = extendRows(nextGrid);
  }

  const out = tiles.map((tile, index) => {
    if (hasLayout(tile)) return tile;
    return { ...tile, layout: placed.get(index) as Omit<TileLayout, "id"> } as TileSpec;
  });
  return { tiles: out, grid: nextGrid };
}

function bottomWithin(layout: readonly TileLayout[], left: number, width: number): number {
  return layout.reduce(
    (max, item) =>
      Math.min(item.x + item.w, left + width) > Math.max(item.x, left)
        ? Math.max(max, item.y + item.h)
        : max,
    0,
  );
}
