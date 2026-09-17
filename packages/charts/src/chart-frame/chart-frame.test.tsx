import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { ChartFrame, type ChartFrameProps } from "./chart-frame";
import { Bar } from "../charts/bar";
import { BarChart } from "../charts/bar-chart";
import { BarXAxis } from "../charts/bar-x-axis";
import { ChartLegend } from "../charts/chart-legend";
import { ChartTooltip } from "../charts/tooltip";

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

const sampleData = [
  { month: "Jan", revenue: 400 },
  { month: "Feb", revenue: 600 },
  { month: "Mar", revenue: 500 },
];

describe("ChartFrame toolbar controls", () => {
  it("renders all three controls by default when data is provided", () => {
    render(
      <ChartFrame title="Test" data={sampleData}>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.getByLabelText("Expand chart")).toBeInTheDocument();
    expect(screen.getByLabelText("Flip to table view")).toBeInTheDocument();
    expect(screen.getByLabelText("Download CSV")).toBeInTheDocument();
  });

  it("hides table and download when data is absent (feature degradation)", () => {
    render(
      <ChartFrame title="No data">
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.getByLabelText("Expand chart")).toBeInTheDocument();
    expect(screen.queryByLabelText("Flip to table view")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Download CSV")).not.toBeInTheDocument();
  });

  it("only renders controls listed in features prop", () => {
    render(
      <ChartFrame title="Limited" data={sampleData} features={["expand"]}>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.getByLabelText("Expand chart")).toBeInTheDocument();
    expect(screen.queryByLabelText("Flip to table view")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Download CSV")).not.toBeInTheDocument();
  });
});

describe("ChartFrame expand", () => {
  it("opens a dialog when Expand is clicked", () => {
    render(
      <ChartFrame title="Expand test" data={sampleData}>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Expand chart"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ChartFrame flip to table", () => {
  it("toggles to table view and shows column headers", () => {
    render(
      <ChartFrame title="Table test" data={sampleData}>
        <div>chart content</div>
      </ChartFrame>,
    );
    // Chart is shown initially
    expect(screen.getByText("chart content")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Flip to table view"));

    // Table column headers derived from data keys
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("month")).toBeInTheDocument();
    expect(screen.getByText("revenue")).toBeInTheDocument();
    // Data is rendered in the table
    expect(screen.getByText("Jan")).toBeInTheDocument();
  });

  it("uses custom column headers when columns prop is provided", () => {
    render(
      <ChartFrame
        title="Custom columns"
        data={sampleData}
        columns={[
          { key: "month", header: "Month" },
          { key: "revenue", header: "Revenue ($)" },
        ]}
      >
        <div>chart</div>
      </ChartFrame>,
    );
    fireEvent.click(screen.getByLabelText("Flip to table view"));
    expect(screen.getByText("Month")).toBeInTheDocument();
    expect(screen.getByText("Revenue ($)")).toBeInTheDocument();
  });
});

describe("ChartFrame download", () => {
  it("calls onDownload with rows and columns when Download is clicked", () => {
    const onDownload = vi.fn();
    render(
      <ChartFrame title="Download test" data={sampleData} onDownload={onDownload}>
        <div>chart</div>
      </ChartFrame>,
    );
    fireEvent.click(screen.getByLabelText("Download CSV"));
    expect(onDownload).toHaveBeenCalledOnce();
    expect(onDownload).toHaveBeenCalledWith(
      sampleData,
      expect.arrayContaining([
        expect.objectContaining({ key: "month" }),
        expect.objectContaining({ key: "revenue" }),
      ]),
    );
  });
});

// Loading vs ready (#268): a layout-shaped skeleton replaces the chart body, the
// toolbar is suppressed (meaningless with no data yet), and the region announces
// once via a single role="status" live region.
describe("ChartFrame loading", () => {
  it("renders a skeleton instead of the chart content", () => {
    render(
      <ChartFrame title="Loading test" data={sampleData} loading>
        <div>chart content</div>
      </ChartFrame>,
    );
    expect(screen.queryByText("chart content")).not.toBeInTheDocument();
  });

  it("suppresses the expand/flip-to-table/download toolbar while loading", () => {
    render(
      <ChartFrame title="Loading test" data={sampleData} loading>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.queryByLabelText("Expand chart")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Flip to table view")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Download CSV")).not.toBeInTheDocument();
  });

  it("renders exactly one status live region for the not-ready state", () => {
    render(
      <ChartFrame title="Loading test" loading>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("renders the real content (no status region, full toolbar) when not loading", () => {
    render(
      <ChartFrame title="Ready test" data={sampleData}>
        <div>chart content</div>
      </ChartFrame>,
    );
    expect(screen.getByText("chart content")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Expand chart")).toBeInTheDocument();
  });
});

// Card contract source row (RM-019): a fourth, optional attribution part —
// inline, in the expand modal, and (for a plain string) in the CSV download.
describe("ChartFrame source", () => {
  it("renders the source row inline when provided", () => {
    render(
      <ChartFrame title="Revenue" data={sampleData} source="Source: Internal analytics">
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.getByText("Source: Internal analytics")).toBeInTheDocument();
  });

  it("renders no source row when absent", () => {
    render(
      <ChartFrame title="Revenue" data={sampleData}>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.queryByText(/source/i)).not.toBeInTheDocument();
  });

  it("also shows the source row inside the expand modal", () => {
    render(
      <ChartFrame title="Revenue" data={sampleData} source="Source: Internal analytics">
        <div>chart</div>
      </ChartFrame>,
    );
    fireEvent.click(screen.getByLabelText("Expand chart"));
    // Two occurrences now: the inline card footer + the modal's view pane.
    expect(screen.getAllByText("Source: Internal analytics")).toHaveLength(2);
  });

  // #184 W0-10: the row rides with the chart in both containers now, never
  // appended to the summary statistics pane, and behaves the same way
  // (truncate + recoverable-on-overflow) in both.
  it("attaches the modal's source row to the view pane, not the summary/detail pane", () => {
    render(
      <ChartFrame title="Revenue" data={sampleData} source="Source: Internal analytics">
        <div>chart</div>
      </ChartFrame>,
    );
    fireEvent.click(screen.getByLabelText("Expand chart"));

    // The dialog renders through a portal, outside the render `container`.
    const viewPane = document.querySelector('[data-slot="expand-dialog-view"]');
    const detailPane = document.querySelector('[data-slot="expand-dialog-detail"]');
    expect(viewPane).toHaveTextContent("Source: Internal analytics");
    expect(detailPane).not.toHaveTextContent("Source: Internal analytics");
    // The detail pane keeps showing its usual data summary, untouched.
    expect(detailPane).toHaveTextContent("Rows:");
  });

  // #184: a source that overflows its row must stay recoverable in full — by
  // hover (native `title`) at minimum, by keyboard once it measurably
  // overflows — identically inline and inside the expand modal.
  describe("overflow recovery (#184)", () => {
    const longSource =
      "Source: Internal analytics platform, aggregated nightly from three regional warehouses";

    it("sets a native title on a string source in both the card footer and the modal", () => {
      render(
        <ChartFrame title="Revenue" data={sampleData} source={longSource}>
          <div>chart</div>
        </ChartFrame>,
      );
      fireEvent.click(screen.getByLabelText("Expand chart"));
      for (const row of screen.getAllByText(longSource)) {
        expect(row).toHaveAttribute("title", longSource);
      }
    });

    it("adds no tab stop for a source that fits its row", () => {
      render(
        <ChartFrame title="Revenue" data={sampleData} source="Short source">
          <div>chart</div>
        </ChartFrame>,
      );
      expect(screen.getByText("Short source")).not.toHaveAttribute("tabindex");
    });

    it("gains a tab stop and a keyboard-reachable tooltip once the inline row measurably overflows", () => {
      const { rerender } = render(
        <ChartFrame title="Revenue" data={sampleData} source={longSource}>
          <div>chart</div>
        </ChartFrame>,
      );
      const row = screen.getByText(longSource);
      // jsdom never lays out real text, so overflow is simulated — same idiom
      // as `packages/ui/src/components/table/table.test.tsx`.
      Object.defineProperty(row, "scrollWidth", { configurable: true, value: 900 });
      Object.defineProperty(row, "clientWidth", { configurable: true, value: 240 });
      rerender(
        <ChartFrame title="Revenue" data={sampleData} source={longSource}>
          <div>chart</div>
        </ChartFrame>,
      );
      expect(row).toHaveAttribute("tabindex", "0");
      fireEvent.focus(row);
      const describedBy = row.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent(longSource);
    });
  });

  it("appends a trailing '# source: …' comment row to the downloaded CSV", () => {
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
    let captured = "";
    const OriginalBlob = global.Blob;
    // @ts-expect-error minimal test stub — only the constructor is exercised
    global.Blob = class {
      constructor(parts: BlobPart[]) {
        captured = parts.join("");
      }
    };
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <ChartFrame title="Revenue" data={sampleData} source="Internal analytics, updated daily">
        <div>chart</div>
      </ChartFrame>,
    );
    fireEvent.click(screen.getByLabelText("Download CSV"));

    expect(captured).toContain("# source: Internal analytics, updated daily");

    clickSpy.mockRestore();
    global.Blob = OriginalBlob;
  });

  it("does not quote a plain negative number as a CSV-injection risk", () => {
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
    let captured = "";
    const OriginalBlob = global.Blob;
    // @ts-expect-error minimal test stub — only the constructor is exercised
    global.Blob = class {
      constructor(parts: BlobPart[]) {
        captured = parts.join("");
      }
    };
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <ChartFrame title="Revenue" data={[{ delta: -12 }]}>
        <div>chart</div>
      </ChartFrame>,
    );
    fireEvent.click(screen.getByLabelText("Download CSV"));

    expect(captured).toContain("-12");
    expect(captured).not.toContain("'-12");

    clickSpy.mockRestore();
    global.Blob = OriginalBlob;
  });

  it("defers revoking the object URL past the click (Safari-safe)", () => {
    vi.useFakeTimers();
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    const revokeSpy = vi.fn();
    global.URL.revokeObjectURL = revokeSpy;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <ChartFrame title="Revenue" data={sampleData}>
        <div>chart</div>
      </ChartFrame>,
    );
    fireEvent.click(screen.getByLabelText("Download CSV"));

    // Not revoked synchronously — the click handler must have returned first.
    expect(revokeSpy).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock");

    clickSpy.mockRestore();
    vi.useRealTimers();
  });
});

// SVG/PNG export (RM-042): export-svg/export-png degrade the same way
// table/download degrade without data — except the condition is a rendered
// `<svg>` (registered by ChartFrameInner after mount), not `data`. A plain
// `<div>` placeholder — what every other test in this file renders as
// `children` — has no `<svg>`, so those tests already double as "hidden
// without a chart" coverage; this block makes that explicit and covers the
// export actions themselves.
//
// var(--…) resolution genuinely needs a browser (`getComputedStyle` doesn't
// resolve CSS custom properties under jsdom — see export-svg.ts's module
// doc) — that assertion lives in the `Export` Storybook story instead. These
// tests cover the parts that are deterministic under jsdom: control
// visibility, the default download path, and the `onExport` seam.
function FakeChartSvg() {
  return (
    <svg data-testid="fake-chart" width={200} height={100}>
      <rect width={200} height={100} fill="var(--chart-1)" />
    </svg>
  );
}

describe("ChartFrame export controls (RM-042)", () => {
  it("shows export-svg/export-png once the chart body renders an <svg>", () => {
    render(
      <ChartFrame title="Test" data={sampleData}>
        <FakeChartSvg />
      </ChartFrame>,
    );
    expect(screen.getByLabelText("Export as SVG")).toBeInTheDocument();
    expect(screen.getByLabelText("Export as PNG")).toBeInTheDocument();
  });

  it("hides export-svg/export-png for a non-svg placeholder", () => {
    render(
      <ChartFrame title="Test" data={sampleData}>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.queryByLabelText("Export as SVG")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Export as PNG")).not.toBeInTheDocument();
  });

  it("hides export-svg/export-png once flipped to table view (the <svg> unmounts)", () => {
    render(
      <ChartFrame title="Test" data={sampleData}>
        <FakeChartSvg />
      </ChartFrame>,
    );
    expect(screen.getByLabelText("Export as SVG")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Flip to table view"));
    expect(screen.queryByLabelText("Export as SVG")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Export as PNG")).not.toBeInTheDocument();
  });

  it("honours a features list that excludes export-png", () => {
    render(
      <ChartFrame title="Test" data={sampleData} features={["expand", "export-svg"]}>
        <FakeChartSvg />
      </ChartFrame>,
    );
    expect(screen.getByLabelText("Export as SVG")).toBeInTheDocument();
    expect(screen.queryByLabelText("Export as PNG")).not.toBeInTheDocument();
  });

  it("downloads a self-contained SVG file (with a <rect> background) by default", () => {
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
    let capturedText = "";
    let capturedType = "";
    let capturedFilename = "";
    const OriginalBlob = global.Blob;
    // @ts-expect-error minimal test stub — only the constructor is exercised
    global.Blob = class {
      type: string;
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        capturedText = parts.join("");
        capturedType = options?.type ?? "";
        this.type = capturedType;
      }
    };
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      capturedFilename = this.download;
    });

    render(
      <ChartFrame title="Revenue is up" data={sampleData}>
        <FakeChartSvg />
      </ChartFrame>,
    );
    fireEvent.click(screen.getByLabelText("Export as SVG"));

    expect(capturedType).toContain("image/svg+xml");
    expect(capturedText).toContain("<rect");
    expect(capturedText).toContain("<svg");
    expect(capturedFilename).toBe("revenue-is-up.svg");
    expect(clickSpy).toHaveBeenCalledOnce();

    clickSpy.mockRestore();
    global.Blob = OriginalBlob;
  });

  it("routes the export to onExport instead of downloading, when provided", () => {
    const onExport = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <ChartFrame title="Revenue" data={sampleData} onExport={onExport}>
        <FakeChartSvg />
      </ChartFrame>,
    );
    fireEvent.click(screen.getByLabelText("Export as SVG"));

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledWith("svg", expect.any(Blob), "revenue.svg");
    // The onExport seam replaces the local download — no anchor click.
    expect(clickSpy).not.toHaveBeenCalled();

    clickSpy.mockRestore();
  });
});

// RM-072: byte-identical default DOM. Both snapshots were recorded BEFORE
// `chrome` / `interactions` / `density` existed — a diff here means the
// no-new-props path changed, which the RM forbids (the #349 guarantee).
const snapshotBarData = [
  { region: "North", revenue: 400 },
  { region: "South", revenue: 600 },
  { region: "East", revenue: 500 },
];

/** `useId` output depends on how many tests rendered before — not on the DOM shape. */
const normalizeIds = (html: string) => html.replaceAll(/_r_[a-z0-9]+_/g, "_r_ID_");

const PRE_CHANGE_FRAME_DOM =
  '<div data-slot="card" class="rounded-lg border bg-card text-card-foreground shadow-sm flex flex-col"><div data-slot="card-header" class="p-6 flex flex-row items-start justify-between gap-2 space-y-0 pb-2"><div class="space-y-1"><div data-slot="card-title" class="text-base">Snapshot</div><p data-slot="card-description" class="text-body text-balance text-muted-foreground">Desc</p></div><div class="flex items-center gap-1"><button type="button" aria-pressed="false" data-state="closed" data-slot="toggle" class="inline-flex items-center justify-center gap-2 rounded-control text-body font-control transition-colors duration-fast ease-standard hover:bg-muted hover:text-muted-foreground focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:font-semibold aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-semibold aria-checked:bg-accent aria-checked:text-accent-foreground aria-checked:font-semibold [&amp;_svg]:size-4 [&amp;_svg]:shrink-0 border border-transparent bg-transparent data-[state=on]:border-primary aria-pressed:border-primary aria-checked:border-primary h-control-sm px-2 min-w-control-sm" aria-label="Flip to table view"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-table" aria-hidden="true"><path d="M12 3v18"></path><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 9h18"></path><path d="M3 15h18"></path></svg></button><button class="inline-flex items-center justify-center gap-2 whitespace-nowrap touch-manipulation rounded-control text-body font-control transition-[color,background-color,border-color,box-shadow,scale] duration-fast ease-standard active:scale-[0.98] motion-reduce:active:scale-100 focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:size-4 [&amp;_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground size-control-sm" type="button" aria-label="Download CSV" data-state="closed"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download" aria-hidden="true"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg></button><button class="inline-flex items-center justify-center gap-2 whitespace-nowrap touch-manipulation rounded-control text-body font-control transition-[color,background-color,border-color,box-shadow,scale] duration-fast ease-standard active:scale-[0.98] motion-reduce:active:scale-100 focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:size-4 [&amp;_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground size-control-sm" type="button" aria-label="Expand chart" data-state="closed"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-maximize2 lucide-maximize-2" aria-hidden="true"><path d="M15 3h6v6"></path><path d="m21 3-7 7"></path><path d="m3 21 7-7"></path><path d="M9 21H3v-6"></path></svg></button></div></div><div data-slot="card-content" class="p-6 flex-1 pt-0"><div style="height: 260px;" class="w-full overflow-auto"><div class="size-full animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"><div>chart</div></div></div></div><div data-slot="card-footer" class="flex items-center p-6 pt-0 pb-3"><p title="Source: test" class="truncate text-chart-foreground-muted uppercase w-full" data-state="closed">Source: test</p></div></div>';

const PRE_CHANGE_BAR_DOM =
  '<div class="relative w-full" style="aspect-ratio: 2 / 1;"><div data-testid="parent-size"><svg aria-hidden="true" height="288" width="560"><rect fill="transparent" height="288" width="560" x="0" y="0"></rect><g style="cursor: default;" transform="translate(40,40)"><rect fill="transparent" height="208" width="480" x="0" y="0"></rect><g class="bar-series-_r_ID_"><g opacity="1" style="transition: opacity var(--t-fast) var(--ease-standard);"><rect fill="var(--chart-1)" rx="4" ry="4" width="120px" height="0px" style="transform: translateX(30px) translateY(208px); transform-origin: 50% 50%; transform-box: fill-box;"></rect></g><g opacity="1" style="transition: opacity var(--t-fast) var(--ease-standard);"><rect fill="var(--chart-1)" rx="4" ry="4" width="120px" height="0px" style="transform: translateX(180px) translateY(208px); transform-origin: 50% 50%; transform-box: fill-box;"></rect></g><g opacity="1" style="transition: opacity var(--t-fast) var(--ease-standard);"><rect fill="var(--chart-1)" rx="4" ry="4" width="120px" height="0px" style="transform: translateX(330px) translateY(208px); transform-origin: 50% 50%; transform-box: fill-box;"></rect></g></g></g></svg></div><div class="pointer-events-none absolute inset-0"><div class="absolute flex justify-center" style="left: 130px; width: 0px; bottom: 12px;"><span class="whitespace-nowrap text-chart-label text-meta" style="opacity: 1;">North</span></div><div class="absolute flex justify-center" style="left: 280px; width: 0px; bottom: 12px;"><span class="whitespace-nowrap text-chart-label text-meta" style="opacity: 1;">South</span></div><div class="absolute flex justify-center" style="left: 430px; width: 0px; bottom: 12px;"><span class="whitespace-nowrap text-chart-label text-meta" style="opacity: 1;">East</span></div></div></div>';

describe("ChartFrame default DOM (RM-072 pre-change snapshot)", () => {
  it("ChartFrame with no new props is byte-identical", async () => {
    const { container } = render(
      <ChartFrame title="Snapshot" description="Desc" data={sampleData} source="Source: test">
        <div>chart</div>
      </ChartFrame>,
    );
    expect(normalizeIds(container.innerHTML)).toBe(PRE_CHANGE_FRAME_DOM);
  });

  it("BarChart with no interactions is byte-identical", async () => {
    const { container } = render(
      <BarChart data={snapshotBarData} xDataKey="region" animationDuration={0}>
        <Bar dataKey="revenue" fill="var(--chart-1)" />
        <BarXAxis />
      </BarChart>,
    );
    await act(async () => {});
    expect(normalizeIds(container.innerHTML)).toBe(PRE_CHANGE_BAR_DOM);
  });
});

// ---------------------------------------------------------------------------
// RM-072 behaviour: interactions, density tiers, tile / bare chrome.
// ---------------------------------------------------------------------------

const TARGET = '[data-slot="chart-datapoint-layer-target"]';
const PAINTED_TICK = ".text-chart-label.text-meta";

const twelveMonths = Array.from({ length: 12 }, (_, i) => ({
  month: `M${i + 1}`,
  revenue: 100 + i * 10,
}));

describe("ChartFrame interactions (RM-072)", () => {
  it("passive:false renders the same chart DOM as a chart with no tooltip at all", async () => {
    const plain = render(
      <BarChart data={snapshotBarData} xDataKey="region" animationDuration={0}>
        <Bar dataKey="revenue" fill="var(--chart-1)" />
      </BarChart>,
    );
    await act(async () => {});
    const withoutTooltip = normalizeIds(plain.container.innerHTML);
    plain.unmount();

    const withTooltip = render(
      <BarChart data={snapshotBarData} xDataKey="region" animationDuration={0}>
        <Bar dataKey="revenue" fill="var(--chart-1)" />
        <ChartTooltip />
      </BarChart>,
    );
    await act(async () => {});
    const tooltipDom = normalizeIds(withTooltip.container.innerHTML);
    withTooltip.unmount();
    // Sanity: with passive on (the default) the tooltip adds DOM.
    expect(tooltipDom).not.toBe(withoutTooltip);

    const passiveOff = render(
      <ChartFrame title="t" chrome="bare" interactions={{ passive: false }}>
        <BarChart data={snapshotBarData} xDataKey="region" animationDuration={0}>
          <Bar dataKey="revenue" fill="var(--chart-1)" />
          <ChartTooltip />
        </BarChart>
      </ChartFrame>,
    );
    await act(async () => {});
    const chartRoot = passiveOff.container.querySelector(
      '[data-testid="parent-size"]',
    )?.parentElement;
    expect(normalizeIds(chartRoot?.outerHTML ?? "")).toBe(withoutTooltip);
  });

  it("active:false removes the datapoint layer buttons", () => {
    const { container } = render(
      <ChartFrame title="t" interactions={{ active: false }}>
        <BarChart data={snapshotBarData} xDataKey="region" onDatapointClick={() => {}}>
          <Bar dataKey="revenue" />
        </BarChart>
      </ChartFrame>,
    );
    expect(container.querySelectorAll(TARGET)).toHaveLength(0);
    expect(container.querySelector('[data-slot="chart-datapoint-layer"]')).toBeNull();
  });

  it("select:false keeps the layer but never calls onDatapointClick (click or Enter)", () => {
    const onDatapointClick = vi.fn();
    const { container } = render(
      <ChartFrame title="t" interactions={{ select: false }}>
        <BarChart data={snapshotBarData} xDataKey="region" onDatapointClick={onDatapointClick}>
          <Bar dataKey="revenue" />
        </BarChart>
      </ChartFrame>,
    );
    const targets = container.querySelectorAll<HTMLButtonElement>(TARGET);
    expect(targets.length).toBeGreaterThan(0);
    const first = targets[0] as HTMLButtonElement;
    fireEvent.click(first);
    // `detail: 0` is what the platform reports for Enter/Space on a button.
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.click(first, { detail: 0 });
    const bars = container.querySelectorAll("svg rect:not([fill='transparent'])");
    fireEvent.click(bars[0] as Element);
    expect(onDatapointClick).not.toHaveBeenCalled();
  });

  it("select defaults to true inside a frame", () => {
    const onDatapointClick = vi.fn();
    const { container } = render(
      <ChartFrame title="t">
        <BarChart data={snapshotBarData} xDataKey="region" onDatapointClick={onDatapointClick}>
          <Bar dataKey="revenue" />
        </BarChart>
      </ChartFrame>,
    );
    fireEvent.click(container.querySelector(TARGET) as HTMLButtonElement, { detail: 0 });
    expect(onDatapointClick).toHaveBeenCalledTimes(1);
  });
});

describe("ChartFrame density (RM-072)", () => {
  const legendItems = [{ label: "Revenue", value: 1, color: "var(--chart-1)" }];

  function renderAt(density: "xs" | "sm" | "md") {
    return render(
      <ChartFrame title="Revenue" description="Monthly" source="Source: ledger" density={density}>
        <BarChart data={twelveMonths} xDataKey="month" animationDuration={0}>
          <Bar dataKey="revenue" />
          <BarXAxis />
        </BarChart>
        <ChartLegend items={legendItems} />
      </ChartFrame>,
    );
  }

  it("xs: no axis text, no legend, no description, no source row", () => {
    const { container } = renderAt("xs");
    expect(container.querySelectorAll(PAINTED_TICK)).toHaveLength(0);
    expect(container.querySelectorAll("svg text")).toHaveLength(0);
    expect(container.querySelector(".legend-container")).toBeNull();
    expect(screen.queryByText("Monthly")).not.toBeInTheDocument();
    expect(screen.queryByText("Source: ledger")).not.toBeInTheDocument();
  });

  it("sm: at most 4 category ticks and no legend", () => {
    const { container } = renderAt("sm");
    const ticks = container.querySelectorAll(PAINTED_TICK);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThanOrEqual(4);
    expect(container.querySelector(".legend-container")).toBeNull();
  });

  it("md: every tick, the legend, description and source row", () => {
    const { container } = renderAt("md");
    expect(container.querySelectorAll(PAINTED_TICK)).toHaveLength(12);
    expect(container.querySelector(".legend-container")).not.toBeNull();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Source: ledger")).toBeInTheDocument();
  });
});

describe("ChartFrame density toolbar (#444)", () => {
  function renderToolbarAt(density: "xs" | "sm" | "md", features?: ChartFrameProps["features"]) {
    return render(
      <ChartFrame
        title="Revenue"
        chrome="tile"
        density={density}
        data={sampleData}
        features={features}
      >
        <div>chart</div>
      </ChartFrame>,
    );
  }

  it.each(["xs", "sm"] as const)("%s: the inline toolbar collapses to Expand only", (density) => {
    const { container } = renderToolbarAt(density);
    const header = container.querySelector('[data-slot="chart-frame-header"]') as HTMLElement;
    expect(header.querySelectorAll("button")).toHaveLength(1);
    expect(screen.getByLabelText("Expand chart")).toBeInTheDocument();
    expect(screen.queryByLabelText("Download CSV")).not.toBeInTheDocument();
  });

  it("xs: the collapsed actions are reachable inside the expanded view", () => {
    renderToolbarAt("xs");
    fireEvent.click(screen.getByLabelText("Expand chart"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Download CSV")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Flip to table view")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Expand chart")).not.toBeInTheDocument();
  });

  it("xs without Expand keeps the full toolbar (nowhere to collapse into)", () => {
    renderToolbarAt("xs", ["table", "download"]);
    expect(screen.getByLabelText("Download CSV")).toBeInTheDocument();
    expect(screen.getByLabelText("Flip to table view")).toBeInTheDocument();
  });

  it("md: the full toolbar stays inline and the expand view adds none", () => {
    renderToolbarAt("md");
    expect(screen.getByLabelText("Download CSV")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Expand chart"));
    expect(document.querySelector('[data-slot="chart-frame-expanded-toolbar"]')).toBeNull();
  });

  it("tile without height fills its host; an explicit height stays fixed", () => {
    const { container, rerender } = renderToolbarAt("md");
    const root = container.querySelector('[data-slot="chart-frame"]') as HTMLElement;
    expect(root.className).toContain("h-full");
    const body = container.querySelector('[data-slot="chart-frame-body"] > div') as HTMLElement;
    expect(body.style.height).toBe("");
    rerender(
      <ChartFrame title="Revenue" chrome="tile" height={120} data={sampleData}>
        <div>chart</div>
      </ChartFrame>,
    );
    const fixed = container.querySelector('[data-slot="chart-frame-body"] > div') as HTMLElement;
    expect(fixed.style.height).toBe("120px");
  });
});

describe("ChartFrame chrome (RM-072)", () => {
  it("tile: slots replace the default header and toolbar; the expand modal still opens", () => {
    const onExpandChange = vi.fn();
    render(
      <ChartFrame
        title="Default title"
        data={sampleData}
        chrome="tile"
        source="Source: tile"
        headerSlot={<span>Tile header</span>}
        menuSlot={(api) => (
          <button type="button" onClick={api.expand}>
            Open big
          </button>
        )}
        onExpandChange={onExpandChange}
      >
        <div>chart</div>
      </ChartFrame>,
    );
    expect(screen.getByText("Tile header")).toBeInTheDocument();
    expect(screen.queryByText("Default title")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Expand chart")).not.toBeInTheDocument();
    expect(screen.getByText("Source: tile")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="card"]')).toBeNull();

    fireEvent.click(screen.getByText("Open big"));
    expect(onExpandChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("bare: body only — no header, toolbar or source row", () => {
    const { container } = render(
      <ChartFrame title="Hidden" data={sampleData} source="Source: bare" chrome="bare">
        <div>chart body</div>
      </ChartFrame>,
    );
    expect(screen.getByText("chart body")).toBeInTheDocument();
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Expand chart")).not.toBeInTheDocument();
    expect(screen.queryByText("Source: bare")).not.toBeInTheDocument();
    expect(container.querySelector('[data-chrome="bare"]')).not.toBeNull();
  });
});

// WCAG 2.1.1 (axe `scrollable-region-focusable`, #432 round 3): `chart-frame-body`'s
// `overflow-auto` box is only a keyboard tab stop while it genuinely overflows. jsdom's
// `ResizeObserver` is a no-op stub (vitest.setup.ts), so this test supplies its own
// capturing mock and drives measurement by hand — mirroring
// dashboard-sheet.responsive.test.tsx's `FixedWidthResizeObserver`.
describe("ChartFrame body — overflow-aware tabIndex (#432 round 3)", () => {
  const realResizeObserver = globalThis.ResizeObserver;
  let capturedCallback: ResizeObserverCallback | undefined;

  beforeEach(() => {
    capturedCallback = undefined;
    class CapturingResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        capturedCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = realResizeObserver;
  });

  function getScrollBody(): HTMLDivElement {
    const el = document.querySelector('[data-slot="chart-frame-body"] > div');
    if (!el) throw new Error("chart-frame-body scroll container not found");
    return el as HTMLDivElement;
  }

  function mockOverflow(el: HTMLDivElement, overflowing: boolean) {
    Object.defineProperty(el, "scrollWidth", {
      configurable: true,
      value: overflowing ? 800 : 100,
    });
    Object.defineProperty(el, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(el, "scrollHeight", {
      configurable: true,
      value: overflowing ? 800 : 100,
    });
    Object.defineProperty(el, "clientHeight", { configurable: true, value: 100 });
  }

  it("has no tabIndex/aria-label while not overflowing (byte-identical to today)", () => {
    render(
      <ChartFrame title="Orders" chrome="tile" data={sampleData}>
        <div>chart</div>
      </ChartFrame>,
    );
    const body = getScrollBody();
    expect(body).not.toHaveAttribute("tabindex");
    expect(body).not.toHaveAttribute("aria-label");
  });

  it("gets tabIndex=0 and a name once it measurably overflows", () => {
    render(
      <ChartFrame title="Orders" chrome="tile" data={sampleData}>
        <div>chart</div>
      </ChartFrame>,
    );
    const body = getScrollBody();
    mockOverflow(body, true);
    act(() => {
      capturedCallback?.([], {} as ResizeObserver);
    });
    expect(body).toHaveAttribute("tabindex", "0");
    expect(body).toHaveAccessibleName("Scrollable chart: Orders");
  });

  it("toggles the tab stop off again once content no longer overflows", () => {
    render(
      <ChartFrame title="Orders" chrome="tile" data={sampleData}>
        <div>chart</div>
      </ChartFrame>,
    );
    const body = getScrollBody();
    mockOverflow(body, true);
    act(() => {
      capturedCallback?.([], {} as ResizeObserver);
    });
    expect(body).toHaveAttribute("tabindex", "0");

    mockOverflow(body, false);
    act(() => {
      capturedCallback?.([], {} as ResizeObserver);
    });
    expect(body).not.toHaveAttribute("tabindex");
    expect(body).not.toHaveAttribute("aria-label");
  });
});
