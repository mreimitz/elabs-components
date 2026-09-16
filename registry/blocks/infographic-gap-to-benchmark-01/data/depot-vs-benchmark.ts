/**
 * Depot-level actuals for the "how far from the benchmark?" gap chart. Own
 * data for this block (`.claude/rules/registry.md` — shared code lives in ONE
 * item); depot names are drawn from the same fictional Acme Logistics
 * national network the other wave-3 blocks use.
 */

export interface GapPoint {
  id: string;
  label: string;
  actual: number;
}

/** On-time delivery rate (%), by depot. Higher is better. Compare against `ON_TIME_BENCHMARK`. */
export const onTimeVsBenchmark: GapPoint[] = [
  { id: "berlin", label: "Berlin", actual: 97.3 },
  { id: "bremen", label: "Bremen", actual: 96.0 },
  { id: "hannover", label: "Hannover", actual: 94.2 },
  { id: "dresden", label: "Dresden", actual: 93.5 },
  { id: "munich", label: "Munich", actual: 92.5 },
  { id: "hamburg", label: "Hamburg", actual: 91.6 },
  { id: "stuttgart", label: "Stuttgart", actual: 90.5 },
  { id: "frankfurt", label: "Frankfurt", actual: 90.2 },
  { id: "nuremberg", label: "Nuremberg", actual: 89.6 },
  { id: "leipzig", label: "Leipzig", actual: 88.0 },
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
