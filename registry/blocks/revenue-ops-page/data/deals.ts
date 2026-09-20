/** Acme Logistics — the open pipeline behind the revenue desk. Facts only. */

export type DealStage = "Qualified" | "Proposal" | "Negotiation" | "Commit";

export interface Deal {
  id: string;
  account: string;
  region: "EMEA" | "AMER" | "APAC";
  owner: string;
  stage: DealStage;
  /** Annual contract value, $k. */
  value: number;
  /** Win probability, 0–100, from the forecast model. */
  probability: number;
  /** ISO date the deal is expected to close. */
  closes: string;
  /** Logged touches per week, last 8 weeks — a flat line near zero is a stalled deal. */
  activity: number[];
}

export const deals: Deal[] = [
  {
    id: "D-4821",
    account: "Northwind Retail",
    region: "EMEA",
    owner: "Ava Reyes",
    stage: "Commit",
    value: 640,
    probability: 90,
    closes: "2026-09-26",
    activity: [3, 4, 4, 6, 5, 7, 8, 9],
  },
  {
    id: "D-4790",
    account: "Halden Pharma",
    region: "EMEA",
    owner: "Jonas Weber",
    stage: "Negotiation",
    value: 520,
    probability: 70,
    closes: "2026-09-30",
    activity: [2, 3, 5, 4, 6, 6, 5, 7],
  },
  {
    id: "D-4766",
    account: "Kestrel Foods",
    region: "AMER",
    owner: "Sam Mori",
    stage: "Negotiation",
    value: 410,
    probability: 55,
    closes: "2026-10-09",
    activity: [5, 4, 4, 3, 2, 2, 1, 1],
  },
  {
    id: "D-4752",
    account: "Orbit Electronics",
    region: "APAC",
    owner: "Mei Tanaka",
    stage: "Proposal",
    value: 380,
    probability: 45,
    closes: "2026-10-16",
    activity: [1, 2, 2, 3, 4, 4, 5, 6],
  },
  {
    id: "D-4731",
    account: "Summit Outdoor",
    region: "AMER",
    owner: "Sam Mori",
    stage: "Proposal",
    value: 295,
    probability: 30,
    closes: "2026-10-23",
    activity: [4, 3, 2, 2, 1, 0, 0, 0],
  },
  {
    id: "D-4718",
    account: "Lumen Optics",
    region: "EMEA",
    owner: "Ava Reyes",
    stage: "Commit",
    value: 260,
    probability: 85,
    closes: "2026-09-24",
    activity: [2, 2, 3, 5, 6, 6, 7, 7],
  },
  {
    id: "D-4702",
    account: "Pacifica Grocers",
    region: "APAC",
    owner: "Mei Tanaka",
    stage: "Qualified",
    value: 230,
    probability: 20,
    closes: "2026-11-06",
    activity: [0, 1, 1, 2, 2, 3, 3, 4],
  },
  {
    id: "D-4695",
    account: "Harbor Freightways",
    region: "AMER",
    owner: "Jordan Tam",
    stage: "Negotiation",
    value: 215,
    probability: 65,
    closes: "2026-10-02",
    activity: [3, 3, 4, 4, 5, 5, 6, 6],
  },
  {
    id: "D-4688",
    account: "Alpenrose Dairy",
    region: "EMEA",
    owner: "Jonas Weber",
    stage: "Qualified",
    value: 180,
    probability: 25,
    closes: "2026-11-13",
    activity: [1, 1, 2, 1, 2, 2, 3, 2],
  },
  {
    id: "D-4671",
    account: "Bluewater Marine",
    region: "APAC",
    owner: "Mei Tanaka",
    stage: "Proposal",
    value: 165,
    probability: 40,
    closes: "2026-10-30",
    activity: [2, 2, 2, 3, 3, 2, 3, 4],
  },
  {
    id: "D-4660",
    account: "Cinder Steelworks",
    region: "AMER",
    owner: "Jordan Tam",
    stage: "Commit",
    value: 150,
    probability: 80,
    closes: "2026-09-29",
    activity: [4, 5, 5, 6, 6, 7, 7, 8],
  },
  {
    id: "D-4643",
    account: "Verde Botanicals",
    region: "EMEA",
    owner: "Ava Reyes",
    stage: "Qualified",
    value: 120,
    probability: 15,
    closes: "2026-11-20",
    activity: [1, 0, 1, 1, 2, 2, 2, 2],
  },
];

/** A deal with fewer touches than this over its last three weeks is called stalled. */
export const STALLED_TOUCHES = 5;
