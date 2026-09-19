/**
 * Ashgrove — the one fictional company every fixture in this folder describes (RM-095).
 *
 * The concept's credibility rule (docs/review/2026-09-18-homepage-concept.md §5, "Real size,
 * real data") bans placeholder copy and requires numbers consistent across tiles — the churn
 * KPI on the hero equals the last point of the chart the dashboard tab draws. That only works if
 * every surface on the page (hero, dashboard tabs, chat, flow canvas, process explorer,
 * settings) describes the SAME company. This module is that company; every other fixture in
 * this folder derives from it.
 *
 * Ashgrove Systems is a mid-market B2B subscription billing and revenue-analytics platform —
 * clearly fictional, chosen to resemble no real vendor. See `README.md` for the full story
 * and the invariants `fixtures.test.ts` checks.
 */

export const COMPANY_NAME = "Ashgrove";
export const COMPANY_FULL_NAME = "Ashgrove Systems, Inc.";

/** Calendar quarter the whole dataset lives in — kept equal to the fiscal quarter (no offset). */
export const FISCAL_QUARTER = "Q3 FY26";

/** The 13 Friday week-endings that make up Q3 FY26 (2026-07-03 .. 2026-09-25). */
export const FISCAL_QUARTER_WEEKS = [
  "2026-07-03",
  "2026-07-10",
  "2026-07-17",
  "2026-07-24",
  "2026-07-31",
  "2026-08-07",
  "2026-08-14",
  "2026-08-21",
  "2026-08-28",
  "2026-09-04",
  "2026-09-11",
  "2026-09-18",
  "2026-09-25",
] as const;

export const REGIONS = ["EMEA", "AMER", "APAC", "LATAM"] as const;
export type Region = (typeof REGIONS)[number];

/** Twelve product modules — the platform's whole catalog. */
export const PRODUCTS = [
  "Ledger Core",
  "Ledger Insights",
  "Billing Cloud",
  "Billing Connect",
  "Usage Metering",
  "Revenue Recognition",
  "Collections Assist",
  "Tax Compliance",
  "Partner Portal",
  "Renewals Studio",
  "Forecast Studio",
  "Data Warehouse Sync",
] as const;
export type Product = (typeof PRODUCTS)[number];

/**
 * The module Ashgrove's own revenue team reads its KPIs in — Ashgrove runs its analytics
 * product on its own numbers. The hero scene (RM-094) is this app: its nav rail names it,
 * over `COMPANY_FULL_NAME` as the workspace.
 */
export const CONSOLE_PRODUCT: Product = "Ledger Insights";

/**
 * The account team — reused verbatim as `orders.ts`' `owner` field and `settings.ts`'
 * workspace members, so the same nine names show up in the data-app table, the settings tab
 * and (via `churn.ts`) the movers list.
 */
export const OWNERS = [
  "Priya Ramanathan",
  "Owen Lindqvist",
  "Fatima Haddad",
  "Marcus Bello",
  "Elin Kowalska",
  "Diego Salgado",
  "Naledi Mokoena",
  "Han Yuwei",
  "Sofia Costa",
] as const;
export type Owner = (typeof OWNERS)[number];
