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
 *
 * `ChartParentSize` is replaced by a stand-in that reports `plot` — 0 × 0 by
 * default, what jsdom measures, so every test above keeps that limitation. The
 * RM-194 renamed-prop tests set a real size when they need the body (the
 * loading skeleton lives behind the size guard).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetWarnOnce, toJsonSchema } from "@elabs-ai/components-ui/definition";
import { HEATMAP_CHART } from "../../definitions/heatmap-chart.definition";
import { HeatmapChart as HeatmapChartDouble } from "../../test";
import { HeatmapChart } from "./heatmap-chart";

const plot = vi.hoisted(() => ({ width: 0, height: 0 }));
vi.mock("../chart-parent-size", async () => {
  const React = await import("react");
  return {
    ChartParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement("div", null, children({ width: plot.width, height: plot.height })),
  };
});

beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // The rendered body (RM-194 tests) plays its reveal off an IntersectionObserver.
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
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
        <HeatmapChart
          data={[]}
          empty={{ message: "Nothing yet." }}
          valueKey="count"
          x="hour"
          y="day"
        />,
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
          empty={{ action: <button type="button">Clear filters</button>, title: "No traffic" }}
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
      // RM-188: the rhythm is named in the one dash map (CHART_DASH.guide === "2 3").
      expect(chart).toContain("strokeDasharray={CHART_DASH.guide}");
      // Composed into the plot, gated on the prop being set at all.
      expect(chart).toContain("rowHighlight ? (");
    });

    it("bolds the matched row's own axis label, not just the rail", () => {
      expect(chart).toContain("rowHighlight?.(label) ? 700 : undefined");
    });

    it("defaults showValueHalo to true (byte-identical for every other consumer)", () => {
      // RM-185: the default now lives on the definition, resolved through
      // `useResolvedChartProps` (pinned by `DEFAULTS_GOLDEN.HeatmapChart` in
      // `definitions.test.ts`, not a source-string grep here — that pin
      // duplicated the golden fixture and was brittle to reformatting).
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

// ── RM-194: renamed props (ADR 0042 A.4 rows 17, 18, 20–22) ─────────────────

/** One render's markup, `useId` tokens renumbered so two renders compare. */
function markupOf(ui: ReactElement): string {
  const { container, unmount } = render(ui);
  const html = container.innerHTML;
  unmount();
  const ids = [...new Set(html.match(/_r_[0-9a-z]+_|«r[0-9a-z]+»|:r[0-9a-z]+:/g) ?? [])];
  return ids.reduce((out, id, i) => out.split(id).join(`@id${i}@`), html);
}

/** The `console.warn` calls that are deprecation warnings. */
const deprecations = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(([message]) => String(message).includes("is deprecated"));

describe("HeatmapChart renamed props (RM-194)", () => {
  const base = { valueKey: "count", x: "hour", y: "day" } as const;
  const action = <button type="button">Clear filters</button>;

  afterEach(() => {
    plot.width = 0;
    plot.height = 0;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // Each case: the old name, the new one, and the markup the old name must NOT produce
  // (the default), so "renders identically" is never two defaults compared.
  const rows = [
    {
      from: "showLegend",
      to: "legend",
      old: { data: punchCard, showLegend: false },
      next: { data: punchCard, legend: false },
    },
    {
      from: "loading",
      to: "status",
      old: { data: punchCard, loading: true },
      next: { data: punchCard, status: "loading" as const },
    },
    {
      from: "emptyTitle",
      to: "empty.title",
      old: { data: [], emptyTitle: "No traffic" },
      next: { data: [], empty: { title: "No traffic" } },
    },
    {
      from: "emptyMessage",
      to: "empty.message",
      old: { data: [], emptyMessage: "No traffic recorded." },
      next: { data: [], empty: { message: "No traffic recorded." } },
    },
    {
      from: "emptyAction",
      to: "empty.action",
      old: { data: [], emptyAction: action },
      next: { data: [], empty: { action } },
    },
    // RM-193 (ADR 0042 A.3 row 14) — not in RM-193's own `touches` list, but its own
    // acceptance criteria require deprecation coverage per family; flagged as a
    // deviation in the final report. `palette` defaults to "sequential" here, so the
    // default (neither name given) renders `labels: false` — distinct from both.
    {
      from: "showValues",
      to: "labels",
      old: { data: punchCard, showValues: true },
      next: { data: punchCard, labels: true },
    },
  ];

  it.each(rows)("$from renders exactly what $to renders", ({ old, next }) => {
    plot.width = 400;
    plot.height = 300;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const viaOld = markupOf(<HeatmapChart {...base} {...old} />);
    expect(viaOld).toBe(markupOf(<HeatmapChart {...base} {...next} />));
    expect(viaOld).not.toBe(markupOf(<HeatmapChart {...base} data={old.data} />));
  });

  it.each(rows)("$from warns once in development, naming $to", ({ from, to, old }) => {
    resetWarnOnce();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<HeatmapChart {...base} {...old} />).unmount();
    render(<HeatmapChart {...base} {...old} />).unmount();
    expect(deprecations(spy)).toEqual([
      [`[HeatmapChart] "${from}" is deprecated and will be removed in 6.0.0. Use "${to}".`],
    ]);
  });

  it.each(rows)("$from never warns in production", ({ old }) => {
    resetWarnOnce();
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<HeatmapChart {...base} {...old} />).unmount();
    expect(deprecations(spy)).toEqual([]);
  });

  it.each(rows)(
    "$from keeps the ./test double silent under the default deprecatedProps",
    ({ old }) => {
      resetWarnOnce();
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(<HeatmapChartDouble {...base} {...old} />).unmount();
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it('loading={true} and status="loading" draw the same skeleton at the same time', () => {
    plot.width = 400;
    plot.height = 300;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const viaOld = render(<HeatmapChart {...base} data={punchCard} loading />);
    const skeleton = viaOld.container.querySelector('[data-slot="heatmap-skeleton"]');
    expect(skeleton).not.toBeNull();
    const html = skeleton?.outerHTML;
    viaOld.unmount();
    const viaNew = render(<HeatmapChart {...base} data={punchCard} status="loading" />);
    expect(viaNew.container.querySelector('[data-slot="heatmap-skeleton"]')?.outerHTML).toBe(html);
  });

  it("lets the new name win when both are given (new-wins)", () => {
    plot.width = 400;
    plot.height = 300;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const legend = render(<HeatmapChart {...base} data={punchCard} legend={false} showLegend />);
    expect(legend.container.querySelector('[data-slot="heatmap-legend"]')).toBeNull();
    legend.unmount();
    const ready = render(<HeatmapChart {...base} data={punchCard} loading status="ready" />);
    expect(ready.container.querySelector('[data-slot="heatmap-skeleton"]')).toBeNull();
    ready.unmount();
    render(
      <HeatmapChart
        {...base}
        data={[]}
        empty={{ title: "New title", message: "New message" }}
        emptyMessage="Old message"
        emptyTitle="Old title"
      />,
    );
    expect(screen.getByRole("heading", { name: "New title" })).toBeInTheDocument();
    expect(screen.getByText("New message")).toBeInTheDocument();
    expect(screen.queryByText("Old message")).toBeNull();
  });

  it("says an old name was ignored when its new name is also given", () => {
    resetWarnOnce();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <HeatmapChart
        {...base}
        data={[]}
        legend
        showLegend={false}
        empty={{ title: "New title" }}
        emptyTitle="Old title"
        emptyMessage="Kept message"
      />,
    ).unmount();
    const ignored = (from: string, to: string) =>
      `[HeatmapChart] "${from}" is deprecated and will be removed in 6.0.0. Use "${to}". ` +
      `"${from}" was ignored because "${to}" is set.`;
    expect(deprecations(spy)).toEqual([
      [ignored("showLegend", "legend")],
      [ignored("emptyTitle", "empty.title")],
      [
        '[HeatmapChart] "emptyMessage" is deprecated and will be removed in 6.0.0. Use "empty.message".',
      ],
    ]);
  });

  it("showValues → labels: new-wins, and says which one was dropped", () => {
    plot.width = 400;
    plot.height = 300;
    resetWarnOnce();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // RM-193 review P2-8: this used to assert only the warning, never what actually
    // rendered — a mutation that dropped `new-wins` and kept `showValues` winning
    // instead would still have passed every assertion here.
    const { container } = render(
      <HeatmapChart {...base} data={punchCard} labels={false} showValues />,
    );
    expect(container.querySelectorAll('[data-slot="halo-text"]')).toHaveLength(0);
    expect(deprecations(spy)).toEqual([
      [
        '[HeatmapChart] "showValues" is deprecated and will be removed in 6.0.0. Use "labels". ' +
          '"showValues" was ignored because "labels" is set.',
      ],
    ]);
  });

  it("with neither `showValues` nor `labels`, keeps the palette-driven default (RM-193 acceptance)", () => {
    plot.width = 400;
    plot.height = 300;
    const sequential = render(<HeatmapChart {...base} data={punchCard} />);
    expect(sequential.container.querySelectorAll('[data-slot="halo-text"]')).toHaveLength(0);
    sequential.unmount();
    const diverging = render(<HeatmapChart {...base} data={punchCard} palette="diverging" />);
    expect(diverging.container.querySelectorAll('[data-slot="halo-text"]').length).toBeGreaterThan(
      0,
    );
  });

  it("`labels={{}}` (no `show` key) also keeps the palette-driven default, same as unset (re-review)", () => {
    plot.width = 400;
    plot.height = 300;
    const sequential = render(<HeatmapChart {...base} data={punchCard} labels={{}} />);
    expect(sequential.container.querySelectorAll('[data-slot="halo-text"]')).toHaveLength(0);
    sequential.unmount();
    const diverging = render(
      <HeatmapChart {...base} data={punchCard} labels={{}} palette="diverging" />,
    );
    expect(diverging.container.querySelectorAll('[data-slot="halo-text"]').length).toBeGreaterThan(
      0,
    );
  });

  it("leaves the code-only emptyAction out of the JSON Schema and types the other old names", () => {
    const properties = toJsonSchema(HEATMAP_CHART).properties as Record<string, unknown>;
    expect(properties).not.toHaveProperty("emptyAction");
    expect(properties).toMatchObject({
      showLegend: { type: "boolean", deprecated: true },
      emptyTitle: { type: "string", deprecated: true },
      emptyMessage: { type: "string", deprecated: true },
    });
  });

  it("merges an old empty name into a partial empty object, key by key", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <HeatmapChart {...base} data={[]} empty={{ message: "Only a message" }} emptyTitle="Old" />,
    );
    expect(screen.getByRole("heading", { name: "Old" })).toBeInTheDocument();
    expect(screen.getByText("Only a message")).toBeInTheDocument();
  });

  it("keeps the default title when only empty.message is set", () => {
    render(<HeatmapChart {...base} data={[]} empty={{ message: "Only a message" }} />);
    expect(screen.getByRole("heading", { name: "No data" })).toBeInTheDocument();
    expect(screen.getByText("Only a message")).toBeInTheDocument();
  });
});
