import { describe, expect, it } from "vitest";
import { DEFAULT_LOOP_RADIUS, selfLoopPath } from "./self-loop-geometry";

const numbersIn = (path: string) =>
  (path.match(/-?\d+(\.\d+)?/g) ?? []).map((n) => Number.parseFloat(n));

describe("selfLoopPath", () => {
  it("leaves the node's top-right and re-enters at its top-left", () => {
    const { path } = selfLoopPath({ centerX: 100, topY: 50 }, 28);
    // M <start> C <c1> <c2> <end>
    expect(path.startsWith("M 128,50 C ")).toBe(true);
    expect(path.endsWith(" 72,50")).toBe(true);
  });

  it("anchors the label at the arc's apex, above the node and centred on it", () => {
    const { labelX, labelY } = selfLoopPath({ centerX: 100, topY: 50 }, 28);
    expect(labelX).toBe(100);
    // 3/4 of the control reach (2.4r) — the midpoint of a symmetric cubic.
    expect(labelY).toBeCloseTo(50 - 1.8 * 28, 6);
    expect(labelY).toBeLessThan(50);
  });

  it("scales with loopRadius — a bigger radius reaches higher and wider", () => {
    const small = selfLoopPath({ centerX: 0, topY: 0 }, 10);
    const big = selfLoopPath({ centerX: 0, topY: 0 }, 40);
    expect(big.labelY).toBeLessThan(small.labelY);
    expect(Math.min(...numbersIn(big.path))).toBeLessThan(Math.min(...numbersIn(small.path)));
  });

  it("never emits NaN — non-finite anchors fall back to 0, bad radii to the default", () => {
    for (const bad of [
      selfLoopPath({ centerX: Number.NaN, topY: Number.NaN }, 28),
      selfLoopPath({ centerX: 0, topY: 0 }, Number.NaN),
      selfLoopPath({ centerX: 0, topY: 0 }, 0),
      selfLoopPath({ centerX: 0, topY: 0 }, -5),
    ]) {
      expect(bad.path).not.toMatch(/NaN/);
      expect(Number.isFinite(bad.labelX)).toBe(true);
      expect(Number.isFinite(bad.labelY)).toBe(true);
      for (const n of numbersIn(bad.path)) expect(Number.isFinite(n)).toBe(true);
    }
    // A zero/negative radius is treated as "use the default", not as "no loop".
    expect(selfLoopPath({ centerX: 0, topY: 0 }, 0)).toEqual(
      selfLoopPath({ centerX: 0, topY: 0 }, DEFAULT_LOOP_RADIUS),
    );
  });

  it("is deterministic — the same input always yields the same path", () => {
    expect(selfLoopPath({ centerX: 12.5, topY: -3 }, 28)).toEqual(
      selfLoopPath({ centerX: 12.5, topY: -3 }, 28),
    );
  });
});
