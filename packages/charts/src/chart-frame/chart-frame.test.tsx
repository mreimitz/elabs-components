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
