import { onTimeByDepot } from "@/components/kpi-movers-01/data/depot-movers";
import { EXTRA_DEPOTS } from "@/components/infographic-small-multiples-01/data/region-on-time";

/**
 * Depot-level actuals for the "how far from the benchmark?" gap chart. The
 * on-time series covers the SAME 12-depot network small-multiples and
 * before/after chart — ten depots from `kpi-movers-01`'s `onTimeByDepot`, plus
 * Bremen/Hannover from `infographic-small-multiples-01`'s `EXTRA_DEPOTS` (the
 * two depots outside that shared roster) — never re-typed
 * (`.claude/rules/registry.md`), so a depot's Q3 figure reads identically in
 * every wave-3 group B block and the movers card. `costVsBenchmark` below is
 * not cross-checked anywhere else, so it stays a block-owned fact.
 */

export interface GapPoint {
  id: string;
  label: string;
  actual: number;
}

/** On-time delivery rate (%), by depot (all 12). Higher is better. Compare against `ON_TIME_BENCHMARK`. */
export const onTimeVsBenchmark: GapPoint[] = [
  ...onTimeByDepot.map((d) => ({ id: d.id, label: d.label, actual: d.current })),
  ...EXTRA_DEPOTS.map((d) => ({ id: d.id, label: d.label, actual: d.current })),
];

/** The industry on-time delivery figure every depot above is measured against. */
export const ON_TIME_BENCHMARK = 95;

/** Cost per shipment (EUR), by depot. Lower is better. Compare against `COST_BENCHMARK`. */
export const costVsBenchmark: GapPoint[] = [
  { id: "berlin", label: "Berlin", actual: 7.4 },
  { id: "bremen", label: "Bremen", actual: 7.6 },
  { id: "stuttgart", label: "Stuttgart", actual: 7.9 },
  { id: "hannover", label: "Hannover", actual: 8.05 },
  { id: "hamburg", label: "Hamburg", actual: 8.1 },
  { id: "dresden", label: "Dresden", actual: 8.3 },
  { id: "munich", label: "Munich", actual: 8.6 },
  { id: "frankfurt", label: "Frankfurt", actual: 8.9 },
  { id: "nuremberg", label: "Nuremberg", actual: 9.2 },
  { id: "leipzig", label: "Leipzig", actual: 9.5 },
];

/** The industry average cost-per-shipment figure every depot above is measured against. */
export const COST_BENCHMARK = 8.0;
