/**
 * memory-prices-fixture — seeded, FICTIONAL storage prices for the River
 * "memory prices" recipe.
 *
 * The original series is not public domain, so these dollars-per-TERABYTE are
 * invented: a per-technology base, a monthly trend and a seeded wobble from
 * {@link seededRnd}, never `Math.random`. The unit is a terabyte rather than a
 * gigabyte so every panel's own axis has real digits to show — at
 * dollars-per-gigabyte the two cheapest technologies round to `0` on every
 * tick, which is a picture that says nothing.
 */

import { seededRnd } from "../marks/seeded-rnd";

/** One month's price for one storage technology. */
export interface MemoryPriceRow extends Record<string, unknown> {
  tech: string;
  month: Date;
  /** Dollars per terabyte. */
  price: number;
}

const TECHS: Array<{ tech: string; base: number; monthly: number }> = [
  { tech: "DRAM", base: 3400, monthly: -45 },
  { tech: "NAND flash", base: 98, monthly: -1.2 },
  { tech: "Hard disk", base: 21, monthly: -0.18 },
  { tech: "Optical", base: 42, monthly: -0.4 },
];

const MONTHS = 36;

/** Three years of monthly prices per technology, oldest first. */
export const MEMORY_PRICES: MemoryPriceRow[] = TECHS.flatMap(({ tech, base, monthly }, t) =>
  Array.from({ length: MONTHS }, (_, m) => ({
    tech,
    month: new Date(2022, m, 1),
    price: Number(
      Math.max(base * 0.1, base + monthly * m + (seededRnd(m, t + 11) - 0.5) * base * 0.05).toFixed(
        2,
      ),
    ),
  })),
);
