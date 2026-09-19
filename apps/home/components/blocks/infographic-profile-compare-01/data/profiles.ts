// registry: infographic-profile-compare-01 — copied 2026-09-19
/** Acme Logistics — three carrier partners scored on the same five promises, 0–100. */

export const profileMetrics = [
  { key: "onTime", label: "On time" },
  { key: "damageFree", label: "Damage free" },
  { key: "coverage", label: "Coverage" },
  { key: "cost", label: "Cost" },
  { key: "tracking", label: "Tracking" },
];

export type CarrierProfile = {
  label: string;
  values: Record<string, number>;
};

export const carrierProfiles: CarrierProfile[] = [
  {
    label: "Norden Freight",
    values: { onTime: 92, damageFree: 88, coverage: 61, cost: 54, tracking: 90 },
  },
  {
    label: "Atlas Cargo",
    values: { onTime: 78, damageFree: 82, coverage: 93, cost: 71, tracking: 64 },
  },
  {
    label: "Pelican Lines",
    values: { onTime: 85, damageFree: 95, coverage: 72, cost: 83, tracking: 58 },
  },
];

/** The raw measures behind the scores — one row per carrier, one axis per measure. */
export const carrierDimensions = [
  { key: "transitDays", label: "Transit days" },
  { key: "costPerKg", label: "Cost / kg", format: "currency" as const },
  { key: "claimsPer1k", label: "Claims / 1k" },
  { key: "lanes", label: "Lanes served" },
];

export const carrierMeasures = [
  { carrier: "Norden Freight", transitDays: 9, costPerKg: 2.9, claimsPer1k: 4.1, lanes: 38 },
  { carrier: "Atlas Cargo", transitDays: 14, costPerKg: 2.2, claimsPer1k: 6.4, lanes: 96 },
  { carrier: "Pelican Lines", transitDays: 11, costPerKg: 1.8, claimsPer1k: 1.9, lanes: 52 },
];
