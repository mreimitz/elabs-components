// registry: grid-orders-detail-01 — copied 2026-09-25
import { daysAgo, seeded } from "../../grid-parts/grid-kit";

export type OrderStatus = "Pending" | "Packed" | "Shipped" | "Delivered" | "Returned";

export interface OrderLine {
  sku: string;
  product: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customer: string;
  email: string;
  /** ISO day placed. */
  placed: string;
  channel: "Web" | "Marketplace" | "Retail" | "B2B portal";
  status: OrderStatus;
  carrier: string;
  city: string;
  lines: OrderLine[];
  total: number;
}

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "Pending",
  "Packed",
  "Shipped",
  "Delivered",
  "Returned",
];

const CUSTOMERS = [
  "Amara Nwosu",
  "Jonas Keller",
  "Sofia Ricci",
  "Liam O'Brien",
  "Hana Kobayashi",
  "Mateo García",
  "Nora Lindqvist",
  "Arjun Mehta",
  "Chloé Dubois",
  "Felix Wagner",
  "Zoe Papadopoulos",
  "Ethan Brooks",
];
const CITIES = ["Vienna", "Munich", "Zurich", "Milan", "Lyon", "Rotterdam", "Leeds", "Graz"];
const CATALOGUE: [string, string, number][] = [
  ["SEA-0001", "Task chair", 289],
  ["DES-0101", "Sit-stand desk", 649],
  ["LIG-0301", "Task lamp", 89],
  ["ACC-0401", "Monitor arm", 119],
  ["STO-0201", "Pedestal", 229],
  ["ACC-0403", "Footrest", 49],
  ["ACC-0404", "Desk screen", 159],
];

export function makeOrders(count = 96): Order[] {
  const rnd = seeded(41);
  return Array.from({ length: count }, (_, i) => {
    const age = rnd.int(0, 45);
    const status: OrderStatus =
      age < 2
        ? "Pending"
        : age < 4
          ? rnd.pick(["Pending", "Packed"] as const)
          : age < 8
            ? rnd.pick(["Packed", "Shipped"] as const)
            : rnd.weighted<OrderStatus>([
                ["Delivered", 9],
                ["Returned", 1],
              ]);
    const lines = Array.from({ length: rnd.int(1, 4) }, () => {
      const [sku, product, unitPrice] = rnd.pick(CATALOGUE);
      return { sku, product, unitPrice, quantity: rnd.int(1, 6) };
    });
    const customer = rnd.pick(CUSTOMERS);
    return {
      id: `ORD-${String(58210 + i)}`,
      customer,
      email: `${customer.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      placed: daysAgo(age),
      channel: rnd.weighted<Order["channel"]>([
        ["Web", 6],
        ["Marketplace", 3],
        ["Retail", 1],
        ["B2B portal", 2],
      ]),
      status,
      carrier: rnd.pick(["DHL", "UPS", "Post AG", "DPD"]),
      city: rnd.pick(CITIES),
      lines,
      total: lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    };
  }).sort((a, b) => (a.placed < b.placed ? 1 : -1));
}
