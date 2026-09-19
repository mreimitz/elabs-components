/** Acme Logistics — how a quote request becomes a delivered shipment, last quarter. */

export const journeySources = ["Web quote", "Partner API", "Account manager", "Marketplace"];
export const journeyStages = ["Booked", "Re-quoted", "Abandoned"];
export const journeyOutcomes = ["Delivered", "Cancelled"];

export interface JourneyThread {
  source: string;
  stage: string;
  outcome: string;
  /** Requests that took this exact path. */
  value: number;
}

export const journeyThreads: JourneyThread[] = [
  { source: "Web quote", stage: "Booked", outcome: "Delivered", value: 1_840 },
  { source: "Web quote", stage: "Re-quoted", outcome: "Delivered", value: 620 },
  { source: "Web quote", stage: "Abandoned", outcome: "Cancelled", value: 1_410 },
  { source: "Partner API", stage: "Booked", outcome: "Delivered", value: 2_260 },
  { source: "Partner API", stage: "Re-quoted", outcome: "Cancelled", value: 190 },
  { source: "Partner API", stage: "Abandoned", outcome: "Cancelled", value: 240 },
  { source: "Account manager", stage: "Booked", outcome: "Delivered", value: 1_120 },
  { source: "Account manager", stage: "Re-quoted", outcome: "Delivered", value: 380 },
  { source: "Marketplace", stage: "Booked", outcome: "Delivered", value: 540 },
  { source: "Marketplace", stage: "Abandoned", outcome: "Cancelled", value: 760 },
];

/** The same journey as counts per step — the funnel beside the flow. Totals of the threads above. */
export const journeyFunnel = [
  { label: "Quote requested", value: 9_360 },
  { label: "Quote accepted", value: 6_950 },
  { label: "Delivered", value: 6_760 },
];
