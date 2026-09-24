/**
 * Fictional trading data: one day of order fills — order size (log10 USD)
 * against fill latency (ms), with slippage (bp). A dense retail cloud, a
 * block-trade tail that gets slower with size, and one slow venue at ~48 ms.
 */
import type { DensityScatterColumns, DensityZone } from "@elabs-ai/components-charts";
import { seededGaussian } from "@/components/density-parts/random";

export function buildFillLatency(n = 250_000): DensityScatterColumns {
  const { random, gauss } = seededGaussian(99);
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const slippage = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = random();
    let size: number;
    let latency: number;
    if (r < 0.78) {
      size = 2.2 + Math.abs(gauss()) * 0.9;
      latency = Math.exp(1.2 + gauss() * 0.45) + size * 0.8;
    } else if (r < 0.9) {
      size = 4.2 + random() * 1.8;
      latency = 12 + (size - 4.2) * 9 + Math.abs(gauss()) * 6;
    } else if (r < 0.97) {
      size = 2 + random() * 3.5;
      latency = 48 + gauss() * 4;
    } else {
      size = 2 + random() * 4;
      latency = 5 + Math.abs(gauss()) * 40;
    }
    x[i] = size;
    y[i] = Math.max(0.3, latency);
    slippage[i] = Math.max(0, (latency / 20) * 1.4 + gauss() * 0.6 + (size > 4.5 ? 2 : 0));
  }
  return { x, y, values: { slippage } };
}

/** Service-level bands on the latency axis — flat min/max zones. */
export const LATENCY_ZONES: readonly DensityZone[] = [
  { id: "sla", label: "Within SLA (≤ 20 ms)", color: "var(--chart-2)", bounds: { y: [0, 20] } },
  {
    id: "degraded",
    label: "Degraded (20–45 ms)",
    color: "var(--chart-1)",
    bounds: { y: [20, 45] },
  },
];
