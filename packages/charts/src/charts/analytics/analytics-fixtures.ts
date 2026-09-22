/**
 * analytics-fixtures.ts — the deterministic datasets behind the analytics
 * stories and tests (RM-138 / RM-139). Every "noise" term is `seededRnd`, so
 * a play function can recompute the statistic it asserts from the same rows
 * the chart drew. Dates are LOCAL-time constructors (d3 time intervals are
 * local).
 */

import { seededRnd } from "../../marks/seeded-rnd";

/** A roughly normal draw in `[-1, 1]` (the mean of three uniform draws, recentred). */
function wobble(i: number, k: number): number {
  return ((seededRnd(i, k) + seededRnd(i, k + 1) + seededRnd(i, k + 2)) / 3 - 0.5) * 2;
}

function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

// ── Life expectancy: an average of exactly 73.8 ─────────────────────────────

/** Five regions whose life expectancy averages to exactly 73.8 years. */
export const LIFE_EXPECTANCY = [
  { region: "Andes", years: 70.2 },
  { region: "Baltic", years: 72.5 },
  { region: "Celtic", years: 73.9 },
  { region: "Danube", years: 75.1 },
  { region: "Etna", years: 77.3 },
] as const;

/** One row per year 2019–2023, one column per region's value that year (mean 73.8 over `years`). */
export const LIFE_BY_YEAR: Array<{ date: Date; years: number }> = LIFE_EXPECTANCY.map((row, i) => ({
  date: new Date(2019 + i, 0, 1),
  years: row.years,
}));

// ── Monthly revenue (3 years, seasonal) ──────────────────────────────────────

/** 36 months of revenue (k$) with a gentle trend and a yearly season. */
export const MONTHLY_REVENUE: Array<{ date: Date; revenue: number }> = Array.from(
  { length: 36 },
  (_, i) => ({
    date: new Date(2022, i, 1),
    revenue: round(120 + i * 1.8 + 14 * Math.sin((i / 12) * 2 * Math.PI) + 5 * wobble(i, 11)),
  }),
);

// ── Three product lines (monthly) ────────────────────────────────────────────

export const PRODUCT_SERIES = [
  { key: "atlas", label: "Atlas", color: "var(--chart-1)" },
  { key: "borealis", label: "Borealis", color: "var(--chart-2)" },
  { key: "cirrus", label: "Cirrus", color: "var(--chart-3)" },
] as const;

/** 24 months, three lines: one rising, one flat, one falling. */
export const PRODUCT_LINES: Array<Record<string, number | Date>> = Array.from(
  { length: 24 },
  (_, i) => ({
    date: new Date(2023, i, 1),
    atlas: round(40 + i * 2.1 + 6 * wobble(i, 21)),
    borealis: round(62 + 7 * wobble(i, 31)),
    cirrus: round(88 - i * 1.4 + 6 * wobble(i, 41)),
  }),
);

// ── Daily sign-ups (noisy, with a weekly rhythm) ─────────────────────────────

/** 120 days of sign-ups: a slow rise, a weekday/weekend rhythm and heavy noise. */
export const DAILY_SIGNUPS: Array<{ date: Date; signups: number }> = Array.from(
  { length: 120 },
  (_, i) => {
    const date = new Date(2024, 0, 1 + i);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    return {
      date,
      signups: Math.round(210 + i * 0.9 - (weekend ? 45 : 0) + 38 * wobble(i, 51)),
    };
  },
);

// ── Scatter: ad spend vs. revenue ────────────────────────────────────────────

/** 80 campaigns: revenue rises with spend, with diminishing returns and noise. */
export const CAMPAIGNS: Array<{ spend: number; revenue: number; region: string }> = Array.from(
  { length: 80 },
  (_, i) => {
    const spend = round(2 + 96 * seededRnd(i, 61), 1);
    const revenue = round(18 + 9.5 * Math.sqrt(spend) * 3 - 0.12 * spend + 14 * wobble(i, 71), 1);
    return { spend, revenue, region: ["North", "South", "East", "West"][i % 4] as string };
  },
);

// ── Quarterly results with a standard error ──────────────────────────────────

/** Six teams' NPS with each estimate's lower/upper 95 % bound. */
export const TEAM_SCORES: Array<{ team: string; nps: number; low: number; high: number }> = [
  { team: "Atlas", nps: 42, low: 36, high: 49 },
  { team: "Borealis", nps: 35, low: 27, high: 41 },
  { team: "Cirrus", nps: 51, low: 47, high: 56 },
  { team: "Delta", nps: 28, low: 18, high: 37 },
  { team: "Echo", nps: 46, low: 41, high: 52 },
  { team: "Foxtrot", nps: 39, low: 30, high: 45 },
];

/** Twelve markets' revenue (M$), for a horizontal bar with a median and quartile band. */
export const MARKET_REVENUE: Array<{ market: string; revenue: number }> = [
  "Lisbon",
  "Oslo",
  "Porto",
  "Riga",
  "Turin",
  "Graz",
  "Lyon",
  "Ghent",
  "Bern",
  "Cork",
  "Brno",
  "Split",
].map((market, i) => ({ market, revenue: round(8 + 30 * seededRnd(i, 81) + 4 * wobble(i, 91)) }));

// ── Daily OHLC (160 sessions) ────────────────────────────────────────────────

export interface OhlcRow {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** 160 business-day sessions of a drifting price. */
export const DAILY_OHLC: OhlcRow[] = (() => {
  const rows: OhlcRow[] = [];
  let close = 100;
  let day = new Date(2024, 0, 2);
  for (let i = 0; rows.length < 160; i += 1) {
    const dow = day.getDay();
    if (dow !== 0 && dow !== 6) {
      const open = close;
      const drift = 0.18 + 2.1 * wobble(i, 101);
      close = round(open + drift, 2);
      const high = round(Math.max(open, close) + 1.2 * seededRnd(i, 111), 2);
      const low = round(Math.min(open, close) - 1.2 * seededRnd(i, 121), 2);
      rows.push({ date: new Date(day), open, high, low, close });
    }
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  }
  return rows;
})();

// ── Response times (records) ─────────────────────────────────────────────────

/** 240 support tickets' first-response time (hours), in three tiers. */
export const RESPONSE_TIMES: Array<{ tier: string; hours: number }> = Array.from(
  { length: 240 },
  (_, i) => {
    const tier = ["Enterprise", "Business", "Starter"][i % 3] as string;
    const base = tier === "Enterprise" ? 6 : tier === "Business" ? 11 : 18;
    return { tier, hours: round(Math.max(0.5, base + 5 * wobble(i, 131) + 3 * wobble(i, 141))) };
  },
);

// ── Monthly temperature with a measurement uncertainty ───────────────────────

/** 24 months of a mean temperature (°C). */
export const MONTHLY_TEMPERATURE: Array<{ date: Date; temp: number }> = Array.from(
  { length: 24 },
  (_, i) => ({
    date: new Date(2023, i, 1),
    temp: round(11 + 8 * Math.sin(((i - 3) / 12) * 2 * Math.PI) + 1.2 * wobble(i, 151)),
  }),
);
