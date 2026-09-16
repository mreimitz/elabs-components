/**
 * Two-time-point depot facts for the "who improved, who slipped?" slope
 * chart — Q2 (start) → Q3 (end, the same quarter every other Acme Logistics
 * KPI block reports). Own data for this block (never imported cross-item,
 * `.claude/rules/registry.md`); depot names are drawn from the same
 * fictional national network `kpi-movers-01`/`infographic-small-multiples-01`
 * use, but every figure here is typed fresh for this two-point comparison.
 */

export interface BeforeAfterPoint {
  id: string;
  label: string;
  /** Q2 value. */
  start: number;
  /** Q3 value — the same quarter `acme-quarter.ts` reports. */
  end: number;
}

/** On-time delivery rate (%), by depot, Q2 → Q3. Higher is better. */
export const onTimeQ2ToQ3: BeforeAfterPoint[] = [
  { id: "berlin", label: "Berlin", start: 92.4, end: 97.3 },
  { id: "munich", label: "Munich", start: 90.1, end: 92.5 },
  { id: "hamburg", label: "Hamburg", start: 90.9, end: 91.6 },
  { id: "frankfurt", label: "Frankfurt", start: 91.4, end: 90.2 },
  { id: "stuttgart", label: "Stuttgart", start: 89.3, end: 90.5 },
  { id: "nuremberg", label: "Nuremberg", start: 91.0, end: 89.6 },
  { id: "leipzig", label: "Leipzig", start: 93.6, end: 88.0 },
];

/** Revenue (EUR), by depot, Q2 → Q3. Higher is better. */
export const revenueQ2ToQ3: BeforeAfterPoint[] = [
  { id: "berlin", label: "Berlin", start: 500_000, end: 520_000 },
  { id: "munich", label: "Munich", start: 560_000, end: 460_000 },
  { id: "hamburg", label: "Hamburg", start: 390_000, end: 410_000 },
  { id: "cologne", label: "Cologne", start: 250_000, end: 320_000 },
  { id: "frankfurt", label: "Frankfurt", start: 280_000, end: 300_000 },
  { id: "stuttgart", label: "Stuttgart", start: 290_000, end: 270_000 },
  { id: "dresden", label: "Dresden", start: 115_000, end: 120_000 },
];
