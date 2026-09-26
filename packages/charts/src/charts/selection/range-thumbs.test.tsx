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
  it("clampBothEnds: false never inverts the band, even when the untouched edge is already outside the view (review fix4)", () => {
    // `valueY`'s view is `[0, 100]`; this band is entirely below it — as if a
    // pan/zoom narrowed the view after the band was set. For "lo",
    // `rangeThumbBounds` returns `[model.min, band.hi]` = `[0, -20]`, an
    // INVERTED range, so `Math.max(min, Math.min(max, next))` resolves to
    // `0` no matter what key was pressed or which way it points. Without the
    // extra clamp against `band.hi` itself, this would return `{ lo: 0, hi:
    // -20 }` for a caller's `commitRange` to silently re-sort into
    // `[-20, 0]` — moving the untouched "hi" edge from `-20` to `0`.
    const outOfView: RangeBand = { axis: "y", lo: -40, hi: -20 };
    const moved = rangeBandForKey("ArrowRight", false, "lo", outOfView, valueY, false);
    expect(moved).toEqual({ axis: "y", lo: -20, hi: -20 });
    expect(moved!.lo).toBeLessThanOrEqual(moved!.hi);
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

describe('RangeThumbs mode="immediate" (RM-185 fix2/fix3, DensityScatterChart)', () => {
  function renderImmediate(
    onCommit: (band?: RangeBand) => void,
    onCancel: () => void,
    band: RangeBand = { axis: "x", lo: 3, hi: 6 },
    model: RangeAxisModel = bandX,
  ) {
    // A real ancestor `onKeyDown` — proves an immediate thumb's own Escape
    // stops there rather than bubbling to a chart root's own handler.
    const rootKeyDown = vi.fn();
    const utils = render(
      <div onKeyDown={rootKeyDown}>
        <RangeThumbs
          active
          band={band}
          gutter={{ bottom: 30, left: 40 }}
          innerHeight={200}
          innerWidth={500}
          mode="immediate"
          model={model}
          offset={{ left: 40, top: 10 }}
          onCancel={onCancel}
          onCommit={onCommit}
        />
      </div>,
    );
    return { ...utils, rootKeyDown };
  }

  it("renders no trigger button — the thumbs are always live", () => {
    renderImmediate(vi.fn(), vi.fn());
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("slider")).toHaveLength(2);
  });

  it("clamps an x thumb at its own axis extreme clear of the y-gutter and the plot's far edge (review fix4)", () => {
    // `lo`'s own min (category "A") sits at pixel 0.5 — unclamped that's
    // `left: 28.5`, 11.5 px into the y-gutter's own thumb column (which
    // starts at `offset.left - GUTTER_INSET - boundWidth`, i.e. well left of
    // 38). `hi`'s own max (category "J") sits at pixel 499.5 — unclamped
    // that's `left: 527.5`, past `innerWidth`'s far side with no margin for
    // the focus ring.
    renderImmediate(vi.fn(), vi.fn(), { axis: "x", lo: 0, hi: 9 });
    const start = screen.getByRole("slider", { name: "Range start, letter" });
    const end = screen.getByRole("slider", { name: "Range end, letter" });
    expect(start.style.left).toBe("38px");
    expect(end.style.left).toBe("518px");
  });

  it("clamps a y thumb at its own axis extreme clear of the root's top edge and the x-gutter (review fix4)", () => {
    // Same two pixels (0.5 / 499.5) on the y axis: unclamped, `lo` would sit
    // at `top: -1.5` (above the root's own `0`, no room for the focus ring)
    // and `hi` at `top: 497.5` (well into the x-gutter, the x thumbs' own row).
    renderImmediate(vi.fn(), vi.fn(), { axis: "y", lo: 0, hi: 9 }, bandY);
    const start = screen.getByRole("slider", { name: "Range start, letter" });
    const end = screen.getByRole("slider", { name: "Range end, letter" });
    expect(start.style.top).toBe("2px");
    expect(end.style.top).toBe("186px");
  });

  it("every arrow/Home/End/PageUp/PageDown key commits the band directly", () => {
    // `band` is a static prop here (this harness has no state), so each key
    // press is judged against the SAME starting band ({ lo: 3, hi: 6 }) — the
    // point is that a single key press commits immediately, not that the
    // widget accumulates state on its own (the real caller re-renders it with
    // the committed band, `density-scatter-chart.test.tsx` covers that).
    const onCommit = vi.fn();
    renderImmediate(onCommit, vi.fn());
    const start = screen.getByRole("slider", { name: "Range start, letter" });
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(onCommit).toHaveBeenLastCalledWith({ axis: "x", lo: 4, hi: 6 });
    fireEvent.keyDown(start, { key: "Home" });
    expect(onCommit).toHaveBeenLastCalledWith({ axis: "x", lo: 0, hi: 6 });
    const end = screen.getByRole("slider", { name: "Range end, letter" });
    fireEvent.keyDown(end, { key: "End" });
    expect(onCommit).toHaveBeenLastCalledWith({ axis: "x", lo: 3, hi: 9 });
    fireEvent.keyDown(end, { key: "PageDown" });
    // `bandX`'s page is 1 category (10 categories / 10): hi 6 → 5 — only the
    // moved edge changes, the static `lo: 3` passes through unclamped.
    expect(onCommit).toHaveBeenLastCalledWith({ axis: "x", lo: 3, hi: 5 });
  });

  it("passes the untouched edge through even when it's now outside the axis — `clampBothEnds: false` (review fix4)", () => {
    // A band from BEFORE a pan/zoom narrowed the view: neither `-5` nor `15`
    // is inside `bandX`'s current `[0, 9]` any more. The existing
    // "every key commits" test above starts from `{ lo: 3, hi: 6 }` — both
    // already inside `[0, 9]` — so flipping `rangeBandForKey`'s
    // `clampBothEnds` argument back to its `true` default at this call site
    // would still pass it. Only a band outside the view catches that: moving
    // "lo" must leave the untouched "hi" at its own `15`, not pull it back to
    // `bandX.max` (`9`) the way a fresh `clampRangeBand` normalisation would.
    const onCommit = vi.fn();
    renderImmediate(onCommit, vi.fn(), { axis: "x", lo: -5, hi: 15 });
    const start = screen.getByRole("slider", { name: "Range start, letter" });
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(onCommit).toHaveBeenCalledWith({ axis: "x", lo: 0, hi: 15 });
  });

  it("Escape cancels and does not reach an ancestor's own keydown handler", () => {
    const onCancel = vi.fn();
    const { rootKeyDown } = renderImmediate(vi.fn(), onCancel);
    const start = screen.getByRole("slider", { name: "Range start, letter" });
    fireEvent.keyDown(start, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(rootKeyDown).not.toHaveBeenCalled();
  });

  it("Enter and Space are no-ops — there is no draft to arm or confirm", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    renderImmediate(onCommit, onCancel);
    const start = screen.getByRole("slider", { name: "Range start, letter" });
    fireEvent.keyDown(start, { key: "Enter" });
    fireEvent.keyDown(start, { key: " " });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("blur does not cancel — there is nothing to abandon (review fix4)", () => {
    const onCancel = vi.fn();
    renderImmediate(vi.fn(), onCancel);
    const start = screen.getByRole("slider", { name: "Range start, letter" });
    // `relatedTarget` set to something OUTSIDE the pair — `fireEvent.blur`'s
    // own default (`relatedTarget: null`) would pass here even with
    // `"explicit"` mode's own blur-cancel handler wired up by mistake: that
    // handler's `if (to === null) return;` ignores a `null` relatedTarget
    // too, so a dropped `immediate ? undefined : ...` guard wouldn't be
    // caught by the default. `document.body` is.
    fireEvent.blur(start, { relatedTarget: document.body });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
