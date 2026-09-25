import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  FLOW_DEFAULT_NODE_SIZE,
  HANDLE_SIDES,
  flowNodeSize,
  positionToSide,
  sideToPosition,
} from "./flow-geometry";

describe("side ↔ Position", () => {
  it("round-trips every side", () => {
    for (const side of HANDLE_SIDES) expect(positionToSide[sideToPosition[side]]).toBe(side);
  });

  it("maps each side to its React Flow Position", () => {
    expect(sideToPosition.left).toBe(Position.Left);
    expect(positionToSide[Position.Bottom]).toBe("bottom");
  });
});

describe("flowNodeSize", () => {
  it("prefers the measured box", () => {
    expect(flowNodeSize({ measured: { width: 200, height: 60 }, width: 10, height: 10 })).toEqual({
      width: 200,
      height: 60,
    });
  });

  it("falls back to the explicit width/height", () => {
    expect(flowNodeSize({ width: 120, height: 30 })).toEqual({ width: 120, height: 30 });
  });

  it("falls back to React Flow's default node box", () => {
    expect(flowNodeSize({})).toEqual(FLOW_DEFAULT_NODE_SIZE);
    expect(FLOW_DEFAULT_NODE_SIZE).toEqual({ width: 172, height: 40 });
  });

  it("takes a caller's fallback, so geometry can refuse to invent a box", () => {
    expect(flowNodeSize({ measured: { width: 90 } }, { width: 0, height: 0 })).toEqual({
      width: 90,
      height: 0,
    });
  });
});
