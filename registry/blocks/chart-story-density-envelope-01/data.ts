/**
 * Fictional flight-test data: 200,000 recorded positions along an approach —
 * along-track distance (m) against cross-track deviation (m), with ground
 * speed (kt). A dense core that narrows at the funnel throat, arrival arcs
 * joining it, streaks beside it. Columnar, as `DensityScatterChart` wants it.
 */
import type { DensityScatterColumns, DensityZone } from "@elabs-ai/components-charts";
import { seededGaussian } from "@/components/density-parts/random";

interface Tube {
  p0: [number, number];
  c: [number, number];
  p1: [number, number];
  sd: number;
  weight: number;
}

const TUBES: Tube[] = [
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

export function buildApproachTraffic(n = 200_000): DensityScatterColumns {
  const { random, gauss } = seededGaussian(20260923);
  const tubeTotal = TUBES.reduce((s, t) => s + t.weight, 0);
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
      let tube = TUBES[0]!;
      for (const t of TUBES) {
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
    label: "Core corridor",
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
