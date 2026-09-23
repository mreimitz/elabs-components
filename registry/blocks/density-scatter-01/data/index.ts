/**
 * Fictional datasets for the three density-scatter use cases. Every number is
 * invented; each figure's source line says so. Columnar (`Float32Array`) —
 * the shape `DensityScatterChart` wants past ~50k points — and seeded, so a
 * 200k-point figure is the same on the server and in the browser.
 */
import type { DensityScatterColumns, DensityZone } from "@elabs-ai/components-charts";
import { seeded } from "@/components/chart-story-parts/story-kit";

function gaussian(random: () => number): () => number {
  return () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

// ── 1. Flight test: lateral deviation against the operational design domain ──

interface Tube {
  p0: [number, number];
  c: [number, number];
  p1: [number, number];
  sd: number;
  weight: number;
}

/**
 * Recorded aircraft positions along an approach: along-track distance (m)
 * against cross-track deviation (m), with ground speed (kt). A dense core that
 * narrows at the funnel throat, arrival arcs joining it, streaks beside it.
 */
export function buildApproachTraffic(n = 200_000): DensityScatterColumns {
  const random = seeded(20260923);
  const gauss = gaussian(random);
  const tubes: Tube[] = [
    { p0: [-1180, -185], c: [-650, -140], p1: [-150, -18], sd: 5, weight: 0.07 },
    { p0: [-1330, 180], c: [-850, 125], p1: [-200, 20], sd: 5, weight: 0.035 },
    { p0: [-2200, 72], c: [-2050, 58], p1: [-1850, 40], sd: 4, weight: 0.02 },
    { p0: [-2150, -46], c: [-1900, -60], p1: [-1500, -112], sd: 5, weight: 0.028 },
    { p0: [-1750, -30], c: [-1550, -45], p1: [-1300, -85], sd: 4, weight: 0.014 },
    { p0: [-1100, -30], c: [-800, -45], p1: [-500, -72], sd: 4, weight: 0.012 },
    { p0: [1200, 26], c: [1500, 30], p1: [1800, 24], sd: 4, weight: 0.016 },
    { p0: [1600, -26], c: [1850, -32], p1: [2100, -27], sd: 4, weight: 0.014 },
    { p0: [700, -46], c: [900, -52], p1: [1150, -44], sd: 5, weight: 0.012 },
    { p0: [1350, 44], c: [1550, 50], p1: [1700, 42], sd: 5, weight: 0.01 },
    { p0: [2450, -44], c: [2650, -48], p1: [2900, -40], sd: 5, weight: 0.008 },
  ];
  const tubeTotal = tubes.reduce((s, t) => s + t.weight, 0);
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const speed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let r = random();
    let px: number;
    let py: number;
    if (r < 0.7) {
      px = -2200 + random() * 5700;
      const sd = px < -650 ? 16 : px < -200 ? 16 - (11 * (px + 650)) / 450 : 5;
      py = gauss() * sd;
    } else if (r < 0.74) {
      px = -2200 + random() * 5700;
      py = gauss() * (px < -200 ? 34 : 11);
    } else if (r < 0.745) {
      px = -2200 + random() * 5700;
      py = gauss() * 110;
    } else {
      r = random() * tubeTotal;
      let tube = tubes[0]!;
      for (const t of tubes) {
        if (r < t.weight) {
          tube = t;
          break;
        }
        r -= t.weight;
      }
      const u = random();
      const v = 1 - u;
      px =
        v * v * tube.p0[0] + 2 * v * u * tube.c[0] + u * u * tube.p1[0] + gauss() * tube.sd * 2.2;
      py = v * v * tube.p0[1] + 2 * v * u * tube.c[1] + u * u * tube.p1[1] + gauss() * tube.sd;
    }
    x[i] = px;
    y[i] = py;
    speed[i] = 80 + 80 * Math.min(1, Math.max(0, (px + 2200) / 5700)) + gauss() * 8;
  }
  return { x, y, values: { speed } };
}

/** The operational design domain: a core corridor and the expanded envelope around it. */
export const APPROACH_ZONES: readonly DensityZone[] = [
  {
    id: "core",
    label: "Core",
    color: "var(--chart-2)",
    bounds: {
      upper: [
        [-2200, 42],
        [-650, 42],
        [-200, 15],
        [3500, 15],
      ],
      lower: [
        [-2200, -42],
        [-650, -42],
        [-200, -15],
        [3500, -15],
      ],
    },
  },
  {
    id: "expanded",
    label: "Expanded envelope",
    color: "var(--chart-1)",
    bounds: {
      upper: [
        [-1450, 215],
        [-200, 30],
        [3500, 30],
      ],
      lower: [
        [-1300, -215],
        [-200, -30],
        [3500, -30],
      ],
    },
  },
];

// ── 2. Semiconductor: wafer probe map ─────────────────────────────────────────

/**
 * Die positions (mm) on a 300 mm wafer with a radial parametric drift, a
 * scratch and a hot spot; `vth` = threshold voltage (mV); `bin` = pass /
 * marginal / fail after test.
 */
export function buildWaferProbe(n = 150_000): DensityScatterColumns {
  const random = seeded(7);
  const gauss = gaussian(random);
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const vth = new Float32Array(n);
  const bin = new Array<string>(n);
  let i = 0;
  while (i < n) {
    const px = (random() * 2 - 1) * 150;
    const py = (random() * 2 - 1) * 150;
    const r = Math.hypot(px, py);
    if (r > 148) continue;
    if (random() < r / 150 - 0.62) continue;
    x[i] = px;
    y[i] = py;
    let v = 420 + r * 0.55 + gauss() * 9;
    const scratch = Math.abs(py - (0.6 * px + 20)) < 3 && px > -60 && px < 90;
    const hot = Math.hypot(px + 70, py + 40) < 18;
    if (scratch) v += 60 + gauss() * 15;
    if (hot) v += 45 + gauss() * 10;
    vth[i] = v;
    bin[i] = v > 520 ? "Fail" : v > 490 ? "Marginal" : "Pass";
    i++;
  }
  return { x, y, values: { vth }, categories: { bin } };
}

// ── 3. Trading: order size against fill latency ───────────────────────────────

/**
 * One day of fills: order size (log10 USD) against fill latency (ms) with
 * slippage (bp). A dense retail cloud, a block-trade tail that gets slower with
 * size, and a slow-venue band around 48 ms.
 */
export function buildFillLatency(n = 250_000): DensityScatterColumns {
  const random = seeded(99);
  const gauss = gaussian(random);
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
