/**
 * memory-prices-fixture — seeded, FICTIONAL storage prices for the River
 * "memory prices" recipe (`docs/review/datawrapper/dw-river.md` §2).
 *
 * The original series is not public domain, so these dollars-per-gigabyte are
 * invented: a per-technology base, a monthly trend and a seeded wobble from
 * {@link seededRnd}, never `Math.random`.
 */

import { seededRnd } from "../marks/seeded-rnd";

/** One month's price for one storage technology. */
export interface MemoryPriceRow extends Record<string, unknown> {
  tech: string;
  month: Date;
  /** Dollars per gigabyte. */
  price: number;
}

const TECHS: Array<{ tech: string; base: number; monthly: number }> = [
  { tech: "DRAM", base: 3.4, monthly: -0.045 },
  { tech: "NAND flash", base: 0.098, monthly: -0.0012 },
  { tech: "Hard disk", base: 0.021, monthly: -0.00018 },
  { tech: "Optical", base: 0.042, monthly: -0.0004 },
];

const MONTHS = 36;

/** Three years of monthly prices per technology, oldest first. */
export const MEMORY_PRICES: MemoryPriceRow[] = TECHS.flatMap(({ tech, base, monthly }, t) =>
  Array.from({ length: MONTHS }, (_, m) => ({
    tech,
    month: new Date(2022, m, 1),
    price: Number(
      Math.max(base * 0.1, base + monthly * m + (seededRnd(m, t + 11) - 0.5) * base * 0.05).toFixed(
        4,
      ),
    ),
  })),
);
