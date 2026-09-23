// registry: analytics-dashboard-01 — copied 2026-09-23
/**
 * Northwind Outfitters, a fictional 60-store retail network — the analytics desk's view.
 * Every number on screen (the KPIs, the average, the forecast, the selection share) is
 * computed from these rows at render time; nothing is typed in twice.
 */

/** A small seeded generator so the sample data is identical on every render. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const ANALYTICS_AS_OF = "30 Sep 2026";
export const ANALYTICS_SOURCE = "POS ledger · store P&L";

/** A `type`, not an interface, so a row satisfies the charts' `Record<string, unknown>` data. */
export type MonthlyRevenue = {
  /** First day of the month (UTC). */
  date: Date;
  /** Network revenue that month, $k. */
  revenue: number;
};

/** One store: its trailing-twelve-month revenue and operating margin. */
export type StorePerformance = {
  store: string;
  district: string;
  /** Trailing twelve months revenue, $k. */
  revenue: number;
  /** Operating margin, %. */
  margin: number;
};

/**
 * 36 months of network revenue (Oct 2023 → Sep 2026): a steady climb, a December peak and
 * a February trough every year, plus noise — three full seasons, so a seasonal forecast has
 * enough history (it needs at least two).
 */
export const monthlyRevenue: MonthlyRevenue[] = (() => {
  const rnd = seeded(7);
  // Seasonal lift by calendar month, January first.
  const SEASON = [-0.06, -0.14, -0.04, 0.0, 0.03, -0.02, 0.04, 0.06, -0.03, 0.02, 0.08, 0.24];
  return Array.from({ length: 36 }, (_, i) => {
    const date = new Date(Date.UTC(2023, 9 + i, 1));
    const base = 2150 + i * 21;
    const seasonal = SEASON[date.getUTCMonth()]!;
    return { date, revenue: Math.round(base * (1 + seasonal) + (rnd() - 0.5) * 120) };
  });
})();

const DISTRICTS = ["Harbor", "North", "Valley", "Coast", "Central", "Ridge"] as const;

/**
 * 60 stores, sorted by revenue (largest first) so the ranking reads top-down. Margin follows
 * revenue loosely — big stores run leaner overheads — with a few outliers either way.
 */
export const stores: StorePerformance[] = (() => {
  const rnd = seeded(23);
  const rows = DISTRICTS.flatMap((district, d) =>
    Array.from({ length: 10 }, (_, i) => {
      const size = rnd();
      const revenue = Math.round(180 + size * 820 + d * 18);
      const margin = Math.round((6 + size * 13 + (rnd() - 0.5) * 9) * 10) / 10;
      return { store: `${district} ${String(i + 1).padStart(2, "0")}`, district, revenue, margin };
    }),
  );
  return rows.sort((a, b) => b.revenue - a.revenue || a.store.localeCompare(b.store));
})();
