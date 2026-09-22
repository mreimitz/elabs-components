/**
 * `withRealRows` — swaps every `chart` tile's two-point placeholder dataset (the RM-070 JSON
 * goldens) for 24 seeded rows, so a story or test rendering the fixture's `chart`/`kpi` tiles
 * draws real marks instead of a two-point line (RM-077).
 */
import { makeRows } from "./rows/generate";
import type { DashboardSpec, TileSpec } from "../core/spec";

interface ChartTileContent {
  series?: Array<{ key: string; label?: string }>;
  data?: unknown;
  [key: string]: unknown;
}

/** Replace `data` on every `kind: "chart"` tile with `makeRows` output; leaves other kinds untouched. */
export function withRealRows(spec: DashboardSpec, seedBase = 0): DashboardSpec {
  let seed = seedBase;
  const tiles: TileSpec[] = spec.tiles.map((tile) => {
    if (tile.kind !== "chart") return tile;
    seed += 1;
    const content = tile.content as ChartTileContent;
    const seriesKeys = (content.series ?? []).map((s) => s.key);
    const keys = seriesKeys.length > 0 ? seriesKeys : ["revenue"];
    return { ...tile, content: { ...content, data: makeRows(keys, seed) } };
  });
  return { ...spec, tiles };
}
