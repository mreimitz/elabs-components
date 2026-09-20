/**
 * XAxis `tickFormat` / `tickValues` seam + collapsed-axis dev warning (#357).
 *
 * Rendered through `LineChart` (real `TimeSeriesChartInner`, not mocked) so the
 * axis has a real `ChartProvider` context to read from — mirrors the pattern in
 * `time-series-chart-shell.test.tsx`. `Line` itself is omitted (calls
 * `getTotalLength()`, unsupported in jsdom); `XAxis` needs no series child.
 */

import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// RM-108: the width is mutable so the width-derived tick target can be driven.
const parentSize = vi.hoisted(() => ({ width: 560, height: 288 }));

// ScatterChart measures with react-use-measure (ResizeObserver) — fixed size here.
vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 560, height: 288 }],
}));

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom lacks.
vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: parentSize.width, height: parentSize.height }),
      ),
  };
});

import { AutoChart } from "../auto-chart/auto-chart";
import {
  assertAxisSpecContract,
  BarChart as BarChartDouble,
  LineChart as LineChartDouble,
} from "../test/doubles";
import {
  BarXAxis as BarXAxisPart,
  Grid as GridPart,
  XAxis as XAxisPart,
  YAxis as YAxisPart,
} from "../test/primitives";
import { ChartConfigProvider } from "./chart-config-context";
import { LineChart } from "./line-chart";
import { ScatterChart } from "./scatter-chart";
import { generatePeriodTicks, isLongPeriodTick, selectEvenlySpacedIndices, XAxis } from "./x-axis";
import { YAxis } from "./y-axis";

afterEach(cleanup);

const chartData = [
  { date: new Date("2024-01-01"), value: 5 },
  { date: new Date("2024-02-01"), value: 8 },
  { date: new Date("2024-03-01"), value: 3 },
];

// 8 points (> the default numTicks=5) so tickMode="data" tick SELECTION goes
// through the `allIndexLayouts` scoring loop — and therefore `dedupeIndicesByLabel`
// — rather than short-circuiting to "return every index" (length <= targetCount).
const denseChartData = Array.from({ length: 8 }, (_, i) => ({
  date: new Date(2024, i, 1),
  value: i + 1,
}));

// A MIXED dataset — one real Date plus two DISTINCTLY-labeled non-coercible
// values — reproduces the #352 duplicate-tick-key regression: every Invalid
// Date's `.getTime()` is the same `NaN`, and (with a degenerate/zero-width x
// scale reachable through this path) their pixel `x` collides too, so a tick
// key built from ONLY `date.getTime()` + `x` collides across "A" and "B".
const mixedInvalidXData = [
  { turn: new Date("2024-01-01"), value: 5 },
  { turn: "A", value: 8 },
  { turn: "B", value: 3 },
];

describe("XAxis — tickFormat / tickValues (#357)", () => {
  it("renders the custom tickFormat output instead of the default Intl label", () => {
    const { container } = render(
      <LineChart data={chartData}>
        <XAxis tickFormat={() => "CUSTOM_LABEL"} />
      </LineChart>,
    );
    expect(container.textContent).toContain("CUSTOM_LABEL");
    // The default `{month:"short", day:"numeric"}` formatter would render "Jan" —
    // assert it's fully replaced, not merely supplemented.
    expect(container.textContent).not.toMatch(/Jan|Feb|Mar/);
  });

  it("renders exactly the tickValues positions, bypassing generation and de-dupe", () => {
    const tickValues = [new Date("2024-01-15"), new Date("2024-02-20")];
    const { container } = render(
      <LineChart data={chartData}>
        <XAxis tickValues={tickValues} />
      </LineChart>,
    );
    const labels = container.querySelectorAll(".text-chart-label");
    expect(labels).toHaveLength(2);
  });

  it("combines tickValues + tickFormat: exact positions, custom text", () => {
    const tickValues = [new Date("2024-01-15"), new Date("2024-02-20"), new Date("2024-03-10")];
    const { container } = render(
      <LineChart data={chartData}>
        <XAxis tickFormat={(d) => `D${d.getUTCDate()}`} tickValues={tickValues} />
      </LineChart>,
    );
    const labels = container.querySelectorAll(".text-chart-label");
    expect(labels).toHaveLength(3);
    expect(container.textContent).toContain("D15");
    expect(container.textContent).toContain("D20");
    expect(container.textContent).toContain("D10");
  });

  it("warns in dev when the default formatter collapses ticks below 2 (no override set)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // All three points fall within the same day (default formatter is
      // {month:"short", day:"numeric"} — no time component), so every
      // domain-interpolated tick collapses to the same "Jan 1" label.
      //
      // RM-109: the default formatter is now the span/width ladder
      // (`dateFormatForSpan`), which resolves a ten-minute span to the
      // "minute" rung on its own and would no longer collapse — that's the
      // bug this RM fixes. `dateFormat="day"` pins the OLD coarse shape
      // explicitly so this test still exercises the collapse-warning
      // mechanism itself, independent of which rung is in play.
      const denseData = [
        { date: new Date("2024-01-01T00:00:00"), value: 1 },
        { date: new Date("2024-01-01T00:05:00"), value: 2 },
        { date: new Date("2024-01-01T00:10:00"), value: 3 },
      ];
      render(
        <LineChart data={denseData}>
          <XAxis dateFormat="day" />
        </LineChart>,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/XAxis.*collapsed/i);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT warn when tickFormat is set, even if the caller's formatter also collapses labels", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const denseData = [
        { date: new Date("2024-01-01T00:00:00"), value: 1 },
        { date: new Date("2024-01-01T00:05:00"), value: 2 },
        { date: new Date("2024-01-01T00:10:00"), value: 3 },
      ];
      render(
        <LineChart data={denseData}>
          <XAxis tickFormat={() => "SAME"} />
        </LineChart>,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT warn for normal, well-spaced default-formatted data (no false positive)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <LineChart data={chartData}>
          <XAxis />
        </LineChart>,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('threads tickFormat through tickMode="data" (dedupe + data-aligned tick labels, #357)', () => {
    const { container } = render(
      <LineChart data={denseChartData}>
        <XAxis tickFormat={() => "CUSTOM_DATA_LABEL"} tickMode="data" />
      </LineChart>,
    );
    expect(container.textContent).toContain("CUSTOM_DATA_LABEL");
    // The default {month:"short", day:"numeric"} formatter would render real
    // month abbreviations — assert tickFormat fully replaced them, not merely
    // supplemented them (this is what breaks if tickFormat isn't threaded
    // through `dedupeIndicesByLabel`/`buildDataAlignedTicks`).
    expect(container.textContent).not.toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug/);
  });
});

// #394: axis tick labels must reach the density-aware `text-meta` ROLE, not
// the raw `text-xs` UTILITY the type dial cannot see (styling-and-tokens.md
// "Type is a role, not a size"). A raw `text-xs` renders pixel-identical to
// `text-meta` at `comfortable` density (both 12px) — the classList is the only
// way to lock this in a jsdom test; the actual density-driven size shift is
// proven separately by a Storybook play function (real browser, real CSS).
describe("XAxis / YAxis — density-role className (#394)", () => {
  it("XAxis renders its tick label with the text-meta role, not the raw text-xs utility", () => {
    const { container } = render(
      <LineChart data={chartData}>
        <XAxis />
      </LineChart>,
    );
    const label = container.querySelector(".text-chart-label");
    expect(label).not.toBeNull();
    expect(label).toHaveClass("text-meta");
    expect(label).not.toHaveClass("text-xs");
  });

  it("YAxis renders its tick label with the text-meta role, not the raw text-xs utility", () => {
    const { container } = render(
      <LineChart data={chartData}>
        <YAxis />
      </LineChart>,
    );
    const label = container.querySelector(".text-chart-label");
    expect(label).not.toBeNull();
    expect(label).toHaveClass("text-meta");
    expect(label).not.toHaveClass("text-xs");
  });
});

describe("XAxis — duplicate tick key regression (#352)", () => {
  it("does not warn about duplicate React keys for multiple distinctly-labeled non-Date x values", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <LineChart data={mixedInvalidXData} xDataKey="turn">
          <XAxis tickMode="data" />
        </LineChart>,
      );
      const duplicateKeyWarnings = errorSpy.mock.calls.filter((call) =>
        String(call[0]).includes("Encountered two children with the same key"),
      );
      expect(duplicateKeyWarnings).toHaveLength(0);
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});

/**
 * `periodTicks`'s long-tick anchor is a calendar fact, not an index stride
 * from wherever the series happens to start (#253). Two different start
 * weekdays are asserted so an implementation that still counts `i % 7` from
 * index 0 — which would pick a different (arbitrary) weekday per start date —
 * fails on at least one of them.
 */
describe("XAxis — periodTicks long-tick calendar anchor (#253)", () => {
  it("'day': the long tick is always Monday, regardless of the series' start weekday", () => {
    // 2024-01-01 is a Monday.
    const mondayStart = new Date(2024, 0, 1);
    const mondayEnd = new Date(2024, 0, 1 + 89);
    const fromMonday = generatePeriodTicks("day", mondayStart, mondayEnd);
    expect(fromMonday.every((d) => d.getDay() !== 1 || isLongPeriodTick("day", d))).toBe(true);
    expect(fromMonday.some((d) => isLongPeriodTick("day", d))).toBe(true);
    fromMonday.forEach((d) => {
      expect(isLongPeriodTick("day", d)).toBe(d.getDay() === 1);
    });

    // 2024-01-03 is a Wednesday — an `i % 7 === 0` implementation would mark
    // every Wednesday long instead of every Monday.
    const wednesdayStart = new Date(2024, 0, 3);
    const wednesdayEnd = new Date(2024, 0, 3 + 89);
    const fromWednesday = generatePeriodTicks("day", wednesdayStart, wednesdayEnd);
    const longIndices = fromWednesday
      .map((d, i) => (isLongPeriodTick("day", d) ? i : -1))
      .filter((i) => i >= 0);
    // The old index-stride bug would report index 0 (the series' first
    // sample) as long; the calendar anchor never does, because Jan 3 is a
    // Wednesday.
    expect(longIndices).not.toContain(0);
    longIndices.forEach((i) => {
      expect(fromWednesday[i]?.getDay()).toBe(1);
    });
  });

  it("'week': the long tick lands in a month's first 7 days", () => {
    const ticks = generatePeriodTicks("week", new Date(2024, 0, 1), new Date(2024, 2, 31));
    ticks.forEach((d) => {
      expect(isLongPeriodTick("week", d)).toBe(d.getDate() <= 7);
    });
    expect(ticks.some((d) => isLongPeriodTick("week", d))).toBe(true);
  });

  it("'month': the long tick is January", () => {
    const ticks = generatePeriodTicks("month", new Date(2023, 5, 1), new Date(2025, 5, 1));
    ticks.forEach((d) => {
      expect(isLongPeriodTick("month", d)).toBe(d.getMonth() === 0);
    });
    expect(ticks.filter((d) => isLongPeriodTick("month", d))).toHaveLength(2); // Jan 2024, Jan 2025
  });
});

describe("XAxis / YAxis — width- and height-derived tick targets (RM-108)", () => {
  // Two years of monthly rows: enough distinct labels for any target.
  const monthly = Array.from({ length: 24 }, (_, i) => ({
    date: new Date(2023, i, 1),
    value: 10 + i,
  }));

  function paintedXTicks(width: number, axis = <XAxis />, data = monthly): number {
    parentSize.width = width;
    const { container } = render(<LineChart data={data}>{axis}</LineChart>);
    const layer = container.querySelector('[data-slot="x-axis"]');
    const count = Number(layer?.getAttribute("data-tick-count"));
    cleanup();
    parentSize.width = 560;
    return count;
  }

  it("paints 8–10 x ticks at 900 px and 3–5 at 380 px", () => {
    // Tick-step round (#478): the AUTO count path picks a calendar STEP from
    // `CALENDAR_STEP_LADDER` (x-axis.tsx) directly, banded around the
    // width-derived target, rather than asking `xScale.ticks(count)` to
    // infer one from a bare count — d3's own per-unit step list is coarser
    // (months only offer a 1- or 3-month step) and can jump straight past
    // this band. `monthly`'s domain spans under 2 calendar years, so a
    // narrow width's ~3-tick target lands on the 6-month step (4 ticks) —
    // in-band, real calendar boundaries, still inside RM-108's own bound.
    const wide = paintedXTicks(900);
    const narrow = paintedXTicks(380);
    expect(wide).toBeGreaterThanOrEqual(8);
    expect(wide).toBeLessThanOrEqual(10);
    expect(narrow).toBeGreaterThanOrEqual(3);
    expect(narrow).toBeLessThanOrEqual(5);
  });

  // A real ten-year DAILY series (2016-01-01..2025-12-31, 3,653 points —
  // matches `DateLadderLongSpan`'s own fixture, formatting.stories.tsx) and a
  // 36-hour hourly series (matches `DateLadderShortSpan`'s fixture) — the two
  // targets the tick-step round (#478) fixes: a calendar-step-chosen STEP's
  // format rung now reads off the STEP's own unit (`presetForCalendarStep`),
  // not the raw width-derived target or the resulting tick COUNT, either of
  // which can pick the wrong rung (see `chooseCalendarStep`'s doc comment in
  // x-axis.tsx).
  const daily10y = Array.from({ length: 3653 }, (_, i) => ({
    date: new Date(2016, 0, 1 + i),
    value: i,
  }));
  const hourly36 = Array.from({ length: 36 }, (_, i) => ({
    date: new Date(2024, 0, 1, i),
    value: i,
  }));

  function paintedXLabels(width: number, data: typeof daily10y, narrow = false): string[] {
    parentSize.width = width;
    const chart = (
      <LineChart data={data}>
        <XAxis />
      </LineChart>
    );
    const { container } = render(
      narrow ? (
        <ChartConfigProvider value={{ breakpoint: "narrow" }}>{chart}</ChartConfigProvider>
      ) : (
        chart
      ),
    );
    const labels = [...container.querySelectorAll('[data-slot="x-axis"] span')].map(
      (n) => n.textContent ?? "",
    );
    cleanup();
    parentSize.width = 560;
    return labels;
  }

  it("ten-year daily series: ’16 ’18 ’20 ’22 ’24 at 380 px (narrow), full years 2016…2025 at 900 px", () => {
    // 380 px forces RM-107's narrow breakpoint (`density="sm"`) explicitly —
    // jsdom never measures a real layout width, so `ChartConfigProvider`'s
    // `breakpoint` override stands in for a real narrow container here.
    expect(paintedXLabels(380, daily10y, true)).toEqual(["’16", "’18", "’20", "’22", "’24"]);
    expect(paintedXLabels(900, daily10y)).toEqual([
      "2016",
      "2017",
      "2018",
      "2019",
      "2020",
      "2021",
      "2022",
      "2023",
      "2024",
      "2025",
    ]);
  });

  it("36-hour series paints times of day at every width, never a weekday fallback", () => {
    for (const width of [380, 600, 900]) {
      const labels = paintedXLabels(width, hourly36);
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label).toMatch(/^\d{2}:\d{2}$/);
      }
    }
    // The 380 px case names an exact shape in the Acceptance: a midnight tick
    // recurring across the day boundary is a legitimate repeat, not a
    // de-duped collision (see `buildDomainTicks`'s `usingCalendarTicks` guard).
    expect(paintedXLabels(380, hourly36)).toEqual(["00:00", "12:00", "00:00"]);
  });

  it("never paints more auto x ticks than data rows", () => {
    expect(paintedXTicks(900, <XAxis />, monthly.slice(0, 6))).toBeLessThanOrEqual(6);
    expect(paintedXTicks(900, <XAxis tickCount={8} />, monthly.slice(0, 6))).toBe(8);
  });

  it("numTicks={5} pins the count at both widths", () => {
    expect(paintedXTicks(900, <XAxis numTicks={5} />)).toBe(5);
    expect(paintedXTicks(380, <XAxis numTicks={5} />)).toBe(5);
  });

  it('orientation="top" and a title render on the x axis', () => {
    const { container } = render(
      <LineChart data={monthly}>
        <XAxis orientation="top" title="Month" titlePlacement="inside" />
      </LineChart>,
    );
    expect(container.querySelector('[data-slot="x-axis"]')?.getAttribute("data-orientation")).toBe(
      "top",
    );
    const title = container.querySelector('[data-slot="axis-title"]');
    expect(title?.getAttribute("data-placement")).toBe("inside");
    expect(container.textContent).toContain("Month");
  });

  it("YAxis paints 3 ticks on a short plot and honours explicit ticks", () => {
    parentSize.height = 180;
    const { container } = render(
      <LineChart data={monthly}>
        <YAxis title="Riders" />
      </LineChart>,
    );
    const short = Number(
      container.querySelector('[data-slot="y-axis"]')?.getAttribute("data-tick-count"),
    );
    cleanup();
    parentSize.height = 288;
    expect(short).toBeLessThanOrEqual(4);
    const { container: pinned } = render(
      <LineChart data={monthly}>
        <YAxis ticks={[0, 20, 40]} />
      </LineChart>,
    );
    expect(pinned.querySelector('[data-slot="y-axis"]')?.getAttribute("data-tick-count")).toBe("3");
  });
});

describe("XAxis — numeric x domain / scale on ScatterChart (RM-108)", () => {
  const points = [
    { dose: 2, response: 5 },
    { dose: 15, response: 9 },
    { dose: 40, response: 14 },
    { dose: 310, response: 20 },
  ];

  function xLabels(container: HTMLElement): string[] {
    return [...container.querySelectorAll('[data-slot="x-axis"] span')].map(
      (node) => node.textContent ?? "",
    );
  }

  it("paints a numeric ruler across a pinned domain", () => {
    const { container } = render(
      <ScatterChart data={points} xDataKey="dose">
        <XAxis domain={[0, 400]} numTicks={5} />
      </ScatterChart>,
    );
    const labels = xLabels(container);
    expect(labels[0]).toBe("0");
    expect(labels.at(-1)).toBe("400");
  });

  it("spaces a log x axis by decade", () => {
    const { container } = render(
      <ScatterChart data={points} xDataKey="dose">
        <XAxis scale="log" numTicks={5} />
      </ScatterChart>,
    );
    const layer = container.querySelector('[data-slot="x-axis"]');
    const positions = [...(layer?.children ?? [])]
      .map((node) => Number.parseFloat((node as HTMLElement).style.left))
      .filter(Number.isFinite);
    const labels = xLabels(container);
    const at = (label: string) => positions[labels.indexOf(label)] ?? Number.NaN;
    // Data 2–310 → domain 2–500, thinned to the 1-5 tier: 5 · 10 · 50 · 100 · 500.
    expect(labels).toEqual(["5", "10", "50", "100", "500"]);
    // 5 → 50 and 10 → 100 are both one decade: the same width on a log ruler.
    expect(at("50") - at("5")).toBeCloseTo(at("100") - at("10"), 0);
  });

  it("refuses log on x values touching 0 and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <ScatterChart data={[...points, { dose: 0, response: 1 }]} xDataKey="dose">
        <XAxis scale="log" />
      </ScatterChart>,
    );
    expect(warn.mock.calls.some(([message]) => String(message).startsWith("[XAxis x]"))).toBe(true);
    warn.mockRestore();
  });
});

describe("XAxis / YAxis — an unsorted numeric x (RM-127, a-4)", () => {
  // A scatter's rows arrive in whatever order the caller has them, so data
  // order is NOT x order. Ranked by spend: 9000 · 10000 · 11500 · 14000 ·
  // 16000 · 18000 · 22000.
  const spend = [
    { spend: 10000, conversions: 420 },
    { spend: 14000, conversions: 580 },
    { spend: 9000, conversions: 380 },
    { spend: 18000, conversions: 720 },
    { spend: 22000, conversions: 890 },
    { spend: 16000, conversions: 640 },
    { spend: 11500, conversions: 490 },
  ];

  it("picks tick rows by painted x, not by data index", () => {
    // A 340 px plot over the 9000–22000 span: x(v) = (v - 9000) / 13000 * 340.
    const xOf = (index: number) => (((spend[index]?.spend ?? 0) - 9000) / 13000) * 340;
    const picked = selectEvenlySpacedIndices(spend.length, 2, { resolveXPx: xOf });
    const positions = picked.map(xOf).sort((a, b) => a - b);
    const gap = (positions.at(-1) ?? 0) - (positions[0] ?? 0);
    // Index-order selection took rows 0 and 6 — 10000 and 11500, 27.5 px apart
    // at this scale, which is narrower than either label. Every kept pair must
    // now clear a 5-character label (~36 px) plus a gap.
    expect(picked).toHaveLength(2);
    expect(gap).toBeGreaterThan(44);
  });

  it("keeps a sorted series on exactly the indices it had before", () => {
    const sorted = Array.from({ length: 10 }, (_, i) => i * 30);
    expect(selectEvenlySpacedIndices(10, 4, { resolveXPx: (i) => sorted[i] ?? 0 })).toEqual(
      selectEvenlySpacedIndices(10, 4),
    );
  });

  it("keeps the value axis at the narrow tier when x is quantitative", () => {
    // RM-072 drops the value axis at `sm` because the CATEGORY axis still
    // names each mark. A scatter has no category axis, so dropping it would
    // leave the plot with no scale in either direction.
    const { container } = render(
      <ChartConfigProvider value={{ breakpoint: "narrow" }}>
        <ScatterChart data={spend} xDataKey="spend">
          <XAxis />
          <YAxis />
        </ScatterChart>
      </ChartConfigProvider>,
    );
    expect(container.querySelector('[data-slot="y-axis"]')).not.toBeNull();
    const xLabelTexts = [...container.querySelectorAll('[data-slot="x-axis"] span')].map(
      (node) => node.textContent ?? "",
    );
    expect(xLabelTexts).toContain("9000");
    expect(xLabelTexts).toContain("22000");
    expect(xLabelTexts).not.toContain("11500");
  });
});

describe("ChartSpec.axes → AutoChart (RM-108)", () => {
  // AutoChart mounts `Line`, whose stroke metrics call getTotalLength() —
  // jsdom lacks it. Stubbed for this block only, removed afterwards.
  beforeAll(() => {
    (Element.prototype as unknown as { getTotalLength: () => number }).getTotalLength = () => 0;
  });
  afterAll(() => {
    delete (Element.prototype as unknown as { getTotalLength?: () => number }).getTotalLength;
  });

  const spec = {
    type: "line" as const,
    data: Array.from({ length: 12 }, (_, i) => ({
      month: `2024-${String(i + 1).padStart(2, "0")}-01`,
      riders: 100 + i * 10,
    })),
    x: "month",
    series: ["riders"],
  };

  it("forwards title, domain, ticks, grid mode and position to the real axes", () => {
    const { container } = render(
      <AutoChart
        spec={{
          ...spec,
          axes: {
            x: { position: "top", title: "Month" },
            y: { domain: [0, 400], ticks: [0, 200, 400], title: "Riders", gridMode: "ticks" },
          },
        }}
      />,
    );
    expect(container.querySelector('[data-slot="x-axis"]')?.getAttribute("data-orientation")).toBe(
      "top",
    );
    const yLabels = [...container.querySelectorAll('[data-slot="y-axis"] span')].map(
      (node) => node.textContent,
    );
    expect(yLabels.slice(0, 3)).toEqual(["0", "200", "400"]);
    expect(container.textContent).toContain("Riders");
    expect(container.textContent).toContain("Month");
    expect(container.querySelector(".chart-grid")?.getAttribute("data-grid-mode")).toBe("ticks");
  });

  it("renders exactly as before without axes", () => {
    const { container } = render(<AutoChart spec={spec} />);
    expect(container.querySelector(".chart-grid")?.getAttribute("data-grid-mode")).toBe("lines");
    expect(container.querySelector('[data-slot="axis-title"]')).toBeNull();
  });
});

describe("test double — axis contract (RM-108)", () => {
  const rows = [{ date: new Date("2024-01-01"), value: 1 }];

  it("accepts every well-formed axis prop", () => {
    expect(() =>
      render(
        <LineChartDouble data={rows}>
          <GridPart mode="ticks" />
          <XAxisPart orientation="top" tickCount="auto" titlePlacement="inside" />
          <YAxisPart domain={[0, "auto"]} scale="log" ticks={[1, 10]} labelPlacement="inside" />
        </LineChartDouble>,
      ),
    ).not.toThrow();
  });

  it("names a malformed domain, scale, grid mode or bar fit", () => {
    const bad = [
      <YAxisPart domain={["50", 100]} key="d" />,
      <YAxisPart domain={[100, 50]} key="i" />,
      <YAxisPart scale="logarithmic" key="s" />,
      <GridPart mode="dashed" key="g" />,
      <XAxisPart orientation="left" key="o" />,
    ];
    for (const part of bad) {
      expect(() => render(<LineChartDouble data={rows}>{part}</LineChartDouble>)).toThrow(
        /violates the real component/,
      );
      cleanup();
    }
    expect(() => assertAxisSpecContract({ y: { gridMode: "dotted" } })).toThrow(/gridMode/);
    expect(() => assertAxisSpecContract({ x: { position: "left" } })).toThrow(/position/);
    expect(() => assertAxisSpecContract({ y: { domain: [0, 10], scale: "log" } })).not.toThrow();
    expect(() =>
      render(
        <BarChartDouble data={[{ region: "North", value: 1 }]} xDataKey="region">
          <BarXAxisPart fit="squash" />
        </BarChartDouble>,
      ),
    ).toThrow(/"fit" must be one of/);
  });
});
