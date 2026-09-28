/**
 * arc-chart-context.test.ts — the one geometry helper `PieChart` and
 * `RingChart`'s drill-down targets share (RM-204 fix round, leftover item):
 * a point at a given angle on an arc's MIDPOINT radius, in the arc's own SVG
 * coordinate space.
 *
 * The load-bearing property is PARITY: `pieDatapointTarget` and
 * `ringDatapointTarget` must place their hit box at the exact same (x, y) for
 * the same geometry + angle, because they both delegate to `arcMidpointPoint`
 * — a mutation that makes either family compute its own midpoint math again
 * must fail this file.
 */
import { describe, expect, it } from "vitest";
import { arcMidpointPoint } from "./arc-chart-context";
import { padDatapointRect } from "./chart-datapoint-layer";
import { pieDatapointTarget, type PieArcData } from "./pie-context";
import { ringDatapointTarget, type RingData } from "./ring-context";

/** A zero-size hit box at `x, y`, padded the same way both targets are. */
function padded(point: { x: number; y: number }) {
  return padDatapointRect({ x: point.x, y: point.y, width: 0, height: 0 });
}

describe("arcMidpointPoint", () => {
  it("sits halfway between innerRadius and outerRadius", () => {
    const geometry = { center: 100, innerRadius: 40, outerRadius: 60 };
    // 0 rad is 12 o'clock: straight up from center, so x is unchanged and y
    // moves up (decreases) by exactly the midpoint radius (50).
    expect(arcMidpointPoint(geometry, 0)).toEqual({ x: 100, y: 50 });
  });

  it("goes clockwise from 12 o'clock (d3-shape's convention)", () => {
    const geometry = { center: 0, innerRadius: 10, outerRadius: 10 };
    // A quarter turn clockwise from 12 o'clock is 3 o'clock: +x, unchanged y.
    const quarterTurn = arcMidpointPoint(geometry, Math.PI / 2);
    expect(quarterTurn.x).toBeCloseTo(10, 10);
    expect(quarterTurn.y).toBeCloseTo(0, 10);
  });

  it("scales with the midpoint radius, not the inner or outer radius alone", () => {
    const wide = arcMidpointPoint({ center: 0, innerRadius: 0, outerRadius: 100 }, 0);
    const narrow = arcMidpointPoint({ center: 0, innerRadius: 40, outerRadius: 60 }, 0);
    // Both have a midpoint radius of 50.
    expect(wide).toEqual(narrow);
  });
});

describe("pieDatapointTarget / ringDatapointTarget share arcMidpointPoint (parity)", () => {
  const geometry = { center: 120, innerRadius: 30, outerRadius: 90 };

  it("a pie slice's hit box lands exactly on arcMidpointPoint at the slice's midAngle", () => {
    const arc: PieArcData = {
      data: { label: "A", value: 10 },
      index: 0,
      startAngle: 0.2,
      endAngle: 0.8,
      padAngle: 0,
      value: 10,
    };
    const target = pieDatapointTarget(arc, geometry);
    const expected = padded(arcMidpointPoint(geometry, (arc.startAngle + arc.endAngle) / 2));
    expect(target.rect.x).toBeCloseTo(expected.x, 10);
    expect(target.rect.y).toBeCloseTo(expected.y, 10);
  });

  it("a ring's hit box lands exactly on arcMidpointPoint at startAngle + 0.35", () => {
    const ring: RingData = { label: "B", value: 5, maxValue: 10 };
    const ringGeometry = { ...geometry, startAngle: 1.1 };
    const target = ringDatapointTarget(0, ring, ringGeometry);
    const expected = padded(arcMidpointPoint(ringGeometry, ringGeometry.startAngle + 0.35));
    expect(target.rect.x).toBeCloseTo(expected.x, 10);
    expect(target.rect.y).toBeCloseTo(expected.y, 10);
  });

  it("the same geometry + angle places a pie slice and a ring target at the same point", () => {
    const angle = 0.5;
    const arc: PieArcData = {
      data: { label: "A", value: 10 },
      index: 0,
      startAngle: angle,
      endAngle: angle,
      padAngle: 0,
      value: 10,
    };
    const ring: RingData = { label: "A", value: 10, maxValue: 10 };
    const ringGeometry = { ...geometry, startAngle: angle - 0.35 };
    const pieTarget = pieDatapointTarget(arc, geometry);
    const ringTarget = ringDatapointTarget(0, ring, ringGeometry);
    expect(ringTarget.rect.x).toBeCloseTo(pieTarget.rect.x, 10);
    expect(ringTarget.rect.y).toBeCloseTo(pieTarget.rect.y, 10);
  });
});
