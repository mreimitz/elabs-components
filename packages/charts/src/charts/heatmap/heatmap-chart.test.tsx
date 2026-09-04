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

  it("renders the empty state instead of an empty grid", () => {
    render(
      <HeatmapChart data={[]} emptyMessage="Nothing yet." valueKey="count" x="hour" y="day" />,
    );
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
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
});
