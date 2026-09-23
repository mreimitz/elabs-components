import { scaleBand, scaleLinear, scaleTime } from "d3-scale";
import { describe, expect, it } from "vitest";
import {
  createGestureState,
  type GestureEvent,
  type GestureState,
  gestureReducer,
  NO_MODIFIERS,
} from "./gesture-machine";
import type { GestureAxis } from "./geometry";
import type { ChartMarkGeometry } from "./hit-test";
import { distinctCategories, resolveSelectionIntent, toChartDatapoint } from "./resolve-intent";

// A 6-category vertical bar chart: bands over x 0..600, values on y 0..100 → 200..0 px.
const categories = ["A", "B", "C", "D", "E", "F"];
const values = [10, 80, 45, 60, 20, 95];
const band = scaleBand<string>().domain(categories).range([0, 600]).padding(0.2);
const y = scaleLinear().domain([0, 100]).range([200, 0]);
const rows = categories.map((name, i) => ({ name, sales: values[i] }));
const bars: ChartMarkGeometry[] = rows.map((row, index) => {
  const top = y(row.sales as number);
  return {
    id: `bar:sales:${index}`,
    category: row.name,
    seriesKey: "sales",
    datum: row,
    index,
    value: row.sales,
    shape: { kind: "rect", x: band(row.name) as number, y: top, w: band.bandwidth(), h: 200 - top },
    visible: true,
  };
});
const xAxis: GestureAxis = { kind: "band", scale: band };
const yAxis: GestureAxis = { kind: "linear", scale: y };

function gesture(mode: GestureState["mode"], events: GestureEvent[], confirm?: "explicit") {
  return events.reduce(gestureReducer, createGestureState(mode, confirm));
}
const down = (
  x: number,
  yy: number,
  modifiers = NO_MODIFIERS,
  region: "plot" | "gutter-x" | "gutter-y" = "plot",
): GestureEvent => ({
  type: "pointerDown",
  point: { x, y: yy },
  modifiers,
  region,
});
const move = (x: number, yy: number): GestureEvent => ({
  type: "pointerMove",
  point: { x, y: yy },
});
const up = (x: number, yy: number): GestureEvent => ({ type: "pointerUp", point: { x, y: yy } });

describe("resolveSelectionIntent", () => {
  it("rect → distinct categories, replace, geometry in data units", () => {
    const state = gesture("rect", [down(110, 0), move(390, 190), up(390, 190)]);
    const intent = resolveSelectionIntent(state, bars, { field: "name", xAxis, yAxis });
    expect(intent?.field).toBe("name");
    expect(intent?.values).toEqual(["B", "C", "D"]);
    expect(intent?.mode).toBe("replace");
    expect(intent?.gesture).toEqual({
      kind: "rect",
      x: ["B", "D"],
      y: [expect.closeTo(5, 9), expect.closeTo(100, 9)],
    });
    expect(intent?.datapoints.map((d) => d.category)).toEqual(["B", "C", "D"]);
    expect(intent?.source).toBe("pointer");
  });

  it("Shift → add, Ctrl/Cmd → toggle", () => {
    const add = gesture("rect", [
      down(110, 0, { shift: true, ctrlOrMeta: false }),
      move(390, 190),
      up(390, 190),
    ]);
    expect(resolveSelectionIntent(add, bars, { field: "name", xAxis, yAxis })?.mode).toBe("add");
    const toggle = gesture("rect", [
      down(110, 0, { shift: false, ctrlOrMeta: true }),
      move(390, 190),
      up(390, 190),
    ]);
    expect(resolveSelectionIntent(toggle, bars, { field: "name", xAxis, yAxis })?.mode).toBe(
      "toggle",
    );
  });

  it("a measure-axis range yields the DIMENSION values whose measure is in range (the associative BI suite)", () => {
    // y pixels 0..120 ↔ values 40..100: B (80), C (45), D (60), F (95).
    const state = gesture("rect", [down(0, 120, NO_MODIFIERS, "gutter-y"), move(0, 0), up(0, 0)]);
    const intent = resolveSelectionIntent(state, bars, { field: "name", xAxis, yAxis });
    expect(intent?.values).toEqual(["B", "C", "D", "F"]);
    expect(intent?.gesture).toEqual({ kind: "range", axis: "y", from: 40, to: 100 });
  });

  it("an x range on a band axis selects the overlapped categories", () => {
    const state = gesture("range-x", [down(150, 100), move(350, 100), up(350, 100)]);
    const intent = resolveSelectionIntent(state, bars, { field: "name", xAxis, yAxis });
    expect(intent?.values).toEqual(["B", "C", "D"]);
    expect(intent?.gesture).toEqual({ kind: "range", axis: "x", from: "B", to: "D" });
  });

  it("a time-axis range selects hidden points too; a lasso does not", () => {
    const t = scaleTime()
      .domain([new Date(2024, 0, 1), new Date(2024, 0, 11)])
      .range([0, 100]);
    const pts: ChartMarkGeometry[] = [0, 2, 4].map((day, index) => ({
      id: `p${index}`,
      category: new Date(2024, 0, 1 + day),
      datum: {},
      index,
      value: 1,
      shape: { kind: "point", x: day * 10, y: 50 },
      visible: index !== 1,
    }));
    const range = gesture("range-x", [down(0, 50), move(45, 50), up(45, 50)]);
    const tAxis: GestureAxis = { kind: "time", scale: t };
    expect(
      resolveSelectionIntent(range, pts, { field: "date", xAxis: tAxis })?.values,
    ).toHaveLength(3);
    const lasso = gesture("lasso", [
      down(-5, 40),
      move(45, 40),
      move(45, 60),
      move(-5, 60),
      up(-4, 42),
    ]);
    expect(resolveSelectionIntent(lasso, pts, { field: "date", xAxis: tAxis })?.values).toEqual([
      new Date(2024, 0, 1),
      new Date(2024, 0, 5),
    ]);
  });

  it("a click hits the one bar under the pointer", () => {
    const state = gesture("rect", [down(250, 150), up(251, 150)]);
    const intent = resolveSelectionIntent(state, bars, { field: "name", xAxis, yAxis });
    expect(intent?.values).toEqual(["C"]);
    expect(intent?.gesture).toEqual({ kind: "click", category: "C", seriesKey: "sales" });
  });

  it("explicit confirm: a plain click toggles", () => {
    const state = gesture("rect", [down(250, 150), up(250, 150)], "explicit");
    expect(state.phase).toBe("provisional");
    expect(resolveSelectionIntent(state, bars, { field: "name", xAxis, yAxis })?.mode).toBe(
      "toggle",
    );
  });

  it("returns null when nothing is hit or the gesture is not settled", () => {
    const empty = gesture("rect", [down(0, 0), move(5, 5), up(9, 9)]);
    expect(resolveSelectionIntent(empty, bars, { field: "name", xAxis, yAxis })).toBeNull();
    const armed = gesture("rect", [down(250, 150)]);
    expect(resolveSelectionIntent(armed, bars, { field: "name" })).toBeNull();
  });

  it("without an invertible x axis a rect reports its span from the hit categories", () => {
    const state = gesture("rect", [down(110, 0), move(390, 190), up(390, 190)]);
    const intent = resolveSelectionIntent(state, bars, { field: "name", yAxis });
    expect(intent?.gesture).toMatchObject({ kind: "rect", x: ["B", "D"] });
  });
});

describe("helpers", () => {
  it("distinctCategories dedupes Dates by time, keeps data order", () => {
    const d = (i: number, c: Date): ChartMarkGeometry => ({
      id: String(i),
      category: c,
      datum: {},
      index: i,
      shape: { kind: "point", x: 0, y: 0 },
      visible: true,
    });
    expect(
      distinctCategories([d(2, new Date(5)), d(0, new Date(1)), d(1, new Date(1))]).map((v) =>
        (v as Date).getTime(),
      ),
    ).toEqual([1, 5]);
  });

  it("toChartDatapoint uses the ChartDatapoint shape", () => {
    expect(toChartDatapoint(bars[1] as ChartMarkGeometry, "keyboard", () => "Sales")).toEqual({
      datum: rows[1],
      index: 1,
      seriesKey: "sales",
      seriesLabel: "Sales",
      value: 80,
      category: "B",
      source: "keyboard",
    });
  });
});
