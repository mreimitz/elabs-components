import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  anyPieLabelRectsOverlap,
  DEFAULT_PIE_LABEL_MIN_ANGLE,
  formatPieLabelText,
  layoutOutsideLabels,
  PieLabels,
} from "./pie-labels";
import type { PieArcData } from "./pie-context";
import {
  UnpaintedLabels,
  UnpaintedLabelsProvider,
  useUnpaintedLabelsStore,
} from "./labels/unpainted-labels";
import { seriesLabelInk } from "./labels/series-label-ink";

function makeArcs(values: number[]): PieArcData[] {
  const total = values.reduce((s, v) => s + v, 0);
  let angle = -Math.PI / 2;
  return values.map((value, index) => {
    const sweep = (value / total) * 2 * Math.PI;
    const arc: PieArcData = {
      data: { label: `Slice ${index}`, value },
      index,
      startAngle: angle,
      endAngle: angle + sweep,
      padAngle: 0,
      value,
    };
    angle += sweep;
    return arc;
  });
}

describe("formatPieLabelText", () => {
  it("joins the requested fields in label → value → percent order", () => {
    expect(
      formatPieLabelText(["percent", "label", "value"], {
        label: "Direct",
        value: "320",
        percent: "36%",
      }),
    ).toBe("Direct · 320 · 36%");
  });

  it("drops fields that are missing", () => {
    expect(formatPieLabelText(["label", "percent"], { label: "Direct" })).toBe("Direct");
  });

  it("shows only what `show` asks for", () => {
    expect(formatPieLabelText(["percent"], { label: "Direct", value: "320", percent: "36%" })).toBe(
      "36%",
    );
  });
});

describe("layoutOutsideLabels", () => {
  it("splits slices onto left/right sides by their midpoint's x sign", () => {
    // A slice at 90° (3 o'clock) is on the right; one at 270° (9 o'clock) is on the left.
    const arcs = makeArcs([25, 25, 25, 25]); // quarters, starting at -90° (12 o'clock)
    const { placements } = layoutOutsideLabels(
      arcs,
      arcs.map((a) => a.data.label),
      100,
    );
    const sides = new Set(placements.map((l) => l.side));
    expect(sides.has("left")).toBe(true);
    expect(sides.has("right")).toBe(true);
  });

  it("anchors right-side labels with textAnchor start and left-side with end", () => {
    const arcs = makeArcs([50, 50]); // one right half, one left half
    const { placements } = layoutOutsideLabels(
      arcs,
      arcs.map((a) => a.data.label),
      100,
    );
    for (const item of placements) {
      expect(item.textAnchor).toBe(item.side === "right" ? "start" : "end");
    }
  });

  it("declutters same-side labels that would otherwise collide vertically", () => {
    // Many thin adjacent slices crowded near the same clock position collide
    // without decluttering — assert the Acceptance bullet's own test: no two
    // label rects overlap.
    const values = Array.from({ length: 8 }, () => 1);
    const arcs = makeArcs(values);
    const texts = arcs.map((a) => `Category ${a.index}`);
    const { placements } = layoutOutsideLabels(arcs, texts, 80);
    expect(anyPieLabelRectsOverlap(placements.map((l) => l.rect))).toBe(false);
  });

  it("drops a label RM-110's layoutLabels cannot place within the nudge budget, and restates it via placements/dropped", () => {
    // One near-full-circle slice, then twenty razor-thin slices crammed into
    // the sliver left over — all twenty land on the same side at nearly the
    // same natural position, so the same-side stack overflows the bounded
    // nudge budget: a real collision-drop, restated `sr-only` by `PieLabels`
    // (see the render test below), not silently stacked off-canvas the way
    // the old unbounded declutter would have.
    const values = [970, ...Array.from({ length: 20 }, () => 1)];
    const arcs = makeArcs(values);
    const texts = arcs.map((a) => `Category ${a.index}`);
    const { placements, dropped } = layoutOutsideLabels(arcs, texts, 80);
    expect(dropped.length).toBeGreaterThan(0);
    // Every dropped label still carries its text (for the sr-only restatement)…
    for (const d of dropped) {
      expect(d.text).not.toBe("");
    }
    // …and every placed + dropped label accounts for every input arc exactly once.
    expect(placements.length + dropped.length).toBe(arcs.length);
    expect(anyPieLabelRectsOverlap(placements.map((l) => l.rect))).toBe(false);
  });

  it("keeps arc index → label correspondence regardless of layout order", () => {
    const arcs = makeArcs([10, 20, 30, 40]);
    const texts = ["A", "B", "C", "D"];
    const { placements } = layoutOutsideLabels(arcs, texts, 100);
    for (const item of placements) {
      expect(item.text).toBe(texts[item.index]);
    }
  });
});

describe("anyPieLabelRectsOverlap", () => {
  it("detects a real overlap", () => {
    expect(
      anyPieLabelRectsOverlap([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 5, y: 5, width: 10, height: 10 },
      ]),
    ).toBe(true);
  });

  it("says no for disjoint rects", () => {
    expect(
      anyPieLabelRectsOverlap([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 20, width: 10, height: 10 },
      ]),
    ).toBe(false);
  });
});

describe("PieLabels", () => {
  const getColor = (i: number) => `color-${i}`;

  it("renders nothing for placement 'none'", () => {
    const arcs = makeArcs([50, 50]);
    const { container } = render(
      <svg>
        <PieLabels
          arcs={arcs}
          center={100}
          config={{ placement: "none", show: ["label"] }}
          getColor={getColor}
          innerRadius={0}
          outerRadius={100}
          textFor={(i) => ({ label: arcs[i]?.data.label })}
        />
      </svg>,
    );
    expect(container.querySelector('[data-slot="pie-labels"]')).toBeNull();
  });

  it("hides inside labels under minAngle and shows the rest", () => {
    // A tiny 1-unit slice among large ones sweeps well under the default minAngle.
    const arcs = makeArcs([1, 99]);
    const { container } = render(
      <svg>
        <PieLabels
          arcs={arcs}
          center={100}
          config={{ placement: "inside", show: ["percent"] }}
          getColor={getColor}
          innerRadius={0}
          outerRadius={100}
          textFor={(i) => ({ percent: `${Math.round((arcs[i]!.value / 100) * 100)}%` })}
        />
      </svg>,
    );
    expect(arcs[0]!.endAngle - arcs[0]!.startAngle).toBeLessThan(DEFAULT_PIE_LABEL_MIN_ANGLE);
    const items = container.querySelectorAll('[data-slot="pie-labels-item"]');
    expect(items).toHaveLength(1); // only the 99-unit slice clears minAngle
    expect(items[0]?.textContent).toBe("99%");
  });

  it("paints outside labels with leaders", () => {
    const arcs = makeArcs([50, 50]);
    const { container } = render(
      <svg>
        <PieLabels
          arcs={arcs}
          center={100}
          config={{ placement: "outside", show: ["label"] }}
          getColor={getColor}
          innerRadius={0}
          outerRadius={100}
          textFor={(i) => ({ label: arcs[i]?.data.label })}
        />
      </svg>,
    );
    expect(container.querySelectorAll('[data-slot="leader"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-slot="pie-labels-item"]')).toHaveLength(2);
  });

  it("outside matchColor routes the fill through seriesLabelInk, not the raw series color (#544)", () => {
    const arcs = makeArcs([50, 50]);
    const { container } = render(
      <svg>
        <PieLabels
          arcs={arcs}
          center={100}
          config={{ placement: "outside", show: ["label"], matchColor: true }}
          getColor={getColor}
          innerRadius={0}
          outerRadius={100}
          textFor={(i) => ({ label: arcs[i]?.data.label })}
        />
      </svg>,
    );
    const items = container.querySelectorAll('[data-slot="pie-labels-item"]');
    expect(items[0]?.getAttribute("fill")).toBe(seriesLabelInk("color-0"));
    expect(items[0]?.getAttribute("fill")).not.toBe("color-0");
  });

  it("outside without matchColor keeps the neutral pieCssVars.foreground ink", () => {
    const arcs = makeArcs([50, 50]);
    const { container } = render(
      <svg>
        <PieLabels
          arcs={arcs}
          center={100}
          config={{ placement: "outside", show: ["label"] }}
          getColor={getColor}
          innerRadius={0}
          outerRadius={100}
          textFor={(i) => ({ label: arcs[i]?.data.label })}
        />
      </svg>,
    );
    const items = container.querySelectorAll('[data-slot="pie-labels-item"]');
    expect(items[0]?.getAttribute("fill")).toBe("var(--chart-foreground)");
  });

  it("inside matchColor routes the fill through seriesLabelInk, not the raw series color (#544)", () => {
    const arcs = makeArcs([50, 50]);
    const { container } = render(
      <svg>
        <PieLabels
          arcs={arcs}
          center={100}
          config={{ placement: "inside", show: ["label"], matchColor: true }}
          getColor={getColor}
          innerRadius={0}
          outerRadius={100}
          textFor={(i) => ({ label: arcs[i]?.data.label })}
        />
      </svg>,
    );
    const items = container.querySelectorAll('[data-slot="pie-labels-item"]');
    expect(items[0]?.getAttribute("fill")).toBe(seriesLabelInk("color-0"));
    expect(items[1]?.getAttribute("fill")).toBe(seriesLabelInk("color-1"));
  });

  it("inside without matchColor sets no fill override, so HaloText's own default (--chart-foreground) applies", () => {
    const arcs = makeArcs([50, 50]);
    const { container } = render(
      <svg>
        <PieLabels
          arcs={arcs}
          center={100}
          config={{ placement: "inside", show: ["label"] }}
          getColor={getColor}
          innerRadius={0}
          outerRadius={100}
          textFor={(i) => ({ label: arcs[i]?.data.label })}
        />
      </svg>,
    );
    const items = container.querySelectorAll('[data-slot="pie-labels-item"]');
    expect(items[0]?.getAttribute("fill")).toBe("var(--chart-foreground)");
  });

  it("the whole layer is aria-hidden (RM-017: marks are ink)", () => {
    const arcs = makeArcs([50, 50]);
    const { container } = render(
      <svg>
        <PieLabels
          arcs={arcs}
          center={100}
          config={{ placement: "outside", show: ["label"] }}
          getColor={getColor}
          innerRadius={0}
          outerRadius={100}
          textFor={(i) => ({ label: arcs[i]?.data.label })}
        />
      </svg>,
    );
    expect(container.querySelector('[data-slot="pie-labels"]')?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("restates a collision-dropped outside label sr-only via RM-110's UnpaintedLabels seam", () => {
    // Same over-dense scenario as `layoutOutsideLabels`'s drop test — enough
    // that at least one outside label cannot be placed. `PieLabels` reports
    // it to the nearest `UnpaintedLabelsProvider` (mounted by `PieChart`
    // itself in real use; this test mounts one directly, the way
    // `pie-chart.tsx` does) instead of silently omitting it.
    const values = [970, ...Array.from({ length: 20 }, () => 1)];
    const arcs = makeArcs(values);

    function Harness() {
      const store = useUnpaintedLabelsStore();
      return (
        <UnpaintedLabelsProvider store={store}>
          <svg>
            <PieLabels
              arcs={arcs}
              center={100}
              config={{ placement: "outside", show: ["label"] }}
              getColor={getColor}
              innerRadius={0}
              outerRadius={80}
              textFor={(i) => ({ label: arcs[i]?.data.label })}
            />
          </svg>
          <UnpaintedLabels store={store} />
        </UnpaintedLabelsProvider>
      );
    }

    const { container } = render(<Harness />);
    const unpainted = container.querySelector('[data-slot="chart-labels-unpainted"]');
    expect(unpainted).not.toBeNull();
    expect(Number(unpainted?.getAttribute("data-count"))).toBeGreaterThan(0);
  });
});
