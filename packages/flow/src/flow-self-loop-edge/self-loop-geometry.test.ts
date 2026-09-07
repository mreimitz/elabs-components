import { describe, expect, it } from "vitest";
import { DEFAULT_LOOP_RADIUS, selfLoopHandleArc, selfLoopPath } from "./self-loop-geometry";

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

describe("selfLoopHandleArc", () => {
  /** A 200×60 card at (100, 200): its two handle points, top-to-bottom. */
  const topToBottom = {
    sourceX: 200,
    sourceY: 260,
    targetX: 200,
    targetY: 200,
    centerX: 200,
    centerY: 230,
    width: 200,
    height: 60,
  };

  it("starts on the source handle and ends on the target handle", () => {
    const { path } = selfLoopHandleArc(topToBottom, 28);
    expect(path).toMatch(/^M 200,260 C /);
    expect(path).toMatch(/ 200,200$/);
  });

  it("bulges past the card, not across it", () => {
    // The apex is the card's own half-width (100) plus the loop radius (28) clear of its
    // centre — the number a cubic actually reaches, which is 3/4 of its control reach and
    // not the control reach itself. Getting that factor wrong draws the loop ON the card.
    const { labelX, labelY } = selfLoopHandleArc(topToBottom, 28);
    expect(labelX).toBe(200 + 100 + 28);
    expect(labelY).toBe(230);
  });

  it("turns with the handles: a left-to-right node loops over its top, not its side", () => {
    // Same card, handles now on the right (source) and left (target).
    const { labelX, labelY } = selfLoopHandleArc(
      { ...topToBottom, sourceX: 300, sourceY: 230, targetX: 100, targetY: 230 },
      28,
    );
    // Half the card's HEIGHT (30) plus the radius, above the centre — no direction prop
    // was passed, and none exists: the bulge is derived from the handles themselves.
    expect(labelX).toBe(200);
    expect(labelY).toBe(230 - 30 - 28);
  });

  it("scales with loopRadius", () => {
    const small = selfLoopHandleArc(topToBottom, 28);
    const large = selfLoopHandleArc(topToBottom, 60);
    expect(large.labelX - 200).toBeGreaterThan(small.labelX - 200);
    expect(large.labelX).toBe(200 + 100 + 60);
  });

  it("never emits NaN — non-finite anchors fall back to 0, bad radii to the default", () => {
    const { path, labelX, labelY } = selfLoopHandleArc(
      {
        sourceX: Number.NaN,
        sourceY: Number.POSITIVE_INFINITY,
        targetX: Number.NaN,
        targetY: Number.NaN,
        centerX: Number.NaN,
        centerY: Number.NaN,
        width: Number.NaN,
        height: Number.NaN,
      },
      -5,
    );
    expect(path).not.toMatch(/NaN|Infinity/);
    expect(Number.isFinite(labelX)).toBe(true);
    expect(Number.isFinite(labelY)).toBe(true);
  });

  it("falls back to a downward normal when a handle sits on the node's centre", () => {
    const degenerate = selfLoopHandleArc(
      { ...topToBottom, sourceX: 200, sourceY: 230, targetX: 200, targetY: 230 },
      28,
    );
    expect(degenerate.path).not.toMatch(/NaN/);
  });
});
