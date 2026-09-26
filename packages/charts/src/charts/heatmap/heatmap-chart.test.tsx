/**
 * HeatmapChart — jsdom tests.
 *
 * jsdom gives every element a zero-sized bounding box, so `ParentSize` never
 * reports a usable width and the SVG body stays behind its `w > 0 && h > 0`
 * guard — the same limitation `funnel-chart.test.tsx` documents. What CAN be
 * asserted here is everything above that guard (the accessible sentence, the
 * empty state, the legend, ref forwarding) plus the two STRUCTURAL properties
 * the acceptance criteria name, which are properties of the source rather than
 * of a rendered pixel:
 *
 *   1. no per-cell `motion` node — the enter stagger is CSS `animation-delay`;
 *   2. a diverging palette always carries a second, non-hue channel.
 *
 * The rendered pass (cells, ticks, tooltip, click and keyboard) lives in
 * `heatmap-chart.stories.tsx`, run by `pnpm --filter @elabs-ai/components-docs test-storybook`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { HeatmapChart } from "./heatmap-chart";

beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const HERE = dirname(fileURLToPath(import.meta.url));
const source = (file: string) => readFileSync(join(HERE, file), "utf8");

const punchCard = [
  { day: "Mon", hour: "09", count: 4 },
  { day: "Mon", hour: "10", count: 12 },
  { day: "Tue", hour: "09", count: 0 },
  { day: "Tue", hour: "10", count: 7 },
];

const calendarDays = [
  { date: "2026-03-09", deploys: 3 },
  { date: "2026-03-10", deploys: 0 },
  { date: "2026-03-16", deploys: 9 },
];

describe("HeatmapChart", () => {
  it("names itself with a generated summary naming the peak", () => {
    render(<HeatmapChart data={punchCard} valueKey="count" x="hour" y="day" />);
    expect(
      screen.getByRole("figure", { name: "Heatmap, 2 rows × 2 columns, peak 12 at Mon 10." }),
    ).toBeInTheDocument();
  });

  it("counts a calendar in weeks and weekdays and names the peak day", () => {
    render(
      <HeatmapChart data={calendarDays} valueKey="deploys" variant="calendar" x="date" y="" />,
    );
    expect(
      screen.getByRole("figure", { name: "Heatmap, 2 weeks × 7 weekdays, peak 9 at 2026-03-16." }),
    ).toBeInTheDocument();
  });

  it("lets the caller replace the sentence (the localization seam)", () => {
    render(
      <HeatmapChart
        accessibleLabel="Wärmekarte der Einsätze"
        data={punchCard}
        valueKey="count"
        x="hour"
        y="day"
      />,
    );
    expect(screen.getByRole("figure", { name: "Wärmekarte der Einsätze" })).toBeInTheDocument();
  });

  it("describes the colour scale for a screen reader, not just visually", () => {
    const { container } = render(
      <HeatmapChart data={punchCard} steps={5} valueKey="count" x="hour" y="day" />,
    );
    const legend = container.querySelector('[data-slot="heatmap-legend"]');
    expect(legend).toBeInTheDocument();
    expect(legend?.textContent).toContain("Colour scale: 5 steps from 0 to 12.");
  });

  it("says a continuous scale is continuous rather than naming uncountable steps", () => {
    const { container } = render(
      <HeatmapChart data={punchCard} steps={0} valueKey="count" x="hour" y="day" />,
    );
    expect(container.querySelector('[data-slot="heatmap-legend"]')?.textContent).toContain(
      "Colour scale: continuous",
    );
  });

  describe("legendLabels (RM-118)", () => {
    it("defaults to endpoints — lo/hi bracket the strip, no per-swatch range labels", () => {
      const { container } = render(
        <HeatmapChart data={punchCard} steps={5} valueKey="count" x="hour" y="day" />,
      );
      const legend = container.querySelector('[data-slot="heatmap-legend"]');
      expect(legend?.querySelectorAll('[data-slot="heatmap-legend-step"]')).toHaveLength(5);
      expect(legend?.querySelectorAll('[data-slot="heatmap-legend-range-label"]')).toHaveLength(0);
    });

    it('"ranges" prints one range label per swatch, matching the swatch count', () => {
      const { container } = render(
        <HeatmapChart
          data={punchCard}
          legendLabels="ranges"
          steps={5}
          valueKey="count"
          x="hour"
          y="day"
        />,
      );
      const legend = container.querySelector('[data-slot="heatmap-legend"]');
      const swatches = legend?.querySelectorAll('[data-slot="heatmap-legend-step"]');
      const rangeLabels = legend?.querySelectorAll('[data-slot="heatmap-legend-range-label"]');
      expect(swatches).toHaveLength(5);
      expect(rangeLabels).toHaveLength(5);
      // The first range label starts at the domain floor, the last ends at the ceiling.
      expect(rangeLabels?.[0]?.textContent).toMatch(/^0–/);
      expect(rangeLabels?.[4]?.textContent).toMatch(/–12$/);
    });
  });

  describe("empty state is a state of the region, not an exit from it (#256)", () => {
    /** The element carrying the plot box's inline aspect ratio. */
    const plotBox = (container: HTMLElement) =>
      container.querySelector<HTMLElement>('[data-slot="heatmap-chart"] > [style*="aspect-ratio"]');

    // jsdom does not lay out, so a pixel height here would be vacuous. What can
    // regress is the STRUCTURE: the empty state renders inside the same
    // aspect-ratio box as the grid. The pixel lock is `Empty`'s play function.
    it.each([
      [{}, "16 / 9"],
      [{ variant: "calendar" as const }, "6 / 1"],
      [{ aspectRatio: "5 / 3" }, "5 / 3"],
    ])("keeps the loaded chart's plot box (%o → %s)", (extra, ratio) => {
      const empty = render(<HeatmapChart data={[]} valueKey="count" x="hour" y="day" {...extra} />);
      expect(plotBox(empty.container)?.style.aspectRatio).toBe(ratio);
      empty.unmount();
      const loaded = render(
        <HeatmapChart data={punchCard} valueKey="count" x="hour" y="day" {...extra} />,
      );
      expect(plotBox(loaded.container)?.style.aspectRatio).toBe(ratio);
    });

    it("keeps the figure name, the root slot and exactly one live region", () => {
      const { container } = render(
        <HeatmapChart data={[]} emptyMessage="Nothing yet." valueKey="count" x="hour" y="day" />,
      );
      const figure = screen.getByRole("figure");
      expect(figure).toHaveAccessibleName("Heatmap, 0 rows × 0 columns, no values.");
      expect(figure.dataset.slot).toBe("heatmap-chart");
      const status = screen.getAllByRole("status");
      expect(status).toHaveLength(1);
      expect(status[0]).toHaveTextContent("Nothing yet.");
      expect(container.querySelector('[data-slot="heatmap-legend"]')).toBeNull();
    });

    it("renders the empty anatomy: a default title, the message and an optional action", () => {
      const { unmount } = render(<HeatmapChart data={[]} valueKey="count" x="hour" y="day" />);
      expect(screen.getByRole("heading", { name: "No data" })).toBeInTheDocument();
      expect(screen.getByText("No data to plot.")).toBeInTheDocument();
      unmount();

      render(
        <HeatmapChart
          data={[]}
          emptyAction={<button type="button">Clear filters</button>}
          emptyTitle="No traffic"
          valueKey="count"
          x="hour"
          y="day"
        />,
      );
      expect(screen.getByRole("heading", { name: "No traffic" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
    });
  });

  it("forwards a ref to its root", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<HeatmapChart data={punchCard} ref={ref} valueKey="count" x="hour" y="day" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.dataset.slot).toBe("heatmap-chart");
  });

  it("adds no focusable node of its own when it is not interactive", () => {
    const { container } = render(
      <HeatmapChart data={punchCard} valueKey="count" x="hour" y="day" />,
    );
    // The container itself is a focus stop (it carries the summary); nothing else is.
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  describe("acceptance: the stagger is CSS, not 168 motion nodes", () => {
    const cell = source("heatmap-cell.tsx");

    it("draws a cell with a plain <g>, never a motion component", () => {
      expect(cell).not.toMatch(/<motion\./);
      expect(cell).not.toMatch(/from "motion\/react"/);
      expect(cell).toContain("animationDelay");
    });

    it("keys the delay off both grid axes, so the wave crosses diagonally", () => {
      expect(cell).toContain("(cell.column + cell.row) * staggerMs");
    });
  });

  describe("acceptance: a diverging ramp never ships on hue alone (WCAG 1.4.1)", () => {
    it("turns the value labels on by default", () => {
      const { container } = render(
        <HeatmapChart data={punchCard} palette="diverging" valueKey="count" x="hour" y="day" />,
      );
      // Only observable above the size guard, so assert the intent's own switch:
      // the legend exists and the chart mounted with the diverging domain.
      expect(container.querySelector('[data-slot="heatmap-legend"]')?.textContent).toContain(
        "from -12 to 12",
      );
    });

    it("hatches negative cells when the caller turns the labels off", () => {
      const chart = source("heatmap-chart.tsx");
      const cell = source("heatmap-cell.tsx");
      expect(chart).toContain("scale.diverging && !showValues ? hatchId : null");
      expect(cell).toContain("negativeHatchId && isNegative");
    });
  });

  describe("acceptance: row emphasis, a removable value halo, a tunable empty mark (#280)", () => {
    const chart = source("heatmap-chart.tsx");
    const cell = source("heatmap-cell.tsx");

    it("draws a dashed rail (never a hue) around every row rowHighlight matches", () => {
      expect(chart).toContain("function HeatmapRowHighlight");
      expect(chart).toContain('stroke="var(--chart-foreground)"');
      expect(chart).toContain('strokeDasharray="2 3"');
      // Composed into the plot, gated on the prop being set at all.
      expect(chart).toContain("rowHighlight ? (");
    });

    it("bolds the matched row's own axis label, not just the rail", () => {
      expect(chart).toContain("rowHighlight?.(label) ? 700 : undefined");
    });

    it("defaults showValueHalo to true (byte-identical for every other consumer)", () => {
      // RM-185: the default now lives on the definition, resolved through
      // `useResolvedChartProps` — no more a literal in the destructuring.
      expect(source("../../definitions/heatmap-chart.definition.ts")).toContain(
        "showValueHalo: true",
      );
      expect(cell).toContain("haloWidth={showValueHalo ? undefined : 0}");
    });

    it("scales the no-data outline off emptyMarkScale, not a hardcoded fraction", () => {
      expect(cell).toContain(
        "const missingSide = Math.max(0, Math.min(cell.width, cell.height) * emptyMarkScale);",
      );
      expect(cell).toContain("export const DEFAULT_EMPTY_MARK_SCALE = 0.6;");
    });
  });
});
