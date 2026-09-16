import { ordersShipped, revenue } from "@/components/kpi-card-parts/data/acme-quarter";

/**
 * One category's worth of a whole — a FACT (`value`/`priorYear`), never a
 * pre-computed share or delta; `kpi-composition.tsx` computes every
 * percentage and pp change at render time so they can never drift from these
 * numbers.
 */
export interface CompositionCategory {
  id: string;
  label: string;
  value: number;
  priorYear: number;
}

/**
 * Revenue by channel — sums to `revenue.actual` (2,885,870) and
 * `revenue.priorYear` (2,650,000) from the shared Acme Logistics Q3 dataset,
 * so "revenue by channel" and "total revenue" can never disagree.
 */
export const revenueByChannel: CompositionCategory[] = [
  { id: "direct", label: "Direct", value: 1_326_500, priorYear: 1_166_000 },
  { id: "partners", label: "Partners", value: 980_000, priorYear: 900_000 },
  { id: "marketplace", label: "Marketplace", value: 460_000, priorYear: 424_000 },
  { id: "other", label: "Other", value: 119_370, priorYear: 160_000 },
];

/**
 * Shipments by region — sums to `ordersShipped.actual` (6,300) and
 * `ordersShipped.priorYear` (5,980). Central is deliberately under 3% of the
 * total so the block's own "merge small segments into Other" rule has a real
 * case to exercise.
 */
export const shipmentsByRegion: CompositionCategory[] = [
  { id: "north", label: "North", value: 2_600, priorYear: 2_450 },
  { id: "south", label: "South", value: 1_700, priorYear: 1_650 },
  { id: "east", label: "East", value: 1_100, priorYear: 1_020 },
  { id: "west", label: "West", value: 750, priorYear: 700 },
  { id: "central", label: "Central", value: 150, priorYear: 160 },
];

// Internal consistency, asserted once at module load rather than trusted by eye.
if (revenueByChannel.reduce((sum, c) => sum + c.value, 0) !== revenue.actual) {
  throw new Error("revenueByChannel must sum to revenue.actual");
}
if (revenueByChannel.reduce((sum, c) => sum + c.priorYear, 0) !== revenue.priorYear) {
  throw new Error("revenueByChannel must sum to revenue.priorYear");
}
if (shipmentsByRegion.reduce((sum, c) => sum + c.value, 0) !== ordersShipped.actual) {
  throw new Error("shipmentsByRegion must sum to ordersShipped.actual");
}
if (shipmentsByRegion.reduce((sum, c) => sum + c.priorYear, 0) !== ordersShipped.priorYear) {
  throw new Error("shipmentsByRegion must sum to ordersShipped.priorYear");
}
