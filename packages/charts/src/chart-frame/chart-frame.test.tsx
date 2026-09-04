import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChartFrame } from "./chart-frame";

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
    // Two occurrences now: the inline card footer + the modal's detail pane.
    expect(screen.getAllByText("Source: Internal analytics")).toHaveLength(2);
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
