import { seeded } from "@/components/grid-parts/grid-kit";

/** Intraday closes kept per position for the trend sparkline, oldest first. */
export const TREND_KEYS = ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9"] as const;

export interface Position extends Record<(typeof TREND_KEYS)[number], number> {
  symbol: string;
  name: string;
  sector: string;
  quantity: number;
  avgCost: number;
  last: number;
  /** Price at the previous close. */
  prevClose: number;
}

const BOOK: [string, string, string, number][] = [
  ["NOVA", "Nova Robotics", "Industrials", 84.2],
  ["HLDN", "Halden Pharma", "Health care", 142.9],
  ["KSTR", "Kestrel Foods", "Consumer", 38.4],
  ["ARCN", "Arcane Semis", "Technology", 512.7],
  ["BRIG", "Brightline Energy", "Energy", 61.3],
  ["CORA", "Coral Bank", "Financials", 27.9],
  ["LUMN", "Lumen Grid", "Utilities", 44.1],
  ["MRDN", "Meridian Air", "Industrials", 19.6],
  ["OSPR", "Osprey Cloud", "Technology", 233.5],
  ["PNTL", "Pinetail Retail", "Consumer", 72.8],
  ["QNTM", "Quantum Bio", "Health care", 12.4],
  ["RVRS", "Riverstone REIT", "Real estate", 55.0],
  ["SLTE", "Slate Telecom", "Communication", 31.7],
  ["TDAL", "Tidal Shipping", "Industrials", 23.3],
  ["UMBR", "Umbra Security", "Technology", 118.6],
  ["VRDN", "Viridian Metals", "Materials", 48.9],
  ["WSTL", "Westland Insurance", "Financials", 96.2],
  ["XPLR", "Explorer Media", "Communication", 15.8],
];

export function makePositions(): Position[] {
  const rnd = seeded(5);
  return BOOK.map(([symbol, name, sector, price]) => {
    let walk = price * (0.97 + rnd.next() * 0.04);
    const trend = {} as Record<(typeof TREND_KEYS)[number], number>;
    for (const key of TREND_KEYS) {
      walk = Math.max(1, walk * (1 + (rnd.next() - 0.49) * 0.012));
      trend[key] = Math.round(walk * 100) / 100;
    }
    return {
      symbol,
      name,
      sector,
      quantity: rnd.int(2, 40) * 250,
      avgCost: Math.round(price * (0.85 + rnd.next() * 0.25) * 100) / 100,
      prevClose: price,
      last: trend.t9,
      ...trend,
    };
  });
}

/** One market tick: a few positions re-price. Untouched rows keep their object (cheap flashes). */
export function tick(current: Position[], step: number): Position[] {
  const rnd = seeded(step * 7919 + 1);
  const next = current.slice();
  const moves = 3 + (step % 4);
  for (let k = 0; k < moves; k++) {
    const i = rnd.int(0, next.length - 1);
    const p = next[i]!;
    const last = Math.max(1, Math.round(p.last * (1 + (rnd.next() - 0.5) * 0.008) * 100) / 100);
    const shifted = {} as Record<(typeof TREND_KEYS)[number], number>;
    TREND_KEYS.forEach((key, j) => {
      shifted[key] = j === TREND_KEYS.length - 1 ? last : p[TREND_KEYS[j + 1]!];
    });
    next[i] = { ...p, ...shifted, last };
  }
  return next;
}
