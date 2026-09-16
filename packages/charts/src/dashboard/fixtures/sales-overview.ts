/**
 * `sales-overview` — the RM-070 golden (`../core/__fixtures__/sales-overview.json`), typed and
 * given real 24-row seeded datasets on every `chart` tile (RM-077). 9 tiles: 4 `kpi`, 4
 * `chart`, 1 `text` (`detail-note`, shown only when `variables.showDetail` and a `Region`
 * selection exist).
 */
import salesOverviewJson from "../core/__fixtures__/sales-overview.json";
import { withRealRows } from "./apply-rows";
import type { DashboardSpec } from "../core/spec";

const golden = withRealRows(salesOverviewJson as unknown as DashboardSpec, 1);

export const salesOverviewSpec: DashboardSpec = {
  ...golden,
  // interaction graph — RM-082: a click in `region-share` HIGHLIGHTS every consumer (the later
  // wildcard wins over the golden's `→ *: filter`) except `top-products`, which it FILTERS
  // (an explicit pair beats a wildcard). See `core/interactions.ts`.
  interactions: [
    ...(golden.interactions ?? []),
    { from: "region-share", to: "*", effect: "highlight" },
    { from: "region-share", to: "top-products", effect: "filter" },
  ],
};
