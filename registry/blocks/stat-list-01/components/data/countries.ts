export interface CountrySales {
  code: string;
  name: string;
  value: string;
  /** Share of the top entry, 0-100, drives the Progress bar. */
  share: number;
  /** Percent change vs. the previous period. */
  delta: number;
}

export const COUNTRIES: CountrySales[] = [
  { code: "US", name: "United States", value: "$8,567k", share: 100, delta: 4.7 },
  { code: "BR", name: "Brazil", value: "$2,415k", share: 28, delta: -1.7 },
  { code: "IN", name: "India", value: "$865k", share: 10, delta: 4.7 },
  { code: "AU", name: "Australia", value: "$745k", share: 9, delta: -1.7 },
  { code: "FR", name: "France", value: "$410k", share: 5, delta: 2.1 },
];
