/**
 * Fictional wafer probe data: one die per point on a 300 mm wafer with a
 * radial parametric drift, a scratch and a hot spot. `vth` = threshold
 * voltage (mV); `bin` = Pass / Marginal / Fail after test.
 */
import type { DensityScatterColumns } from "@elabs-ai/components-charts";
import { seededGaussian } from "@/components/density-parts/random";

export function buildWaferProbe(n = 150_000): DensityScatterColumns {
  const { random, gauss } = seededGaussian(7);
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
