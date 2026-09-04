/** One ordered, decreasing stage per row — the same shape `FunnelChart` takes. */
export interface HourglassStage {
  label: string;
  value: number;
}

export const CONVERSION_FUNNEL: HourglassStage[] = [
  { label: "Visitors", value: 12000 },
  { label: "Signups", value: 4800 },
  { label: "Activated", value: 2100 },
  { label: "Paid", value: 840 },
  { label: "Retained (90 d)", value: 512 },
];
