/**
 * RM-187: chart numbers, dates and words follow the `LocaleProvider`.
 *
 * Every family below renders under a de-DE provider that also supplies German
 * `charts.*` messages, and the test asserts German grouping/decimals, German
 * month names and the translated words that the moved strings read from the
 * ui catalogue. Three cases reach a site that used a module-level host-locale
 * date formatter before RM-187 (`shortDateFmt` in the BarChart datapoint
 * name, `weekdayDateFmt` in the ChartTooltip title, `hmsTimeFmt` on the live
 * time axis): each fails against the pre-RM-187 source, which printed the
 * host's en-US there. The time-axis ladder already read the provider before
 * RM-187, so the LineChart axis case alone proves nothing about those sites.
 * A second block proves the per-chart `messages` seam: one chart's override
 * changes that chart only, never a sibling.
 *
 * jsdom lacks layout, so the measurement seams are stubbed to a fixed box —
 * same harness as `chart-datapoint-names.test.tsx`.
 */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { LocaleProvider, type Messages } from "@elabs-ai/components-ui";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const BOX = vi.hoisted(() => ({ width: 640, height: 320 }));

vi.mock("./chart-parent-size", () => ({
  ChartParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => <>{children({ width: BOX.width, height: BOX.height })}</>,
}));

vi.mock("react-use-measure", () => ({
  default: () => [
    () => undefined,
    { ...BOX, top: 0, left: 0, right: BOX.width, bottom: BOX.height, x: 0, y: 0 },
  ],
}));

import { ChartFrame } from "../chart-frame";
import { GANTT_FIXTURE } from "../definitions/__fixtures__/gantt.fixture";
import { Gantt } from "../gantt/gantt";
import { installCanvasContextStub } from "../test/primitives";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { DistributionChart } from "./distribution/distribution-chart";
import { FunnelChart } from "./funnel-chart";
import { Gauge } from "./gauge";
import { HeatmapChart } from "./heatmap/heatmap-chart";
import { LineChart } from "./line-chart";
import { LiveLine } from "./live-line";
import { LiveLineChart } from "./live-line-chart";
import { LiveXAxis } from "./live-x-axis";
import { NetworkChart } from "./network/network-chart";
import { SankeyChart } from "./sankey/sankey-chart";
import { SankeyNode } from "./sankey/sankey-node";
import { SankeyThreadLinks } from "./sankey/sankey-threads";
import { TreeChart } from "./tree-chart";
import { WaterfallChart } from "./waterfall-chart";
import { XAxis } from "./x-axis";

beforeAll(() => {
  installCanvasContextStub();
  globalThis.ResizeObserver = class {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: {
              ...BOX,
              top: 0,
              left: 0,
              right: BOX.width,
              bottom: BOX.height,
              x: 0,
              y: 0,
            },
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    ...BOX,
    top: 0,
    left: 0,
    right: BOX.width,
    bottom: BOX.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => BOX.width,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => BOX.height,
  });
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
});

afterEach(cleanup);

/** The German words an app would hand the provider — keyed by the ui `charts.*` keys. */
const DE: Messages = {
  "charts.network.summary": "Netzwerk, {parts}",
  "charts.network.nodes": { one: "{count} Knoten", other: "{count} Knoten" },
  "charts.network.links": { one: "{count} Verbindung", other: "{count} Verbindungen" },
  "charts.network.groups": { one: "{count} Gruppe", other: "{count} Gruppen" },
  "charts.heatmap.grid": "{rows} Zeilen × {columns} Spalten",
  "charts.heatmap.summary": "Heatmap, {grid}, Spitze {value} bei {where}.",
  "charts.heatmap.legendSteps": "Farbskala: {count} Stufen von {lo} bis {hi}.",
  "charts.heatmap.legendMissing": "keine Daten",
  "charts.heatmap.missing": {
    one: "{count} Zelle ohne Daten.",
    other: "{count} Zellen ohne Daten.",
  },
  "charts.sankey.threads": "Pfade",
  "charts.sankey.nodeValue": "{value} Sitzungen",
  "charts.chartFrame.footerSource": "Quelle",
  "charts.chartFrame.footerGetTheData": "Daten abrufen",
  "charts.gauge.defaultLabel": "Gesamt",
};

function German({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider locale="de-DE" messages={DE}>
      {children}
    </LocaleProvider>
  );
}

const network = {
  links: [{ source: "a", target: "b" }],
  nodes: [
    { id: "a", label: "Alpha", value: 9, group: "one" },
    { id: "b", label: "Beta", value: 4, group: "one" },
  ],
};

const noop = () => {};

/** Stands in for `<Line>` where only the default tooltip matters. */
function SeriesStub(_props: { dataKey: string }) {
  return null;
}

/** Four March days (UTC midnight — the charts vitest config pins TZ=UTC). */
const marchDays = [6, 7, 8, 9].map((day, i) => ({
  day: new Date(Date.UTC(2026, 2, day)),
  users: 10 + i,
}));

const orgTree = {
  name: "Engineering",
  children: [
    { name: "Platform", children: [{ name: "CI" }, { name: "Infra" }] },
    { name: "Product", children: [{ name: "Billing" }] },
  ],
};

const threads = {
  nodes: [{ name: "Src A" }, { name: "Hub" }, { name: "Dst X" }],
  links: [{ source: 0, target: 1, value: 1234, path: ["Src A", "Hub", "Dst X"] }],
};

describe("de-DE LocaleProvider — German numbers, dates and words (RM-187)", () => {
  it("NetworkChart: the summary reads the German catalogue, plural forms included", () => {
    const { container } = render(
      <German>
        <NetworkChart layout="circular" {...network} />
      </German>,
    );
    expect(container.querySelector('[aria-label^="Netzwerk"]')?.getAttribute("aria-label")).toBe(
      "Netzwerk, 2 Knoten, 1 Verbindung, 1 Gruppe",
    );
  });

  it("HeatmapChart: summary and colour key print German words and decimals", async () => {
    const { container } = render(
      <German>
        <HeatmapChart
          data={[
            { day: "Mon", hour: "09", count: 4 },
            { day: "Mon", hour: "10", count: 7.5 },
            { day: "Tue", hour: "09", count: 2 },
          ]}
          valueKey="count"
          x="hour"
          y="day"
        />
      </German>,
    );
    await waitFor(() => expect(container.textContent).toContain("Farbskala"));
    expect(container.querySelector('[aria-label^="Heatmap"]')?.getAttribute("aria-label")).toBe(
      "Heatmap, 2 Zeilen × 2 Spalten, Spitze 7,5 bei Mon 10. 1 Zelle ohne Daten.",
    );
    expect(container.textContent).toContain("Farbskala: 5 Stufen von 2 bis 7,5.");
    expect(container.textContent).toContain("keine Daten");
  });

  it("SankeyChart: the node value and the threads layer read German", async () => {
    const { container } = render(
      <German>
        <SankeyChart data={threads} mode="threads">
          <SankeyThreadLinks />
          <SankeyNode />
        </SankeyChart>
      </German>,
    );
    await waitFor(() => expect(container.textContent).toContain("Sitzungen"));
    expect(container.textContent).toContain("1.234 Sitzungen");
    expect(container.querySelector('[aria-label="Pfade"]')).not.toBeNull();
  });

  it("WaterfallChart: bar labels and datapoint names group the German way", async () => {
    const { container } = render(
      <German>
        <WaterfallChart
          data={[
            { label: "Gross", value: 1000, kind: "total" },
            { label: "Refunds", value: -120 },
            { label: "Net", value: 880, kind: "total" },
          ]}
          onDatapointClick={() => {}}
        />
      </German>,
    );
    await waitFor(() => expect(container.textContent).toContain("1.000"));
    expect(container.querySelector('[aria-label="Gross: 1.000"]')).not.toBeNull();
  });

  it("DistributionChart: the value axis and the summary print German decimals and grouping", async () => {
    const { container } = render(
      <German>
        <DistributionChart
          data={[12, 18, 30, 44, 51, 1200].map((minutes, i) => ({
            team: i % 2 ? "Core" : "Edge",
            minutes,
          }))}
          groupKey="team"
          kind="box"
          valueKey="minutes"
        />
      </German>,
    );
    await waitFor(() => expect(container.textContent).toContain("1.000"));
    expect(container.textContent).toContain("1.200");
    expect(container.textContent).toContain("19,5");
  });

  it("LineChart: the time axis prints German month names", () => {
    const { container } = render(
      <German>
        <LineChart
          data={[
            { date: new Date("2024-01-01"), value: 5 },
            { date: new Date("2024-03-01"), value: 3 },
          ]}
        >
          <XAxis tickValues={[new Date("2024-01-15"), new Date("2024-03-10")]} />
        </LineChart>
      </German>,
    );
    expect(container.textContent).toContain("März");
    expect(container.textContent).not.toContain("Mar");
  });

  // ── Sites that used a module-level host-locale formatter before RM-187 ──────
  // Each of these printed the host's en-US ("Mar 9", "Mon, Mar 9", "14:30:05")
  // under any provider before RM-187; they fail against that source.

  it("BarChart: a Date category's datapoint name uses the provider's short date (was shortDateFmt)", () => {
    const { container } = render(
      <German>
        <BarChart data={marchDays} onDatapointClick={noop} xDataKey="day">
          <Bar dataKey="users" />
        </BarChart>
      </German>,
    );
    const names = [...container.querySelectorAll('[data-slot="chart-datapoint-layer-target"]')].map(
      (target) => target.getAttribute("aria-label") ?? "",
    );
    expect(names.some((name) => name.includes("9. März"))).toBe(true);
    expect(names.some((name) => name.includes("Mar 9"))).toBe(false);
  });

  it("ChartTooltip: a time-axis title uses the provider's weekday date (was weekdayDateFmt)", async () => {
    const { container } = render(
      <German>
        <LineChart animationDuration={0} data={marchDays} xDataKey="day">
          <SeriesStub dataKey="users" />
        </LineChart>
      </German>,
    );
    fireEvent.mouseMove(container.querySelector("svg > g") as SVGGElement, {
      clientX: 600,
      clientY: 120,
    });
    const box = await waitFor(() => {
      const found = container.querySelector('[data-slot="chart-tooltip-box"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    // German short weekday ("Mo.") + day-before-month ("9. März").
    expect(box.textContent).toMatch(/(Mo|Di|Mi|Do|Fr|Sa|So)\., \d{1,2}\. März/);
  });

  it("LiveXAxis: the default time labels use the provider's time format (was hmsTimeFmt)", () => {
    // de-DE and en-US both print 24-hour "14:30:05"; fi-FI separates with dots,
    // so it is the locale that tells the provider's format from the host's.
    const now = Math.floor(Date.now() / 1000);
    const { container } = render(
      <LocaleProvider locale="fi-FI">
        <LiveLineChart
          data={Array.from({ length: 10 }, (_, i) => ({ time: now - (9 - i), value: 50 + i }))}
          value={59}
        >
          <LiveLine dataKey="value" />
          <LiveXAxis />
        </LiveLineChart>
      </LocaleProvider>,
    );
    const labels = [...container.querySelectorAll(".text-chart-label")].map((l) => l.textContent);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label).toMatch(/^\d{2}\.\d{2}\.\d{2}$/);
  });

  it("ChartFrame and Gauge: footer and centre label read the catalogue", () => {
    const { container } = render(
      <German>
        <ChartFrame actions={["data"]} data={[{ a: 1 }]} source="Acme" title="Umsatz">
          <div />
        </ChartFrame>
        <Gauge centerValue={50} height={200} value={50} width={300} />
      </German>,
    );
    expect(container.textContent).toContain("Quelle: Acme");
    expect(container.textContent).toContain("Daten abrufen");
    expect(container.textContent).toContain("Gesamt");
  });

  it("FunnelChart: its own locale prop wins with no provider at all", () => {
    const { container } = render(
      <FunnelChart
        data={[
          { label: "Visitors", value: 12000 },
          { label: "Signups", value: 4800 },
        ]}
        locale="de-DE"
      />,
    );
    expect(container.textContent).toContain("12.000");
    expect(container.textContent).toContain("4.800");
  });
});

describe("per-chart messages — one chart's word, never a sibling's (RM-187)", () => {
  it("a component word (Sankey node value): the override changes that chart only", async () => {
    const { getByTestId } = render(
      <>
        <div data-testid="own">
          <SankeyChart
            data={threads}
            messages={{ "charts.sankey.nodeValue": "{value} visits" }}
            mode="threads"
          >
            <SankeyNode />
          </SankeyChart>
        </div>
        <div data-testid="sibling">
          <SankeyChart data={threads} mode="threads">
            <SankeyNode />
          </SankeyChart>
        </div>
      </>,
    );
    await waitFor(() => expect(getByTestId("own").textContent).toContain("visits"));
    expect(getByTestId("own").textContent).toContain("1,234 visits");
    expect(getByTestId("own").textContent).not.toContain("sessions");
    expect(getByTestId("sibling").textContent).toContain("1,234 sessions");
    expect(getByTestId("sibling").textContent).not.toContain("visits");
  });

  it("the shared datapoint layer's name: the override renames that chart's layer only", () => {
    const waterfall = [
      { label: "Gross", value: 1000, kind: "total" as const },
      { label: "Net", value: 880, kind: "total" as const },
    ];
    const { getByTestId } = render(
      <>
        <div data-testid="own">
          <WaterfallChart
            data={waterfall}
            messages={{ "charts.datapointLayer.label": "Datenpunkte" }}
            onDatapointClick={noop}
          />
        </div>
        <div data-testid="sibling">
          <WaterfallChart data={waterfall} onDatapointClick={noop} />
        </div>
      </>,
    );
    const layer = (id: string) =>
      getByTestId(id)
        .querySelector('[data-slot="chart-datapoint-layer"]')
        ?.getAttribute("aria-label");
    expect(layer("own")).toBe("Datenpunkte");
    expect(layer("sibling")).toBe("Chart data points");
  });

  it("TreeChart: the override reaches the tree's toggle names, that chart only", () => {
    const { getByTestId } = render(
      <>
        <div data-testid="own">
          <TreeChart
            data={orgTree}
            messages={{ "charts.treeChart.collapse": "Zuklappen: {name}" }}
            onDatapointClick={noop}
          />
        </div>
        <div data-testid="sibling">
          <TreeChart data={orgTree} onDatapointClick={noop} />
        </div>
      </>,
    );
    expect(
      getByTestId("own").querySelector('[aria-label="Zuklappen: Engineering"]'),
    ).not.toBeNull();
    expect(
      getByTestId("own").querySelector('[aria-label="Hide children of Engineering"]'),
    ).toBeNull();
    expect(
      getByTestId("sibling").querySelector('[aria-label="Hide children of Engineering"]'),
    ).not.toBeNull();
  });

  it("Gantt: the override reaches the timeline and task-list names, that chart only", () => {
    const { getByTestId } = render(
      <>
        <div data-testid="own">
          <Gantt
            {...GANTT_FIXTURE.props}
            messages={{ "charts.gantt.timeline": "Zeitachse", "charts.gantt.taskList": "Aufgaben" }}
          />
        </div>
        <div data-testid="sibling">
          <Gantt {...GANTT_FIXTURE.props} />
        </div>
      </>,
    );
    expect(getByTestId("own").querySelector('[aria-label="Zeitachse"]')).not.toBeNull();
    expect(getByTestId("own").querySelector('[aria-label="Aufgaben"]')).not.toBeNull();
    expect(getByTestId("sibling").querySelector('[aria-label="Timeline"]')).not.toBeNull();
    expect(getByTestId("sibling").querySelector('[aria-label="Task list"]')).not.toBeNull();
  });

  it("a pure summary (Network): the override reaches the summary of that chart only", () => {
    const { getByTestId } = render(
      <German>
        <div data-testid="own">
          <NetworkChart
            layout="circular"
            messages={{ "charts.network.summary": "Graph: {parts}" }}
            {...network}
          />
        </div>
        <div data-testid="sibling">
          <NetworkChart layout="circular" {...network} />
        </div>
      </German>,
    );
    const label = (id: string) =>
      getByTestId(id).querySelector('[aria-label*="Knoten"]')?.getAttribute("aria-label");
    // The override replaces only its own key; the parts still read the provider.
    expect(label("own")).toBe("Graph: 2 Knoten, 1 Verbindung, 1 Gruppe");
    expect(label("sibling")).toBe("Netzwerk, 2 Knoten, 1 Verbindung, 1 Gruppe");
  });
});
