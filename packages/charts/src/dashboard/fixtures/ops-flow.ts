/**
 * `ops-flow` — the RM-070 golden (`../core/__fixtures__/ops-flow.json`), typed and given real
 * 24-row seeded datasets on every `chart` tile (RM-077). A `flow` grid, 13 top-level tiles plus
 * a `drilldown` tabs container (`latency-p95`, `throughput`).
 */
import opsFlowJson from "../core/__fixtures__/ops-flow.json";
import { withRealRows } from "./apply-rows";
import type { DashboardSpec } from "../core/spec";

export const opsFlowSpec: DashboardSpec = withRealRows(
  opsFlowJson as unknown as DashboardSpec,
  100,
);
