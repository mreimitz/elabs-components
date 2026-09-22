import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { scaleBand, scaleLinear } from "d3-scale";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRangeAxisModel, type RangeAxisModel, type RangeBand } from "./range-select";
import { rangeBandForKey, rangeThumbBounds, RangeThumbs } from "./range-thumbs";

afterEach(cleanup);

const categories = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const bandX = buildRangeAxisModel(
  { kind: "band", scale: scaleBand<string>().domain(categories).range([0, 500]) },
  "x",
  500,
  { label: "letter" },
);
const bandY = buildRangeAxisModel(
  { kind: "band", scale: scaleBand<string>().domain(categories).range([0, 500]) },
  "y",
  500,
  { label: "letter" },
);
const valueY = buildRangeAxisModel(
  { kind: "linear", scale: scaleLinear().domain([0, 100]).range([200, 0]) },
  "y",
  200,
  { label: "revenue", locale: "en-US" },
);

describe("rangeBandForKey (APG multi-thumb slider)", () => {
  const b: RangeBand = { axis: "x", lo: 3, hi: 6 };
  it("arrows ±1 step, Shift ×10, clamped by the other thumb and the axis", () => {
    expect(rangeBandForKey("ArrowRight", false, "lo", b, bandX)).toEqual({
      axis: "x",
      lo: 4,
      hi: 6,
    });
    expect(rangeBandForKey("ArrowLeft", false, "lo", b, bandX)).toEqual({
      axis: "x",
      lo: 2,
      hi: 6,
    });
    expect(rangeBandForKey("ArrowRight", true, "lo", b, bandX)).toEqual({
      axis: "x",
      lo: 6,
      hi: 6,
    });
    expect(rangeBandForKey("ArrowRight", true, "hi", b, bandX)).toEqual({
      axis: "x",
      lo: 3,
      hi: 9,
    });
  });
  it("Home / End go to the thumb's own min / max", () => {
    expect(rangeBandForKey("Home", false, "lo", b, bandX)?.lo).toBe(0);
    expect(rangeBandForKey("End", false, "lo", b, bandX)?.lo).toBe(6);
    expect(rangeBandForKey("Home", false, "hi", b, bandX)?.hi).toBe(3);
    expect(rangeBandForKey("End", false, "hi", b, bandX)?.hi).toBe(9);
    expect(rangeThumbBounds("lo", b, bandX)).toEqual([0, 6]);
  });
  it("PageUp / PageDown move 10 % of the axis", () => {
    const v: RangeBand = { axis: "y", lo: 20, hi: 80 };
    expect(rangeBandForKey("PageUp", false, "lo", v, valueY)?.lo).toBe(30);
    expect(rangeBandForKey("PageDown", false, "hi", v, valueY)?.hi).toBe(70);
  });
  it("Up grows a value axis but walks DOWN a category y axis", () => {
    expect(rangeBandForKey("ArrowUp", false, "lo", { axis: "y", lo: 20, hi: 80 }, valueY)?.lo).toBe(
      30,
    );
    expect(rangeBandForKey("ArrowUp", false, "hi", { axis: "y", lo: 2, hi: 5 }, bandY)?.hi).toBe(4);
    expect(rangeBandForKey("ArrowDown", false, "hi", { axis: "y", lo: 2, hi: 5 }, bandY)?.hi).toBe(
      6,
    );
  });
  it("ignores other keys", () => {
    expect(rangeBandForKey("a", false, "lo", b, bandX)).toBeNull();
  });
});

function Harness({
  model,
  onCommit,
  onCancel,
}: {
  model: RangeAxisModel;
  onCommit: (band: RangeBand) => void;
  onCancel: () => void;
}) {
  const [band, setBand] = useState<RangeBand | null>(null);
  const [active, setActive] = useState(false);
  return (
    <div>
      <RangeThumbs
        active={active}
        band={band}
        gutter={{ bottom: 30, left: 40 }}
        innerHeight={200}
        innerWidth={500}
        model={model}
        offset={{ left: 40, top: 10 }}
        onCancel={() => {
          setActive(false);
          setBand(null);
          onCancel();
        }}
        onChange={setBand}
        onCommit={() => {
          setActive(false);
          if (band) onCommit(band);
        }}
        onStart={() => {
          setBand({ axis: model.axis, lo: 3, hi: 6 });
          setActive(true);
        }}
      />
    </div>
  );
}

describe("RangeThumbs", () => {
  it("button → thumbs (start focused) → arrows → Enter commits, focus returns", () => {
    const onCommit = vi.fn();
    render(<Harness model={bandX} onCancel={vi.fn()} onCommit={onCommit} />);
    const trigger = screen.getByRole("button", { name: "Select a range on the X axis" });
    act(() => trigger.click());
    const start = screen.getByRole("slider", { name: "Range start, letter" });
    const end = screen.getByRole("slider", { name: "Range end, letter" });
    expect(start).toHaveFocus();
    expect(start).toHaveAttribute("aria-valuetext", "D");
    expect(start).toHaveAttribute("aria-valuemin", "0");
    expect(start).toHaveAttribute("aria-valuemax", "6");
    expect(end).toHaveAttribute("aria-valuetext", "G");
    expect(screen.getByRole("group", { name: "Range on the X axis, letter" })).toBeTruthy();
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(start).toHaveAttribute("aria-valuetext", "E");
    fireEvent.keyDown(end, { key: "End" });
    expect(end).toHaveAttribute("aria-valuetext", "J");
    fireEvent.keyDown(end, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith({ axis: "x", lo: 4, hi: 9 });
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getByRole("button", { name: "Select a range on the X axis" })).toHaveFocus();
  });

  it("Esc cancels without committing", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<Harness model={valueY} onCancel={onCancel} onCommit={onCommit} />);
    act(() => screen.getByRole("button", { name: "Select a range on the Y axis" }).click());
    const start = screen.getByRole("slider", { name: "Range start, revenue" });
    expect(start).toHaveAttribute("aria-valuetext", "3");
    expect(start).toHaveAttribute("aria-orientation", "vertical");
    fireEvent.keyDown(start, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
