import { isoDay, seeded } from "@/components/grid-parts/grid-kit";

export interface SaleLine {
  id: string;
  /** ISO day of the order. */
  date: string;
  quarter: "Q1" | "Q2" | "Q3";
  region: "EMEA" | "AMER" | "APAC";
  country: string;
  rep: string;
  segment: "Enterprise" | "Mid-market" | "SMB";
  product: string;
  units: number;
  revenue: number;
  /** Gross margin, USD. */
  margin: number;
}

const COUNTRIES: Record<SaleLine["region"], string[]> = {
  EMEA: ["Germany", "France", "United Kingdom", "Austria", "Netherlands"],
  AMER: ["United States", "Canada", "Brazil"],
  APAC: ["Japan", "Australia", "Singapore"],
};
const REPS: Record<SaleLine["region"], string[]> = {
  EMEA: ["Lena Huber", "Tom Fischer", "Claire Martin"],
  AMER: ["Diego Alvarez", "Priya Shah", "Megan Cole"],
  APAC: ["Kenji Sato", "Olivia Tan"],
};
const PRODUCTS = [
  ["Analytics Cloud", 1_800],
  ["Data Integration", 2_400],
  ["Embedded SDK", 950],
  ["Automation", 600],
  ["Support Plus", 300],
] as const;

export function makeSales(count = 720): SaleLine[] {
  const rnd = seeded(29);
  return Array.from({ length: count }, (_, i) => {
    const region = rnd.weighted<SaleLine["region"]>([
      ["EMEA", 5],
      ["AMER", 4],
      ["APAC", 2],
    ]);
    const month = rnd.int(0, 8);
    const date = new Date(2026, month, rnd.int(1, 28));
    const [product, unitPrice] = rnd.pick(PRODUCTS);
    const segment = rnd.weighted<SaleLine["segment"]>([
      ["Enterprise", 2],
      ["Mid-market", 3],
      ["SMB", 4],
    ]);
    const units = segment === "Enterprise" ? rnd.int(10, 80) : rnd.int(1, 20);
    const revenue = Math.round(units * unitPrice * (0.85 + rnd.next() * 0.3));
    return {
      id: `SO-${String(24001 + i)}`,
      date: isoDay(date),
      quarter: (["Q1", "Q2", "Q3"] as const)[Math.floor(month / 3)]!,
      region,
      country: rnd.pick(COUNTRIES[region]),
      rep: rnd.pick(REPS[region]),
      segment,
      product,
      units,
      revenue,
      margin: Math.round(revenue * (0.55 + rnd.next() * 0.25)),
    };
  });
}
