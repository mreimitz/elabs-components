// registry: marketing-stats-01 — copied 2026-09-19
import type { ReactNode } from "react";
import { LogoStrip, StatsBand, type Stat } from "@elabs-ai/components-marketing";

export interface MarketingStatsProps {
  stats?: Stat[];
  /** Customer wordmarks under the numbers. Pass your own marks; text is the honest default. */
  logos?: ReactNode[];
  caption?: ReactNode;
}

const DEFAULT_STATS: Stat[] = [
  { value: "41M", label: "parcels a year" },
  { value: "96.4%", label: "delivered on time" },
  { value: "19 h", label: "median customs clearance" },
  { value: "38", label: "countries served" },
];

const wordmark = (name: string) => (
  <span className="text-subtitle font-semibold text-muted-foreground" key={name}>
    {name}
  </span>
);

/** Proof in two rows: the numbers, then who stands behind them. */
export function MarketingStats({
  stats = DEFAULT_STATS,
  logos = ["Northwind", "Halden", "Kestrel", "Orbit", "Lumen"].map(wordmark),
  caption = "Trusted by operations teams at",
}: MarketingStatsProps) {
  return (
    <section
      className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16"
      data-slot="marketing-stats"
    >
      <StatsBand stats={stats} />
      <LogoStrip caption={caption} logos={logos} />
    </section>
  );
}
