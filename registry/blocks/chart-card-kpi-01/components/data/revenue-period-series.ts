export type Period = "7d" | "30d" | "12m";

export const SERIES: Record<Period, { date: Date; value: number }[]> = {
  "7d": [
    { date: new Date("2026-06-14"), value: 8200 },
    { date: new Date("2026-06-15"), value: 9100 },
    { date: new Date("2026-06-16"), value: 8700 },
    { date: new Date("2026-06-17"), value: 10400 },
    { date: new Date("2026-06-18"), value: 9900 },
    { date: new Date("2026-06-19"), value: 11200 },
    { date: new Date("2026-06-20"), value: 12050 },
  ],
  "30d": Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2026, 5, i + 1),
    value: 7000 + Math.round(Math.sin(i / 3) * 1800) + i * 90,
  })),
  "12m": Array.from({ length: 12 }, (_, i) => ({
    date: new Date(2025, i, 1),
    value: 42000 + Math.round(Math.cos(i / 2) * 6000) + i * 1500,
  })),
};

export const HEADLINE: Record<Period, { total: string; delta: string; dir: "up" | "down" }> = {
  "7d": { total: "$69,550", delta: "8.2%", dir: "up" },
  "30d": { total: "$281,400", delta: "4.6%", dir: "up" },
  "12m": { total: "$634,890", delta: "12.1%", dir: "up" },
};
