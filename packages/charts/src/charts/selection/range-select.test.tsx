import { act, renderHook } from "@testing-library/react";
import { scaleBand, scaleLinear, scaleTime } from "d3-scale";
import { describe, expect, it, vi } from "vitest";
import { createGestureState, type GestureState } from "./gesture-machine";
import type { GestureAxis } from "./geometry";
import type { ChartMarkGeometry } from "./hit-test";
import {
  buildRangeAxisModel,
  clampRangeBand,
  defaultRangeBand,
  rangeBandFromPixels,
  rangeBandGesture,
  rangeBandToPixels,
  useRangeSelect,
} from "./range-select";
import { resolveSelectionIntent } from "./resolve-intent";
import type { ChartSelectionIntent } from "./types";
import { type EmitGestureInput, useChartGesture } from "./use-chart-gesture";

// Six regions; East and West share 118 — the measure rule must take both.
const REGIONS = [
  { region: "North", revenue: 42 },
  { region: "East", revenue: 118 },
  { region: "South", revenue: 67 },
  { region: "West", revenue: 118 },
  { region: "Central", revenue: 96 },
  { region: "Coast", revenue: 154 },
];
const band = scaleBand<string>()
  .domain(REGIONS.map((r) => r.region))
  .range([0, 600])
  .padding(0.2);
const y = scaleLinear().domain([0, 200]).range([200, 0]);
const xAxis: GestureAxis = { kind: "band", scale: band };
const yAxis: GestureAxis = { kind: "linear", scale: y };
const bars: ChartMarkGeometry[] = REGIONS.map((row, index) => ({
  id: `bar:${index}`,
  category: row.region,
  seriesKey: "revenue",
  datum: row,
  index,
  value: row.revenue,
  shape: {
    kind: "rect",
    x: band(row.region) as number,
    y: y(row.revenue),
    w: band.bandwidth(),
    h: 200 - y(row.revenue),
  },
  visible: true,
}));

const settled = (input: EmitGestureInput): GestureState => ({
  ...createGestureState("pointer"),
  activeMode: input.activeMode,
  phase: "committed",
  origin: input.origin,
  current: input.current,
  path: [input.origin, input.current],
  selectionMode: "replace",
});

describe("buildRangeAxisModel", () => {
  it("band: indices, one-category steps, category value text, not editable", () => {
    const model = buildRangeAxisModel(xAxis, "x", 600, { label: "region" });
    expect(model).toMatchObject({ kind: "band", min: 0, max: 5, step: 1, editable: false });
    expect(model.format(2)).toBe("South");
    expect(model.toData(5)).toBe("Coast");
    expect(model.fromPixel((band("West") as number) + 5)).toBe(3);
  });

  it("linear: the scale's extent, a tick step, rounded pixel values, editable", () => {
    const model = buildRangeAxisModel(yAxis, "y", 200, { label: "revenue", locale: "en-US" });
    expect(model).toMatchObject({ kind: "linear", min: 0, max: 200, editable: true });
    expect(model.step).toBe(20);
    expect(model.page).toBe(20);
    // A tick of 20 reads to whole units: a pointer value never shows float noise.
    expect(model.fromPixel(100.3)).toBe(100);
    expect(model.format(1200)).toBe("1,200");
  });

  it("time: whole days on a daily-or-coarser axis, formatted as dates", () => {
    const t = scaleTime()
      .domain([new Date(2024, 0, 1), new Date(2024, 11, 1)])
      .range([0, 330]);
    const model = buildRangeAxisModel({ kind: "time", scale: t }, "x", 330, {
      label: "month",
      locale: "en-US",
    });
    expect(model.kind).toBe("time");
    const snapped = new Date(model.fromPixel(95));
    expect(snapped.getHours()).toBe(0);
    expect(model.format(new Date(2024, 2, 1).getTime())).toBe("Mar 1, 2024");
    expect(model.toData(new Date(2024, 2, 1).getTime())).toBeInstanceOf(Date);
  });
});

describe("bands", () => {
  const xm = buildRangeAxisModel(xAxis, "x", 600, { label: "region" });
  const ym = buildRangeAxisModel(yAxis, "y", 200, { label: "revenue" });

  it("the keyboard default is the middle third", () => {
    expect(defaultRangeBand(xm)).toEqual({ axis: "x", lo: 2, hi: 3 });
    const d = defaultRangeBand(ym);
    expect(d).toEqual({ axis: "y", lo: 67, hi: 133 });
  });

  it("clamps and orders", () => {
    expect(clampRangeBand(ym, { axis: "y", lo: 250, hi: -4 })).toEqual({
      axis: "y",
      lo: 0,
      hi: 200,
    });
    expect(clampRangeBand(xm, { axis: "x", lo: 1.4, hi: 3.6 })).toEqual({
      axis: "x",
      lo: 1,
      hi: 4,
    });
  });

  it("pixels ↔ band: a band range takes the categories it overlaps", () => {
    const fromPx = rangeBandFromPixels(xm, [150, 350], xAxis);
    expect(fromPx).toEqual({ axis: "x", lo: 1, hi: 3 });
    const [a, b] = rangeBandToPixels(xm, fromPx as NonNullable<typeof fromPx>);
    expect(a).toBeCloseTo((band("East") as number) + 0.5);
    expect(b).toBeCloseTo((band("West") as number) + band.bandwidth() - 0.5);
  });

  it("a measure band resolves to the DIMENSION values in range — both 118s", () => {
    const input = rangeBandGesture(ym, { axis: "y", lo: 100, hi: 150 }, "keyboard");
    expect(input.rangeValues).toEqual([100, 150]);
    const intent = resolveSelectionIntent(settled(input), bars, {
      field: "region",
      xAxis,
      yAxis,
      of: "revenue",
      rangeValues: input.rangeValues,
      source: "keyboard",
    });
    expect(intent?.values).toEqual(["East", "West"]);
    expect(intent?.gesture).toEqual({
      kind: "range",
      axis: "y",
      from: 100,
      to: 150,
      of: "revenue",
    });
    expect(intent?.source).toBe("keyboard");
  });

  it("a band emitted on the dimension axis resolves to its categories", () => {
    const input = rangeBandGesture(xm, { axis: "x", lo: 2, hi: 4 }, "keyboard");
    const intent = resolveSelectionIntent(settled(input), bars, { field: "region", xAxis, yAxis });
    expect(intent?.values).toEqual(["South", "West", "Central"]);
    expect(intent?.gesture).toEqual({ kind: "range", axis: "x", from: "South", to: "Central" });
  });

  it("a row range with `yField` reports the rows (heatmap)", () => {
    const rows = scaleBand<string>().domain(["Mon", "Tue", "Wed"]).range([0, 90]);
    const cols = scaleBand<string>().domain(["08", "09"]).range([0, 60]);
    const cells: ChartMarkGeometry[] = ["Mon", "Tue", "Wed"].flatMap((day, r) =>
      ["08", "09"].map((hour, c) => ({
        id: `${hour}:${day}`,
        category: hour,
        crossCategory: day,
        datum: {},
        index: r * 2 + c,
        shape: {
          kind: "rect" as const,
          x: cols(hour) as number,
          y: rows(day) as number,
          w: 30,
          h: 30,
        },
        visible: true,
      })),
    );
    const ym2 = buildRangeAxisModel({ kind: "band", scale: rows }, "y", 90, { label: "day" });
    const input = rangeBandGesture(ym2, { axis: "y", lo: 1, hi: 2 }, "pointer");
    const intent = resolveSelectionIntent(settled(input), cells, {
      field: "hour",
      yField: "day",
      xAxis: { kind: "band", scale: cols },
      yAxis: { kind: "band", scale: rows },
    });
    expect(intent?.field).toBe("day");
    expect(intent?.values).toEqual(["Tue", "Wed"]);
    expect(intent?.datapoints).toHaveLength(4);
    expect(intent?.gesture).toEqual({ kind: "range", axis: "y", from: "Tue", to: "Wed" });
  });
});

describe("useRangeSelect", () => {
  function setup() {
    const onSelectionIntent = vi.fn<(intent: ChartSelectionIntent) => void>();
    const models = {
      x: buildRangeAxisModel(xAxis, "x", 600, { label: "region" }),
      y: buildRangeAxisModel(yAxis, "y", 200, { label: "revenue" }),
    };
    const hook = renderHook(() => {
      const gesture = useChartGesture({
        gestures: ["range"],
        field: "region",
        of: "revenue",
        xAxis,
        yAxis,
        getMarks: () => bars,
        onSelectionIntent,
        toPlotPoint: (cx, cy) => ({ x: cx, y: cy }),
      });
      const range = useRangeSelect({
        state: gesture.state,
        models,
        axes: { x: xAxis, y: yAxis },
        emitGesture: gesture.emitGesture,
      });
      return { gesture, range };
    });
    return { ...hook, onSelectionIntent };
  }

  it("a released gutter drag becomes the painted band", () => {
    const { result, onSelectionIntent } = setup();
    const pe = (x: number, yy: number) => ({
      clientX: x,
      clientY: yy,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      currentTarget: null,
    });
    act(() => {
      result.current.gesture.handlers.gutterX.onPointerDown(pe(150, 210));
      result.current.gesture.handlers.plot.onPointerMove(pe(350, 210));
      result.current.gesture.handlers.plot.onPointerUp(pe(350, 210));
    });
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    expect(result.current.range.band).toEqual({ axis: "x", lo: 1, hi: 3 });
  });

  it("keyboard: start paints without emitting; commit emits once; clear drops", () => {
    const { result, onSelectionIntent } = setup();
    act(() => result.current.range.startKeyboard("x"));
    expect(result.current.range).toMatchObject({ keyboardAxis: "x", band: { lo: 2, hi: 3 } });
    act(() => result.current.range.moveKeyboard({ axis: "x", lo: 0, hi: 3 }));
    expect(onSelectionIntent).not.toHaveBeenCalled();
    act(() => result.current.range.commitKeyboard());
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    expect(onSelectionIntent.mock.calls[0]?.[0]).toMatchObject({
      values: ["North", "East", "South", "West"],
      source: "keyboard",
      mode: "replace",
    });
    expect(result.current.range.keyboardAxis).toBeNull();
    act(() => result.current.range.clear());
    expect(result.current.range.band).toBeNull();
  });

  it("applyBand emits the exact typed bound", () => {
    const { result, onSelectionIntent } = setup();
    act(() => result.current.range.applyBand({ axis: "y", lo: 60, hi: 118 }, "keyboard"));
    expect(onSelectionIntent.mock.calls[0]?.[0]).toMatchObject({
      values: ["East", "South", "West", "Central"],
      gesture: { kind: "range", axis: "y", from: 60, to: 118, of: "revenue" },
    });
  });
});
