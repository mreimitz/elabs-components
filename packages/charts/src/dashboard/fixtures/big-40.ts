/**
 * `bigFortySpec` — 40 tiles in a 4-column `flow` grid: the lazy-render / virtualization
 * fixture (RM-077's typed export). There is no RM-070 `big-40` golden JSON — this mirrors the
 * 40-placeholder-tile `LAZY` spec RM-074's `dashboard-sheet.stories.tsx` defines inline, but
 * with real content: `chart` (bar/line/area, real seeded rows), `kpi` and `text` tiles, so the
 * lazy-render story and RM-078's driven-browser checks exercise real chart marks, not just
 * placeholder boxes.
 */
import { makeRows } from "./rows/generate";
import type { DashboardSpec, TileSpec } from "../core/spec";

const CHART_TYPES = ["bar", "line", "area"] as const;
const KINDS = ["chart", "chart", "kpi", "text"] as const;

function tileAt(i: number): TileSpec {
  const kind = KINDS[i % KINDS.length]!;
  const layout = { x: (i % 4) * 6, y: Math.floor(i / 4) * 6, w: 6, h: 6 };
  if (kind === "chart") {
    return {
      id: `chart-${i + 1}`,
      kind,
      title: `Panel ${i + 1}`,
      layout,
      content: {
        type: CHART_TYPES[i % CHART_TYPES.length]!,
        title: `Panel ${i + 1}`,
        data: makeRows(["revenue"], i + 1),
        x: "x",
        series: [{ key: "revenue", label: "Revenue" }],
      },
    };
  }
  if (kind === "kpi") {
    return {
      id: `kpi-${i + 1}`,
      kind,
      title: `Metric ${i + 1}`,
      layout,
      content: { label: `Metric ${i + 1}`, value: 100 + i },
    };
  }
  return {
    id: `text-${i + 1}`,
    kind,
    title: `Note ${i + 1}`,
    layout,
    content: { markdown: `Panel ${i + 1} notes.` },
  };
}

export const bigFortySpec: DashboardSpec = {
  version: 1,
  id: "big40",
  title: "Forty tiles exercise lazy render with real chart marks",
  grid: { mode: "flow", columns: 24, rowHeight: 30, gap: 8 },
  tiles: Array.from({ length: 40 }, (_, i) => tileAt(i)),
};
