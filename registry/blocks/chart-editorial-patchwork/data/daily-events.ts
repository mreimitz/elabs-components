/** One event per row — an hour of day (0–23, fractional allowed) plus a category. */
export interface PatchworkEvent {
  hour: number;
  category: string;
  /** Relative weight, 0–1. Drives how dark the overlaid wash reads (not the shape). */
  weight?: number;
}

/** A day's worth of support-ticket opens, meeting starts and deploys. */
export const DAILY_EVENTS: PatchworkEvent[] = [
  { hour: 6.5, category: "Deploy", weight: 0.4 },
  { hour: 7, category: "Meeting", weight: 0.5 },
  { hour: 8, category: "Support", weight: 0.6 },
  { hour: 8.5, category: "Meeting", weight: 0.4 },
  { hour: 9, category: "Support", weight: 0.8 },
  { hour: 9.5, category: "Support", weight: 0.7 },
  { hour: 10, category: "Deploy", weight: 0.6 },
  { hour: 10, category: "Meeting", weight: 0.5 },
  { hour: 11, category: "Support", weight: 0.9 },
  { hour: 11.5, category: "Support", weight: 0.6 },
  { hour: 12, category: "Meeting", weight: 0.3 },
  { hour: 13, category: "Support", weight: 0.5 },
  { hour: 13.5, category: "Deploy", weight: 0.7 },
  { hour: 14, category: "Meeting", weight: 0.6 },
  { hour: 14.5, category: "Support", weight: 0.8 },
  { hour: 15, category: "Support", weight: 0.9 },
  { hour: 15.5, category: "Deploy", weight: 0.5 },
  { hour: 16, category: "Meeting", weight: 0.4 },
  { hour: 16.5, category: "Support", weight: 0.7 },
  { hour: 17, category: "Support", weight: 0.5 },
  { hour: 18, category: "Deploy", weight: 0.3 },
  { hour: 20, category: "Deploy", weight: 0.2 },
  { hour: 23, category: "Support", weight: 0.15 },
  { hour: 2, category: "Support", weight: 0.1 },
];

/** Category → chart series token index (1–12), assigned in first-seen order. */
export function categoryTokenIndex(categories: string[], category: string): number {
  const i = categories.indexOf(category);
  return ((i >= 0 ? i : 0) % 12) + 1;
}
