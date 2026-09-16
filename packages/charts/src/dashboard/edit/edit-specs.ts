/**
 * Specs the edit-layer stories and tests drive (RM-078). Internal: not exported from the barrel.
 * The `fit` layout leaves (8,4) free for a 6×4 move, keeps `chart-2` as an occupied drop
 * target, and leaves room for `chart-1` to grow by two cells or four columns.
 */
import type { DashboardSpec } from "../core/spec";

export const EDIT_FIT_SPEC: DashboardSpec = {
  version: 1,
  id: "edit-fit",
  title: "Edit layer, fit 24×12",
  grid: { mode: "fit", columns: 24, rows: 12, gap: 8 },
  tiles: [
    {
      id: "chart-1",
      kind: "chart",
      title: "Revenue",
      layout: { x: 0, y: 0, w: 6, h: 4 },
      content: {},
    },
    {
      id: "chart-2",
      kind: "chart",
      title: "Orders",
      layout: { x: 16, y: 0, w: 8, h: 4 },
      content: {},
    },
    {
      id: "chart-3",
      kind: "chart",
      title: "Margin",
      layout: { x: 16, y: 4, w: 8, h: 8 },
      content: {},
    },
    {
      id: "text-1",
      kind: "text",
      title: "Notes",
      layout: { x: 0, y: 8, w: 12, h: 4 },
      content: {},
    },
  ],
};

export const EDIT_FLOW_SPEC: DashboardSpec = {
  version: 1,
  id: "edit-flow",
  title: "Edit layer, flow",
  grid: { mode: "flow", columns: 24, rowHeight: 30, gap: 8 },
  tiles: [
    { id: "a", kind: "chart", title: "Alpha", layout: { x: 0, y: 0, w: 12, h: 4 }, content: {} },
    { id: "b", kind: "chart", title: "Beta", layout: { x: 12, y: 0, w: 12, h: 4 }, content: {} },
    { id: "c", kind: "text", title: "Gamma", layout: { x: 0, y: 4, w: 12, h: 4 }, content: {} },
  ],
};
