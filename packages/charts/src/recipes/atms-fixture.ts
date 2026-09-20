/**
 * atms-fixture — seeded, FICTIONAL ATM counts for the River "ATMs" recipe.
 *
 * River's original picture charts cash machines per country from a source we
 * cannot redistribute, so these numbers are invented: a plausible base per
 * country plus a seeded
 * wobble from {@link seededRnd}, never `Math.random`, so every render, test
 * and screenshot draws exactly the same columns.
 */

import { seededRnd } from "../marks/seeded-rnd";

/** One year's count of cash machines in one country. */
export interface AtmRow extends Record<string, unknown> {
  country: string;
  year: string;
  atms: number;
}

const COUNTRIES: Array<{ country: string; base: number; trend: number }> = [
  { country: "Norhavn", base: 620, trend: -34 },
  { country: "Ostmark", base: 1180, trend: -18 },
  { country: "Valduro", base: 430, trend: 12 },
  { country: "Kerrand", base: 870, trend: -52 },
  { country: "Sildera", base: 250, trend: 6 },
  { country: "Trevose", base: 1520, trend: -90 },
];

const YEARS = ["2019", "2020", "2021", "2022", "2023", "2024"];

/** Long rows: one per country and year, `ChartMultiples`-shaped. */
export const ATM_ROWS: AtmRow[] = COUNTRIES.flatMap(({ country, base, trend }, c) =>
  YEARS.map((year, y) => ({
    country,
    year,
    atms: Math.round(base + trend * y + (seededRnd(y, c + 1) - 0.5) * base * 0.06),
  })),
);

/** The latest year, so a panel title can print the value the reader lands on. */
export const ATM_LATEST_YEAR = YEARS[YEARS.length - 1] as string;
