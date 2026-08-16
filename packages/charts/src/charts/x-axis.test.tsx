/**
 * XAxis `tickFormat` / `tickValues` seam + collapsed-axis dev warning (#357).
 *
 * Rendered through `LineChart` (real `TimeSeriesChartInner`, not mocked) so the
 * axis has a real `ChartProvider` context to read from — mirrors the pattern in
 * `time-series-chart-shell.test.tsx`. `Line` itself is omitted (calls
 * `getTotalLength()`, unsupported in jsdom); `XAxis` needs no series child.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
        children({ width: 560, height: 288 }),
      ),
  };
});

import { LineChart } from "./line-chart";
import { XAxis } from "./x-axis";
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
      const denseData = [
        { date: new Date("2024-01-01T00:00:00"), value: 1 },
        { date: new Date("2024-01-01T00:05:00"), value: 2 },
        { date: new Date("2024-01-01T00:10:00"), value: 3 },
      ];
      render(
        <LineChart data={denseData}>
          <XAxis />
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
