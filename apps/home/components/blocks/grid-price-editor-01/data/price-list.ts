// registry: grid-price-editor-01 — copied 2026-09-25
import { daysAgo, seeded } from "../../grid-parts/grid-kit";

export type PriceStatus = "Active" | "Draft" | "Retired";

export interface PriceRow {
  sku: string;
  product: string;
  category: string;
  /** Landed unit cost, USD. */
  cost: number;
  /** List price, USD. */
  listPrice: number;
  /** Standard discount, percent. */
  discount: number;
  status: PriceStatus;
  /** ISO day the price takes effect. */
  effective: string;
}

/** Below this net margin a price needs a finance sign-off, so the grid refuses it. */
export const MARGIN_FLOOR = 0.18;

export const CATEGORIES = ["Seating", "Desks", "Storage", "Lighting", "Accessories"] as const;
export const STATUSES: readonly PriceStatus[] = ["Active", "Draft", "Retired"];

const NAMES: Record<(typeof CATEGORIES)[number], string[]> = {
  Seating: ["Task chair", "Lounge chair", "Stool", "Ergo chair Pro", "Visitor chair", "Bench"],
  Desks: ["Sit-stand desk", "Writing desk", "Meeting table", "Corner desk", "Bench desk"],
  Storage: ["Pedestal", "Bookcase", "Locker bank", "Credenza", "Mobile cabinet"],
  Lighting: ["Task lamp", "Floor lamp", "Pendant", "Wall washer"],
  Accessories: ["Monitor arm", "Cable tray", "Footrest", "Desk screen", "Whiteboard", "Coat stand"],
};

export const netPrice = (row: Pick<PriceRow, "listPrice" | "discount">) =>
  row.listPrice * (1 - row.discount / 100);

export const marginOf = (row: Pick<PriceRow, "listPrice" | "discount" | "cost">) => {
  const net = netPrice(row);
  return net > 0 ? (net - row.cost) / net : 0;
};

export function makePriceList(): PriceRow[] {
  const rnd = seeded(11);
  const rows: PriceRow[] = [];
  CATEGORIES.forEach((category, c) => {
    NAMES[category].forEach((name, i) => {
      const cost = Math.round((40 + rnd.next() * 420) * 100) / 100;
      const markup = 1.6 + rnd.next() * 1.2;
      rows.push({
        sku: `${category.slice(0, 3).toUpperCase()}-${String(c * 100 + i + 1).padStart(4, "0")}`,
        product: name,
        category,
        cost,
        listPrice: Math.round(cost * markup) - 0.01,
        discount: rnd.pick([0, 5, 10, 10, 15, 20]),
        status: rnd.weighted([
          ["Active", 7],
          ["Draft", 2],
          ["Retired", 1],
        ]),
        effective: daysAgo(rnd.int(-30, 120)),
      });
    });
  });
  return rows;
}
