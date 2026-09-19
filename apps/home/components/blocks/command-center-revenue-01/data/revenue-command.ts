// registry: command-center-revenue-01 — copied 2026-09-19
/**
 * Acme Logistics, Q3 — the revenue desk's view. Same fictional company as the KPI card
 * family; every delta on screen is computed from these facts at render time.
 */

/** A small seeded generator so the sample series is identical on every render. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const REVENUE_PERIOD = "Q3 (Jul–Sep)";
export const REVENUE_AS_OF = "31 Aug, 09:40";
export const REVENUE_SOURCE = "ERP · billing ledger";

/** A `type`, not an interface, so a row satisfies the charts' `Record<string, unknown>` data. */
export type RevenueWeek = {
  date: Date;
  /** Booked revenue that week, $k. */
  revenue: number;
  /** Trailing four-week average, $k. */
  trailing: number;
  /** Same week last year, $k. */
  lastYear: number;
};

/** 26 weeks of booked revenue with its trailing average and the prior-year line. */
export const revenueWeeks: RevenueWeek[] = (() => {
  const rnd = seeded(41);
  const raw = Array.from({ length: 26 }, (_, i) => {
    const season = Math.sin((i / 26) * Math.PI * 1.6) * 38;
    return Math.round(412 + i * 6.4 + season + (rnd() - 0.5) * 46);
  });
  return raw.map((revenue, i) => {
    const window = raw.slice(Math.max(0, i - 3), i + 1);
    return {
      date: new Date(Date.UTC(2026, 2, 2 + i * 7)),
      revenue,
      trailing: Math.round(window.reduce((sum, v) => sum + v, 0) / window.length),
      lastYear: Math.round(revenue * (0.84 + rnd() * 0.1)),
    };
  });
})();

/** The weekly run-rate the plan needs, $k. */
export const REVENUE_WEEKLY_TARGET = 520;

export interface RevenueHeadline {
  id: string;
  label: string;
  value: number;
  format: "currency" | "percent" | "number";
  delta: string;
  direction: "up" | "down";
  /** False when a fall is the good outcome (cost, churn, days). */
  higherIsBetter: boolean;
  baseline: string;
  trend: number[];
}

export const revenueHeadlines: RevenueHeadline[] = [
  {
    id: "revenue",
    label: "Revenue, quarter to date",
    value: 4_860_000,
    format: "currency",
    delta: "+11.8%",
    direction: "up",
    higherIsBetter: true,
    baseline: "vs. same point last year",
    trend: revenueWeeks.slice(-13).map((w) => w.revenue),
  },
  {
    id: "margin",
    label: "Gross margin",
    value: 0.382,
    format: "percent",
    delta: "+1.4pp",
    direction: "up",
    higherIsBetter: true,
    baseline: "vs. plan of 36.8%",
    trend: [35.1, 35.4, 35.2, 36.0, 36.4, 36.1, 36.9, 37.2, 37.0, 37.6, 37.9, 38.0, 38.2],
  },
  {
    id: "orders",
    label: "Orders shipped",
    value: 18_420,
    format: "number",
    delta: "+6.2%",
    direction: "up",
    higherIsBetter: true,
    baseline: "vs. last quarter",
    trend: [1290, 1310, 1275, 1340, 1388, 1402, 1371, 1440, 1466, 1451, 1502, 1533, 1560],
  },
  {
    id: "cost",
    label: "Cost per shipment",
    value: 42.6,
    format: "currency",
    delta: "−3.1%",
    direction: "down",
    higherIsBetter: false,
    baseline: "vs. last quarter",
    trend: [46.2, 45.9, 45.8, 45.1, 44.8, 44.9, 44.2, 43.9, 43.6, 43.4, 43.0, 42.9, 42.6],
  },
];

/** Revenue share by service line — sums to 100. */
export const revenueMix = [
  { label: "Freight", value: 44 },
  { label: "Last mile", value: 27 },
  { label: "Warehousing", value: 18 },
  { label: "Customs", value: 11 },
];

/** Service-line rank by monthly revenue, $k. */
export const serviceRank = (() => {
  const rnd = seeded(77);
  const months = ["Apr", "May", "Jun", "Jul", "Aug"];
  const lines = ["Freight", "Last mile", "Warehousing", "Customs", "Returns"];
  return months.flatMap((month, m) =>
    lines.map((line, l) => ({
      month,
      line,
      revenue: Math.round(120 + ((l * 31 + m * 43) % 90) + rnd() * 30),
    })),
  );
})();

export interface RevenueAccount {
  name: string;
  region: string;
  /** Revenue this quarter, $k. */
  revenue: number;
  /** Share of the account's annual commitment already booked, 0–100. */
  attainment: number;
  risk: "on track" | "watch" | "at risk";
}

export const topAccounts: RevenueAccount[] = [
  { name: "Northwind Retail", region: "EMEA", revenue: 612, attainment: 78, risk: "on track" },
  { name: "Halden Pharma", region: "EMEA", revenue: 548, attainment: 71, risk: "on track" },
  { name: "Kestrel Foods", region: "AMER", revenue: 471, attainment: 52, risk: "watch" },
  { name: "Orbit Electronics", region: "APAC", revenue: 403, attainment: 66, risk: "on track" },
  { name: "Summit Outdoor", region: "AMER", revenue: 288, attainment: 34, risk: "at risk" },
];
