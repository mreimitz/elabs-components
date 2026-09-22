/**
 * built-in-tiles.ts — the ten tile kinds `charts` ships without a new arrow (RM-075/RM-076,
 * analysis §4 R23): `chart`, `metric`, `text`, `heading`, `divider`, `image`, `container`,
 * `button`, `variable`, `filter`. `table`/`chat`/`process-map` stay registry blocks (RM-088),
 * not built-ins, since they need `data`/`ai`/`process` content the dashboard subpath may not
 * import (`.claude/rules/dashboard.md`).
 */
import type { DashboardTileKind, DashboardTileKinds } from "../dashboard-sheet/tile-registry";
import { buttonTileKind } from "./button-tile";
import { chartTileKind } from "./chart-tile";
import { containerTileKind } from "./container-tile";
import { dividerTileKind } from "./divider-tile";
import { filterTileKind } from "./filter-tile";
import { headingTileKind } from "./heading-tile";
import { imageTileKind } from "./image-tile";
import { metricTileKind } from "./metric-tile";
import { textTileKind } from "./text-tile";
import { variableTileKind } from "./variable-tile";

/** The ten built-in kinds, keyed by `kind`. */
export const builtInTiles: Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a registry holds kinds of differing content types (mirrors `DashboardTileKinds`)
  DashboardTileKind<any>
> = {
  chart: chartTileKind,
  metric: metricTileKind,
  text: textTileKind,
  heading: headingTileKind,
  divider: dividerTileKind,
  image: imageTileKind,
  container: containerTileKind,
  button: buttonTileKind,
  variable: variableTileKind,
  // filter — RM-076
  filter: filterTileKind,
};

/**
 * Merge a host's own kinds with the built-ins — a host kind with the same `kind` wins
 * (passed after the built-ins to `createTileRegistry`'s "later wins" rule).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a registry holds kinds of differing content types (mirrors `DashboardTileKinds`)
export function withBuiltInTiles(hostKinds: DashboardTileKinds): DashboardTileKind<any>[] {
  const hostList = Array.isArray(hostKinds) ? hostKinds : Object.values(hostKinds);
  return [...Object.values(builtInTiles), ...hostList];
}
