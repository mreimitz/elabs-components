/**
 * Layout engine cases as `[name, grid, layout, op, expected]` tables (RM-070).
 */
import type { GridSpec, TileLayout } from "../spec";

export type LayoutOp =
  | { fn: "correctBounds" }
  | { fn: "compact" }
  | { fn: "resolveCollisions"; moved: TileLayout; strategy: "push" | "reject" | "swap" }
  | { fn: "findEmptySlot"; size: { w: number; h: number } }
  | { fn: "stackForNarrow" };

export type LayoutCase = [
  name: string,
  grid: GridSpec,
  layout: TileLayout[],
  op: LayoutOp,
  expected: unknown,
];

const fit: GridSpec = { mode: "fit", columns: 24, rows: 12 };
const smallFit: GridSpec = { mode: "fit", columns: 4, rows: 2 };
const flow: GridSpec = { mode: "flow", columns: 24, rowHeight: 30 };

const t = (id: string, x: number, y: number, w: number, h: number): TileLayout => ({
  id,
  x,
  y,
  w,
  h,
});

export const LAYOUT_CASES: LayoutCase[] = [
  [
    "clamps a tile past the right edge",
    fit,
    [t("a", 22, 0, 6, 2)],
    { fn: "correctBounds" },
    [t("a", 18, 0, 6, 2)],
  ],
  [
    "clamps a tile below a fit grid",
    fit,
    [t("a", 0, 11, 4, 3)],
    { fn: "correctBounds" },
    [t("a", 0, 9, 4, 3)],
  ],
  [
    "honours minW and maxH",
    fit,
    [{ ...t("a", 0, 0, 1, 9), minW: 3, maxH: 4 }],
    { fn: "correctBounds" },
    [{ ...t("a", 0, 0, 3, 4), minW: 3, maxH: 4 }],
  ],
  [
    "flow does not bound y",
    flow,
    [t("a", 0, 99, 4, 3)],
    { fn: "correctBounds" },
    [t("a", 0, 99, 4, 3)],
  ],
  [
    "compacts a gap in flow",
    flow,
    [t("a", 0, 0, 4, 2), t("b", 0, 5, 4, 2)],
    { fn: "compact" },
    [t("a", 0, 0, 4, 2), t("b", 0, 2, 4, 2)],
  ],
  [
    "compact is identity in fit",
    fit,
    [t("a", 0, 3, 4, 2)],
    { fn: "compact" },
    [t("a", 0, 3, 4, 2)],
  ],
  [
    "push moves colliders down in flow",
    flow,
    [t("a", 0, 0, 4, 2), t("b", 0, 2, 4, 2)],
    { fn: "resolveCollisions", moved: t("b", 0, 0, 4, 2), strategy: "push" },
    { ok: true, layout: [t("a", 0, 2, 4, 2), t("b", 0, 0, 4, 2)] },
  ],
  [
    "push moves colliders right in fit",
    fit,
    [t("a", 0, 0, 4, 2), t("b", 8, 0, 4, 2)],
    { fn: "resolveCollisions", moved: t("b", 0, 0, 4, 2), strategy: "push" },
    { ok: true, layout: [t("a", 4, 0, 4, 2), t("b", 0, 0, 4, 2)] },
  ],
  [
    "push fails in a full fit grid",
    smallFit,
    [t("a", 0, 0, 2, 2), t("b", 2, 0, 2, 2)],
    { fn: "resolveCollisions", moved: t("b", 1, 0, 2, 2), strategy: "push" },
    { ok: false, layout: [t("a", 0, 0, 2, 2), t("b", 2, 0, 2, 2)] },
  ],
  [
    "reject returns the original",
    fit,
    [t("a", 0, 0, 4, 2), t("b", 8, 0, 4, 2)],
    { fn: "resolveCollisions", moved: t("b", 2, 0, 4, 2), strategy: "reject" },
    { ok: false, layout: [t("a", 0, 0, 4, 2), t("b", 8, 0, 4, 2)] },
  ],
  [
    "swap exchanges same-size tiles",
    fit,
    [t("a", 0, 0, 4, 2), t("b", 8, 0, 4, 2)],
    { fn: "resolveCollisions", moved: t("b", 0, 0, 4, 2), strategy: "swap" },
    { ok: true, layout: [t("a", 8, 0, 4, 2), t("b", 0, 0, 4, 2)] },
  ],
  [
    "swap refuses a partial landing",
    fit,
    [t("a", 0, 0, 4, 2), t("b", 8, 0, 4, 2)],
    { fn: "resolveCollisions", moved: t("b", 1, 0, 4, 2), strategy: "swap" },
    { ok: false, layout: [t("a", 0, 0, 4, 2), t("b", 8, 0, 4, 2)] },
  ],
  [
    "findEmptySlot scans row-major",
    fit,
    [t("a", 0, 0, 4, 2)],
    { fn: "findEmptySlot", size: { w: 4, h: 2 } },
    { x: 4, y: 0 },
  ],
  [
    "findEmptySlot is null when full",
    smallFit,
    [t("a", 0, 0, 4, 2)],
    { fn: "findEmptySlot", size: { w: 1, h: 1 } },
    null,
  ],
  [
    "findEmptySlot scans past rows when extendable",
    { ...smallFit, extendable: true },
    [t("a", 0, 0, 4, 2)],
    { fn: "findEmptySlot", size: { w: 1, h: 1 } },
    { x: 0, y: 2 },
  ],
  [
    "stackForNarrow orders by y then x",
    fit,
    [t("b", 12, 0, 12, 3), t("c", 0, 3, 24, 2), t("a", 0, 0, 12, 4)],
    { fn: "stackForNarrow" },
    [t("a", 0, 0, 24, 4), t("b", 0, 4, 24, 3), t("c", 0, 7, 24, 2)],
  ],
];
