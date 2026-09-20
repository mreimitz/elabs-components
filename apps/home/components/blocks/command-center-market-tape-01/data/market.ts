// registry: command-center-market-tape-01 — copied 2026-09-19
/** A fictional freight-rate desk: one headline index and the lanes that move it. */

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

export type MarketCandle = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Contracts traded, thousands. */
  volume: number;
};

/** 40 trading days of the Acme Container Index, $ per forty-foot box. */
export const marketCandles: MarketCandle[] = (() => {
  const rnd = seeded(1207);
  let close = 2_140;
  let day = 0;
  return Array.from({ length: 40 }, () => {
    const open = close;
    close = round(open + (rnd() - 0.46) * 90);
    // Skip weekends so the axis shows trading days.
    day += 1;
    while ([0, 6].includes(new Date(Date.UTC(2026, 6, day)).getUTCDay())) day += 1;
    return {
      date: new Date(Date.UTC(2026, 6, day)),
      open,
      close,
      high: round(Math.max(open, close) + rnd() * 38),
      low: round(Math.min(open, close) - rnd() * 38),
      volume: Math.round(180 + rnd() * 240 + Math.abs(close - open) * 2.5),
    };
  });
})();

export interface MarketLane {
  symbol: string;
  name: string;
  /** $ per forty-foot box, last 20 closes. */
  closes: number[];
}

export const marketLanes: MarketLane[] = (() => {
  const rnd = seeded(88);
  const lane = (symbol: string, name: string, start: number, drift: number): MarketLane => {
    let value = start;
    return {
      symbol,
      name,
      closes: Array.from({ length: 20 }, () => {
        value = Math.round(value + (rnd() - 0.5 + drift) * start * 0.025);
        return value;
      }),
    };
  };
  return [
    lane("SHA-RTM", "Shanghai → Rotterdam", 2_860, 0.12),
    lane("SHA-LAX", "Shanghai → Los Angeles", 3_420, -0.1),
    lane("RTM-NYC", "Rotterdam → New York", 1_980, 0.04),
    lane("SIN-RTM", "Singapore → Rotterdam", 2_510, 0.09),
    lane("RTM-GRU", "Rotterdam → São Paulo", 1_640, -0.06),
    lane("DXB-RTM", "Dubai → Rotterdam", 1_310, 0.02),
  ];
})();
