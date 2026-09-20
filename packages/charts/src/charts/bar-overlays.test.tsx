import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  BarComparisonLabels,
  BarComparisonLayer,
  type BarLayerGeometry,
  type BarOverlay,
  BarOverlayLayer,
  BarTrackLayer,
  buildBarLegendItems,
  collectOverlayExtent,
} from "./bar-overlays";
import { BAR_GROUP_HEADER_KEY } from "./bar-groups";

afterEach(cleanup);

const rows = [
  { name: "A", avg: 50, lo90: 20, hi90: 80, lo50: 40, hi50: 60, v: 55, prev: 40 },
  { name: "B", avg: 30, lo90: 10, hi90: 45, lo50: 25, hi50: 35, v: 20, prev: 35 },
];

const overlays: BarOverlay[] = [
  { kind: "range", lowKey: "lo90", highKey: "hi90", label: "90 %" },
  { kind: "range", lowKey: "lo50", highKey: "hi50", label: "50 %", pattern: "stripes" },
  { kind: "value", key: "avg", label: "Average" },
];

/** Horizontal geometry: bands 20px apart, 1 value unit = 2px. */
function geometry(
  data: readonly Record<string, unknown>[] = rows,
  isHorizontal = true,
): BarLayerGeometry {
  return {
    rows: data,
    bandOf: (row) => (row.name === "A" ? 0 : 20),
    rowKey: (row) => String(row.name),
    bandWidth: 16,
    valueScale: (value) => (isHorizontal ? value * 2 : 200 - value * 2),
    isHorizontal,
  };
}

function inSvg(node: React.ReactNode) {
  return render(<svg>{node}</svg>);
}

describe("collectOverlayExtent", () => {
  it("reaches every overlay and comparison column, zero-including", () => {
    expect(collectOverlayExtent(rows, overlays, { key: "prev" })).toEqual({ min: 0, max: 80 });
    expect(collectOverlayExtent([{ x: -5 }], [{ kind: "value", key: "x" }], undefined)).toEqual({
      min: -5,
      max: 0,
    });
  });
});

describe("buildBarLegendItems", () => {
  it("lists series, the comparison column and every overlay in order", () => {
    const items = buildBarLegendItems({
      lines: [{ dataKey: "v", stroke: "var(--chart-1)", strokeWidth: 0 }],
      comparison: { key: "prev", label: "2024" },
      overlays,
    });
    expect(items.map((i) => [i.kind, i.label])).toEqual([
      ["series", "v"],
      ["comparison", "2024"],
      ["overlay", "90 %"],
      ["overlay", "50 %"],
      ["overlay", "Average"],
    ]);
    expect(items.filter((i) => i.kind === "overlay").map((i) => i.marker)).toEqual([
      "range",
      "range",
      "tick",
    ]);
    expect(items[3]?.pattern).toBe("stripes");
    // Range overlays step light → dark on the neutral ladder.
    expect(items[2]?.color).toBe("var(--chart-mono-2)");
    expect(items[3]?.color).toBe("var(--chart-mono-4)");
  });

  it("a colour key replaces the per-series entries", () => {
    const items = buildBarLegendItems({
      lines: [{ dataKey: "v", stroke: "var(--chart-1)", strokeWidth: 0 }],
      colorKey: [{ key: "North", label: "North", color: "var(--chart-1)" }],
    });
    expect(items).toEqual([
      expect.objectContaining({ kind: "color", label: "North", color: "var(--chart-1)" }),
    ]);
  });
});

describe("BarOverlayLayer", () => {
  it("paints one layer per overlay and one mark per row, in value space", () => {
    const { container } = inSvg(<BarOverlayLayer {...geometry()} overlays={overlays} />);
    const layers = container.querySelectorAll('[data-slot="bar-chart-overlay"]');
    expect(layers).toHaveLength(3);
    const firstRange = layers[0]?.querySelectorAll("rect") ?? [];
    expect(firstRange).toHaveLength(2);
    expect(firstRange[0]?.getAttribute("x")).toBe("40");
    expect(firstRange[0]?.getAttribute("width")).toBe("120");
    // Stripes draw through a pattern, not a flat ink.
    expect(layers[1]?.querySelector("pattern")).not.toBeNull();
    expect(layers[1]?.querySelectorAll("rect[fill^='url(']")).toHaveLength(2);
    // The value tick is centred on the value (2px wide).
    const tick = layers[2]?.querySelector("rect");
    expect(tick?.getAttribute("x")).toBe("99");
  });

  it("skips group header rows", () => {
    const withHeader = [{ name: "H", [BAR_GROUP_HEADER_KEY]: "G" }, ...rows];
    const { container } = inSvg(
      <BarOverlayLayer {...geometry(withHeader)} overlays={[overlays[2] as BarOverlay]} />,
    );
    expect(container.querySelectorAll('[data-slot="bar-chart-overlay"] rect')).toHaveLength(2);
  });
});

describe("BarTrackLayer / BarComparisonLayer", () => {
  it("track runs from 0 to the axis maximum for every row", () => {
    const { container } = inSvg(<BarTrackLayer {...geometry()} max={100} />);
    const rects = container.querySelectorAll('[data-slot="bar-chart-track"] rect');
    expect(rects).toHaveLength(2);
    expect(rects[0]?.getAttribute("width")).toBe("200");
    expect(rects[0]?.getAttribute("fill")).toBe("var(--chart-mono-2)");
  });

  it("track takes a caller's ink — a surface tone when the track should read as paper", () => {
    const { container } = inSvg(
      <BarTrackLayer {...geometry()} fill="var(--chart-segment-background)" max={100} />,
    );
    const rects = container.querySelectorAll('[data-slot="bar-chart-track"] rect');
    expect(rects[0]?.getAttribute("fill")).toBe("var(--chart-segment-background)");
    expect(rects[0]?.getAttribute("width")).toBe("200");
  });

  it("comparison paints a muted full-band column per row", () => {
    const { container } = inSvg(
      <BarComparisonLayer {...geometry(rows, false)} comparison={{ key: "prev" }} />,
    );
    const rects = container.querySelectorAll('[data-slot="bar-chart-comparison"] rect');
    expect(rects).toHaveLength(2);
    expect(rects[0]?.getAttribute("height")).toBe("80");
    expect(rects[0]?.getAttribute("width")).toBe("16");
  });

  it("difference labels are signed with + and the U+2212 minus", () => {
    const { container } = inSvg(
      <BarComparisonLabels
        {...geometry(rows, false)}
        comparison={{ key: "prev" }}
        mainKey="v"
        mode="difference"
      />,
    );
    const labels = [...container.querySelectorAll('[data-slot="bar-chart-comparison-label"]')].map(
      (node) => node.textContent,
    );
    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatch(/^\+15/);
    expect(labels[1]).toMatch(/^−15/);
  });
});
