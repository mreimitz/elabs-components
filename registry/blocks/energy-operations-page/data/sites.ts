/**
 * Nordvik Energy, a fictional utility that runs the grid connection of eight industrial parks
 * across the Nordics. The site desk sees one row per park — its contracted capacity, what it is
 * drawing now, what the spot market charges in its price zone — and the alarms the meters
 * raised. Every number on screen is computed from these rows and from the hourly readings of
 * `energy-desk-01`, scaled per site, at render time.
 */
import { hourlyReadings, type HourlyReading } from "@/components/energy-desk-01/data/energy-desk";

/** A small seeded generator so the sample data is identical on every render. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const SITES_AS_OF = "30 Sep 2026 · 17:20";

export type SiteStatus = "normal" | "watch" | "alarm";
export type AlarmSeverity = "critical" | "major" | "minor";

export interface Site {
  id: string;
  name: string;
  /** Country and price zone, as the market names it. */
  zone: string;
  country: string;
  /** [longitude, latitude]. */
  position: [number, number];
  /** Contracted grid capacity, MW. */
  capacityMw: number;
  /** Load now, MW. */
  loadMw: number;
  /** Spot price now in the site's zone, $/MWh. */
  spotPrice: number;
  /** The contracted price the site's supply agreement fixes, $/MWh. */
  contractPrice: number;
  status: SiteStatus;
  /** Multiplier applied to the shared hourly profile — the site's size relative to Halden. */
  loadFactor: number;
  /** Offset applied to the shared hourly price — the zone's premium or discount, $/MWh. */
  priceOffset: number;
  supplier: string;
  contractEnds: string;
  /** What is running on the site today. */
  note: string;
}

export interface SiteAlarm {
  id: string;
  siteId: string;
  severity: AlarmSeverity;
  message: string;
  raised: string;
  /** The recommended response, as the desk's runbook words it. */
  action: string;
}

export const sites: Site[] = [
  {
    id: "HAL",
    name: "Halden Industrial Park",
    zone: "NO1",
    country: "Norway",
    position: [11.387, 59.124],
    capacityMw: 24,
    loadMw: 19.4,
    spotPrice: 96.2,
    contractPrice: 74,
    status: "alarm",
    loadFactor: 1,
    priceOffset: 0,
    supplier: "Østfold Kraft",
    contractEnds: "31 Mar 2027",
    note: "Two furnaces on the evening shift; cooling load still high after the summer.",
  },
  {
    id: "GBG",
    name: "Göteborg Harbour Works",
    zone: "SE3",
    country: "Sweden",
    position: [11.95, 57.7],
    capacityMw: 32,
    loadMw: 23.1,
    spotPrice: 88.5,
    contractPrice: 71,
    status: "watch",
    loadFactor: 1.35,
    priceOffset: -6,
    supplier: "Väst Energi",
    contractEnds: "30 Sep 2027",
    note: "Cold-ironing berths draw whenever a vessel is alongside — three tonight.",
  },
  {
    id: "STV",
    name: "Stavanger Subsea Yard",
    zone: "NO2",
    country: "Norway",
    position: [5.73, 58.97],
    capacityMw: 18,
    loadMw: 11.2,
    spotPrice: 91.8,
    contractPrice: 74,
    status: "normal",
    loadFactor: 0.62,
    priceOffset: -3,
    supplier: "Østfold Kraft",
    contractEnds: "31 Mar 2027",
    note: "Test pool pumps cycle on the hour; the night shift is light.",
  },
  {
    id: "TRD",
    name: "Trondheim Data Campus",
    zone: "NO3",
    country: "Norway",
    position: [10.4, 63.43],
    capacityMw: 40,
    loadMw: 36.8,
    spotPrice: 62.4,
    contractPrice: 64,
    status: "watch",
    loadFactor: 2.1,
    priceOffset: -28,
    supplier: "Midt Kraft",
    contractEnds: "31 Dec 2028",
    note: "Flat load around the clock; 92 % of contracted capacity since the new hall opened.",
  },
  {
    id: "AAR",
    name: "Aarhus Food Cluster",
    zone: "DK1",
    country: "Denmark",
    position: [10.2, 56.16],
    capacityMw: 15,
    loadMw: 9.7,
    spotPrice: 102.7,
    contractPrice: 80,
    status: "alarm",
    loadFactor: 0.55,
    priceOffset: 9,
    supplier: "Jysk Strøm",
    contractEnds: "30 Jun 2027",
    note: "Refrigeration runs through the evening ramp; the dearest hours are its busiest.",
  },
  {
    id: "OUL",
    name: "Oulu Pulp Mill",
    zone: "FI",
    country: "Finland",
    position: [25.47, 65.01],
    capacityMw: 55,
    loadMw: 41.5,
    spotPrice: 71.3,
    contractPrice: 74,
    status: "normal",
    loadFactor: 2.6,
    priceOffset: -18,
    supplier: "Pohjois Voima",
    contractEnds: "31 Dec 2027",
    note: "Continuous process; the mill's own turbine covers a fifth of its load.",
  },
  {
    id: "MAL",
    name: "Malmö Logistics Hub",
    zone: "SE4",
    country: "Sweden",
    position: [13.0, 55.6],
    capacityMw: 12,
    loadMw: 6.9,
    spotPrice: 98.1,
    contractPrice: 77,
    status: "normal",
    loadFactor: 0.42,
    priceOffset: 4,
    supplier: "Väst Energi",
    contractEnds: "30 Sep 2027",
    note: "Truck charging peaks between 22:00 and 02:00, mostly under the contract price.",
  },
  {
    id: "REY",
    name: "Reykjavík Smelter Annex",
    zone: "IS",
    country: "Iceland",
    position: [-21.94, 64.13],
    capacityMw: 30,
    loadMw: 27.3,
    spotPrice: 38.9,
    contractPrice: 42,
    status: "normal",
    loadFactor: 1.6,
    priceOffset: -52,
    supplier: "Landsorka",
    contractEnds: "31 Dec 2029",
    note: "Hydro-fed, flat and cheap; the annex is the fleet's baseline.",
  },
];

export const siteAlarms: SiteAlarm[] = [
  {
    id: "ALM-2041",
    siteId: "HAL",
    severity: "critical",
    message: "Load above 80 % of contracted capacity for 42 minutes",
    raised: "16:38",
    action:
      "Ask the site to shed furnace 2 until 21:00, or lift the capacity band for the evening.",
  },
  {
    id: "ALM-2042",
    siteId: "AAR",
    severity: "critical",
    message: "Spot price above contract by 28 % through the evening ramp",
    raised: "16:55",
    action: "Pre-cool the cold stores now and hold the compressors off 17:00–20:00.",
  },
  {
    id: "ALM-2039",
    siteId: "GBG",
    severity: "major",
    message: "Third vessel alongside — cold-ironing load will exceed the berth plan",
    raised: "15:10",
    action: "Confirm the berth plan with the harbour master before the 18:00 arrival.",
  },
  {
    id: "ALM-2036",
    siteId: "TRD",
    severity: "major",
    message: "Sustained load above 90 % of contract since 08:00",
    raised: "09:02",
    action: "Open the capacity uplift ticket with Midt Kraft — the campus has outgrown its band.",
  },
  {
    id: "ALM-2035",
    siteId: "HAL",
    severity: "minor",
    message: "Meter M-14 reported one missing interval",
    raised: "07:45",
    action: "No response needed — the interval was estimated; watch for a repeat.",
  },
];

/**
 * The site's own hourly series, derived from the shared profile: consumption scaled by the
 * site's size, price shifted by its zone. Memoise it per site — 2 880 rows.
 */
export function readingsFor(site: Site): HourlyReading[] {
  const rnd = seeded(site.id.charCodeAt(0) * 31 + site.id.charCodeAt(2));
  return hourlyReadings.map((row) => ({
    hour: row.hour,
    consumption: Math.round(row.consumption * site.loadFactor * (0.96 + rnd() * 0.08) * 100) / 100,
    price: Math.round(Math.max(8, row.price + site.priceOffset + (rnd() - 0.5) * 4) * 100) / 100,
  }));
}
