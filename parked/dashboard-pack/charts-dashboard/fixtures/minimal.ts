/**
 * `minimal` — the RM-070 golden (`../core/__fixtures__/minimal.json`), typed and given a real
 * 24-row seeded dataset on its one `chart` tile (RM-077). The smallest valid `DashboardSpec`:
 * one tile, no filters/variables/interactions — `makeSpec`'s (`./make-spec`) base.
 */
import minimalJson from "../core/__fixtures__/minimal.json";
import { withRealRows } from "./apply-rows";
import type { DashboardSpec } from "../core/spec";

export const minimalSpec: DashboardSpec = withRealRows(
  minimalJson as unknown as DashboardSpec,
  200,
);
