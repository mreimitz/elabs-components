/**
 * `resolveCurve` — the RM-112 named-curve vocabulary (`Line`/`Area`/`AreaBand`) and,
 * since RM-196 (ADR 0042 A.7), `PatternArea`/`ProfitLossLine`/`LiveLine`'s widened
 * `curve?: CurveFactory | CurveAlias`. All six call sites resolve through this ONE
 * function — this file is its only direct test, so it stands in for each of them:
 * `pattern-area.tsx`, `profit-loss-line.tsx` and `live-line.tsx` each call
 * `resolveCurve(curve)` at their one curve-consuming `<AreaClosed>`/`<LinePath>` site
 * (confirmed by reading each file), so a correct `resolveCurve` is a correct curve prop
 * for all three, without needing `useChartStable`'s chart context to render each part
 * standalone in jsdom.
 */
import {
  curveLinear,
  curveMonotoneX,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from "@visx/curve";
import { describe, expect, it } from "vitest";
import { resolveCurve } from "./curve-types";

describe("resolveCurve", () => {
  it("maps every named alias to its d3/visx factory, each a DIFFERENT function", () => {
    expect(resolveCurve("linear")).toBe(curveLinear);
    expect(resolveCurve("monotone")).toBe(curveMonotoneX);
    expect(resolveCurve("natural")).toBe(curveNatural);
    expect(resolveCurve("step")).toBe(curveStep);
    expect(resolveCurve("step-before")).toBe(curveStepBefore);
    expect(resolveCurve("step-after")).toBe(curveStepAfter);
    // Non-vacuous: the six results are pairwise distinct, so mapping "linear" to
    // curveStep's factory (or any other cross-wiring) would fail this, not just a
    // "some factory came back" check.
    const resolved = [
      resolveCurve("linear"),
      resolveCurve("monotone"),
      resolveCurve("natural"),
      resolveCurve("step"),
      resolveCurve("step-before"),
      resolveCurve("step-after"),
    ];
    expect(new Set(resolved).size).toBe(resolved.length);
  });

  it("passes a raw d3/visx CurveFactory through untouched (curve={someFactory} keeps working)", () => {
    expect(resolveCurve(curveStep)).toBe(curveStep);
  });
});
