/**
 * Ashgrove's order book — the data-app tab's virtualised `DataTable` (RM-095, concept §4.2
 * "a back-office team browsing 2M orders"). `generateOrders(n)` is pure and seeded (never
 * `Math.random`, see `lib/prng.ts`): the same `n` always returns the same rows, and
 * `generateOrders(50_000)` completes in under 150 ms (`fixtures.test.ts`) so the tab's claim
 * of scale is honest rather than a fixed 50-row demo table pretending to be a data app.
 */
import type { ColumnDef } from "@elabs-ai/components-data";
import { OWNERS, PRODUCTS, REGIONS, type Owner, type Product, type Region } from "./company";
import { mulberry32, pick } from "./lib/prng";

export type OrderStatus = "paid" | "pending" | "overdue" | "refunded";

export interface OrderRow {
  id: string;
  account: string;
  region: Region;
  product: Product;
  amount: number;
  status: OrderStatus;
  /** ISO date (`YYYY-MM-DD`), within Q3 FY26. */
  created: string;
  owner: Owner;
}

/** Default size for the data-app tab — "2M orders" (§4.2) is the story; 50k is what renders. */
export const ORDERS_FULL_COUNT = 50_000;

// ── Account pool ─────────────────────────────────────────────────────────────
// Combinatorial, not random: `NAME_A × NAME_B × SUFFIX` gives 24 × 12 × 8 = 2 304 distinct
// names; `ACCOUNT_POOL_SIZE` takes a deterministic slice, so two runs share the exact same
// account list without hashing or a stored fixture file.
const NAME_A = [
  "Brightfield",
  "Cedarline",
  "Lumenwood",
  "Harborview",
  "Ashfen",
  "Rowanmere",
  "Silvergate",
  "Marlowfield",
  "Copperdale",
  "Thistlewood",
  "Fernbridge",
  "Larkspur",
  "Millbrook",
  "Graniteholm",
  "Windermoor",
  "Brackenhurst",
  "Sablewick",
  "Ironvale",
  "Hazelcourt",
  "Wrenfield",
  "Bramblewood",
  "Sterlingmoor",
  "Pinehaven",
  "Greywick",
] as const;
const NAME_B = [
  "Analytics",
  "Logistics",
  "Freight",
  "Retail",
  "Media",
  "Health",
  "Robotics",
  "Provisions",
  "Energy",
  "Textiles",
  "Finance",
  "Studios",
] as const;
const SUFFIX = ["Inc.", "Ltd.", "GmbH", "S.A.", "Group", "Holdings", "Partners", "Co."] as const;

export const ACCOUNT_POOL_SIZE = 480;
export const ACCOUNTS: string[] = Array.from({ length: ACCOUNT_POOL_SIZE }, (_, i) => {
  const a = NAME_A[i % NAME_A.length]!;
  const b = NAME_B[Math.floor(i / NAME_A.length) % NAME_B.length]!;
  const s = SUFFIX[Math.floor(i / (NAME_A.length * NAME_B.length)) % SUFFIX.length]!;
  return `${a} ${b} ${s}`;
});

/**
 * Region and account owner are properties of the ACCOUNT, not the order — a customer's
 * orders all belong to the same region and the same account manager. Round-robin, not
 * random, so every region/owner carries close to an equal share of the 480 accounts.
 */
export const ACCOUNT_REGIONS: Record<string, Region> = Object.fromEntries(
  ACCOUNTS.map((account, i) => [account, REGIONS[i % REGIONS.length]!]),
);
export const ACCOUNT_OWNERS: Record<string, Owner> = Object.fromEntries(
  ACCOUNTS.map((account, i) => [account, OWNERS[i % OWNERS.length]!]),
);

const STATUS_WEIGHTS: Array<[OrderStatus, number]> = [
  ["paid", 0.8],
  ["pending", 0.1],
  ["overdue", 0.06],
  ["refunded", 0.04],
];

function pickStatus(draw: number): OrderStatus {
  let acc = 0;
  for (const [status, weight] of STATUS_WEIGHTS) {
    acc += weight;
    if (draw < acc) return status;
  }
  return "paid";
}

/** Epoch ms for 2026-07-01T00:00:00.000Z — Q3 FY26's first day. */
const QUARTER_START_MS = Date.UTC(2026, 6, 1);
/** Q3 FY26 spans 92 days (Jul + Aug + Sep). */
const QUARTER_DAYS = 92;

function isoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * `n` deterministic order rows. Pure function of `n` — `generateOrders(n)` called twice
 * returns deep-equal arrays every time (`fixtures.test.ts` "seed determinism").
 */
export function generateOrders(n: number): OrderRow[] {
  const rnd = mulberry32(7);
  const rows: OrderRow[] = [];
  const pad = String(Math.max(1, n)).length;
  for (let i = 0; i < n; i += 1) {
    const account = pick(ACCOUNTS, rnd());
    const region = ACCOUNT_REGIONS[account]!;
    const owner = ACCOUNT_OWNERS[account]!;
    const product = pick(PRODUCTS, rnd());
    // Log-leaning spread: most orders are small monthly charges, a long tail is enterprise.
    const amount = Math.round((80 + rnd() ** 2.6 * 42_000) * 100) / 100;
    const status = pickStatus(rnd());
    const dayOffset = Math.floor(rnd() * QUARTER_DAYS);
    const created = isoDate(QUARTER_START_MS + dayOffset * 86_400_000);
    rows.push({
      id: `ord-${String(i + 1).padStart(Math.max(6, pad), "0")}`,
      account,
      region,
      product,
      amount,
      status,
      created,
      owner,
    });
  }
  return rows;
}

/** Column definitions for `DataTable` — the same shape the data-app tab renders. */
export const ordersColumns: ColumnDef<OrderRow>[] = [
  { accessorKey: "id", header: "Order" },
  { accessorKey: "account", header: "Account" },
  { accessorKey: "region", header: "Region" },
  { accessorKey: "product", header: "Product" },
  { accessorKey: "amount", header: "Amount", meta: { numeric: true } },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "created", header: "Created" },
  { accessorKey: "owner", header: "Owner" },
];
