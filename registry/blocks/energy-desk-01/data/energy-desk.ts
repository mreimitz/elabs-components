/**
 * Halden Industrial Park, a fictional site with its own grid connection — 120 days of hourly
 * metering as the energy desk sees it: what the site drew, and what the spot market charged.
 * Every number on screen (the KPIs, the period cost, the rolling average) is computed from
 * these rows at render time.
 */

/** A small seeded generator so the sample data is identical on every render. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const ENERGY_AS_OF = "30 Sep 2026";
export const ENERGY_SOURCE = "Site meter · day-ahead market";

/** A `type`, not an interface, so a row satisfies the charts' `Record<string, unknown>` data. */
export type HourlyReading = {
  /** The hour (UTC). */
  hour: Date;
  /** Site consumption that hour, MWh. */
  consumption: number;
  /** Day-ahead spot price that hour, $/MWh. */
  price: number;
};

const HOUR = 3_600_000;
export const ENERGY_DAYS = 120;
/** The first hour of the window (UTC). */
const FIRST_HOUR = Date.UTC(2026, 5, 3);

/**
 * 2 880 hourly readings (3 Jun → 30 Sep 2026). Consumption follows the shifts — a day peak
 * on weekdays, a shallow trough at night, a lighter weekend — with a heat wave in late July
 * that pushed cooling load up for ten days. Price follows demand loosely, with evening
 * spikes and two market events where it tripled for an afternoon.
 */
export const hourlyReadings: HourlyReading[] = (() => {
  const rnd = seeded(41);
  const rows: HourlyReading[] = [];
  let priceDrift = 0;
  for (let i = 0; i < ENERGY_DAYS * 24; i++) {
    const hour = new Date(FIRST_HOUR + i * HOUR);
    const h = hour.getUTCHours();
    const weekday = hour.getUTCDay();
    const dayIndex = Math.floor(i / 24);
    const weekend = weekday === 0 || weekday === 6;
    // Shift profile: 06–22 runs, 09–17 full, nights idle.
    const shift = h >= 9 && h < 17 ? 1 : h >= 6 && h < 22 ? 0.72 : 0.38;
    const heatWave = dayIndex >= 50 && dayIndex < 60 ? 0.22 : 0;
    const base = weekend ? 9.5 : 16;
    const consumption = base * shift * (1 + heatWave) + (rnd() - 0.5) * 1.6;
    // Price: a $58 floor, demand-linked, evening ramp, slow drift, two events.
    priceDrift += (rnd() - 0.5) * 0.9;
    priceDrift *= 0.98;
    const evening = h >= 17 && h < 21 ? 22 : 0;
    const event = (dayIndex === 33 || dayIndex === 88) && h >= 14 && h < 19 ? 140 : 0;
    const price = 58 + consumption * 2.4 + evening + priceDrift + event + (rnd() - 0.5) * 10;
    rows.push({
      hour,
      consumption: Math.round(Math.max(1.2, consumption) * 100) / 100,
      price: Math.round(Math.max(12, price) * 100) / 100,
    });
  }
  return rows;
})();
