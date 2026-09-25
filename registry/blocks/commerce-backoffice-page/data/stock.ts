import { seeded } from "@/components/grid-parts/grid-kit";

export interface StockLine {
  /** `<warehouse>:<sku>` — unique per row. */
  id: string;
  warehouse: "Vienna DC" | "Rotterdam DC" | "Leeds DC";
  sku: string;
  product: string;
  onHand: number;
  /** Units sold per day, trailing 28 days. */
  dailySales: number;
  /** Supplier lead time in days. */
  leadTime: number;
  /** Units to order; typed by the planner, 0 = no order. */
  reorder: number;
}

const WAREHOUSES: StockLine["warehouse"][] = ["Vienna DC", "Rotterdam DC", "Leeds DC"];
const PRODUCTS: [string, string][] = [
  ["SEA-0001", "Task chair"],
  ["SEA-0004", "Drafting stool"],
  ["DES-0101", "Sit-stand desk"],
  ["DES-0103", "Meeting table"],
  ["STO-0201", "Pedestal"],
  ["LIG-0301", "Task lamp"],
  ["ACC-0401", "Monitor arm"],
  ["ACC-0403", "Footrest"],
];

/** Days the stock on hand lasts at the current sales rate. */
export const coverDays = (line: StockLine) =>
  line.dailySales > 0 ? line.onHand / line.dailySales : Infinity;

/** Below this many days of cover beyond the lead time, a line needs an order. */
export const SAFETY_DAYS = 7;

export const needsOrder = (line: StockLine) =>
  line.reorder === 0 && coverDays(line) < line.leadTime + SAFETY_DAYS;

/** The order that restores 30 days of cover after the lead time, rounded to a case of 5. */
export const suggestedOrder = (line: StockLine) =>
  Math.max(0, Math.ceil(((line.leadTime + 30) * line.dailySales - line.onHand) / 5) * 5);

export function makeStock(): StockLine[] {
  const rnd = seeded(61);
  return WAREHOUSES.flatMap((warehouse) =>
    PRODUCTS.map(([sku, product]) => {
      const dailySales = Math.round((0.5 + rnd.next() * 6) * 10) / 10;
      return {
        id: `${warehouse}:${sku}`,
        warehouse,
        sku,
        product,
        onHand: Math.round(dailySales * rnd.int(4, 70)),
        dailySales,
        leadTime: rnd.pick([7, 10, 14, 21]),
        reorder: 0,
      };
    }),
  );
}
