import { describe, expect, it } from "vitest";
import {
  resolveAxisTickTarget,
  tickTargetForHeight,
  tickTargetForWidth,
  X_TICK_TARGET_MAX,
  X_TICK_TARGET_MIN,
  Y_TICK_TARGET_SHORT,
  Y_TICK_TARGET_TALL,
} from "./tick-targets";

describe("tickTargetForWidth (RM-108)", () => {
  it("asks for about one tick per 90 px", () => {
    // 900 px LineChart − 80 px of margin = 820 px plot → 9 (River: 9 at 900).
    expect(tickTargetForWidth(820)).toBe(9);
    // 380 px − 80 px = 300 px plot → 3 (River: 4 at 380 — same 3–5 band).
    expect(tickTargetForWidth(300)).toBe(3);
    expect(tickTargetForWidth(450)).toBe(5);
  });

  it("clamps to 2–10", () => {
    expect(tickTargetForWidth(40)).toBe(X_TICK_TARGET_MIN);
    expect(tickTargetForWidth(4000)).toBe(X_TICK_TARGET_MAX);
  });

  it("falls back to the minimum for a degenerate width", () => {
    expect(tickTargetForWidth(0)).toBe(X_TICK_TARGET_MIN);
    expect(tickTargetForWidth(Number.NaN)).toBe(X_TICK_TARGET_MIN);
    expect(tickTargetForWidth(-10)).toBe(X_TICK_TARGET_MIN);
  });
});

describe("tickTargetForHeight (RM-108)", () => {
  it("is 3 under 200 px and 5 otherwise", () => {
    expect(tickTargetForHeight(120)).toBe(Y_TICK_TARGET_SHORT);
    expect(tickTargetForHeight(199)).toBe(Y_TICK_TARGET_SHORT);
    expect(tickTargetForHeight(200)).toBe(Y_TICK_TARGET_TALL);
    expect(tickTargetForHeight(400)).toBe(Y_TICK_TARGET_TALL);
  });

  it("keeps the historical 5 for a non-finite height", () => {
    expect(tickTargetForHeight(Number.NaN)).toBe(Y_TICK_TARGET_TALL);
  });
});

describe("resolveAxisTickTarget (RM-108)", () => {
  it("numTicks > numeric tickCount > auto", () => {
    expect(resolveAxisTickTarget({ numTicks: 5, tickCount: 7, autoTarget: 9 })).toBe(5);
    expect(resolveAxisTickTarget({ tickCount: 7, autoTarget: 9 })).toBe(7);
    expect(resolveAxisTickTarget({ tickCount: "auto", autoTarget: 9 })).toBe(9);
    expect(resolveAxisTickTarget({ autoTarget: 3 })).toBe(3);
  });

  it("ignores a non-finite explicit value", () => {
    expect(resolveAxisTickTarget({ numTicks: Number.NaN, autoTarget: 4 })).toBe(4);
  });
});
