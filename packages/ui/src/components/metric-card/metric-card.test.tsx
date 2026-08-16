import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "./metric-card";

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="Revenue" value="$42,000" />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("$42,000")).toBeInTheDocument();
  });

  it("renders description when passed", () => {
    render(<MetricCard label="Revenue" value="$42,000" description="vs $40k last month" />);
    expect(screen.getByText("vs $40k last month")).toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    render(<MetricCard label="Revenue" value="$42,000" />);
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("renders delta text when provided", () => {
    render(<MetricCard label="Users" value="1,234" delta="+12.4%" deltaDirection="up" />);
    expect(screen.getByText(/12\.4%/)).toBeInTheDocument();
  });

  it("renders an optional visual slot", () => {
    render(<MetricCard label="Sales" value="99" visual={<div data-testid="sparkline" />} />);
    expect(screen.getByTestId("sparkline")).toBeInTheDocument();
  });

  it("renders an optional icon slot", () => {
    render(
      <MetricCard label="Orders" value="7" icon={<svg data-testid="icon" aria-hidden="true" />} />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  // Polarity (good/bad) must survive monochrome themes via a non-color channel:
  // a stable data-polarity hook + AT aria-label.
  it("marks a favorable delta with data-polarity=good and a favorable AT label", () => {
    render(
      <MetricCard label="Revenue" value="$1M" delta="+12.4%" deltaDirection="up" positiveIsGood />,
    );
    const el = screen.getByLabelText("up +12.4%, favorable");
    expect(el).toHaveAttribute("data-polarity", "good");
  });

  it("marks an unfavorable delta with data-polarity=bad and an unfavorable AT label", () => {
    render(
      <MetricCard
        label="Open tickets"
        value="42"
        delta="+5"
        deltaDirection="up"
        positiveIsGood={false}
      />,
    );
    const el = screen.getByLabelText("up +5, unfavorable");
    expect(el).toHaveAttribute("data-polarity", "bad");
  });

  it("marks a neutral delta with data-polarity=neutral", () => {
    render(<MetricCard label="Sessions" value="100" delta="0%" deltaDirection="neutral" />);
    const el = screen.getByText(/0%/).closest("[data-polarity]");
    expect(el).toHaveAttribute("data-polarity", "neutral");
  });

  // emphasis axis (#191, research 11 §B.5 KPI-1): size/weight/space only — the
  // headline rung is text-kpi; default stays on the calm intermediate rung.
  it("renders the calm default value rung by default", () => {
    render(<MetricCard label="Revenue" value="$1M" />);
    const value = screen.getByText("$1M");
    expect(value.className).toContain("text-2xl");
    expect(value.className).not.toContain("text-kpi");
  });

  it("renders the headline kpi rung for emphasis=headline", () => {
    render(<MetricCard emphasis="headline" label="Revenue" value="$1M" />);
    const value = screen.getByText("$1M");
    expect(value.className).toContain("text-kpi");
    expect(value.className).not.toContain("text-2xl");
  });

  it("renders an optional evidence footer slot (#191, KPI-3)", () => {
    render(
      <MetricCard
        label="Revenue"
        value="$1M"
        evidence={<span data-testid="evidence">3 sources</span>}
      />,
    );
    expect(screen.getByTestId("evidence")).toBeInTheDocument();
  });

  // Loading vs ready (#268): a layout-shaped skeleton replaces the value/label/delta
  // text, and the region announces once via a single role="status" live region.
  describe("loading", () => {
    it("renders a skeleton instead of the label/value/delta text", () => {
      render(
        <MetricCard label="Revenue" value="$42,000" delta="+12.4%" deltaDirection="up" loading />,
      );
      expect(screen.queryByText("Revenue")).not.toBeInTheDocument();
      expect(screen.queryByText("$42,000")).not.toBeInTheDocument();
      expect(screen.queryByText(/12\.4%/)).not.toBeInTheDocument();
    });

    it("renders exactly one status live region for the not-ready state", () => {
      render(
        <MetricCard label="Revenue" value="$42,000" delta="+12.4%" deltaDirection="up" loading />,
      );
      expect(screen.getAllByRole("status")).toHaveLength(1);
    });

    it("renders the real content (no status region) when not loading", () => {
      render(<MetricCard label="Revenue" value="$42,000" />);
      expect(screen.getByText("Revenue")).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("suppresses its own live region when announceLoading is false (composed in a grid)", () => {
      render(<MetricCard announceLoading={false} label="Revenue" loading value="$42,000" />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  // A KPI tile is a small box; `50012102.632741` does not fit in one. Numbers
  // are compacted by default and the exact figure stays one click away. Every
  // OTHER ReactNode passes through untouched — that is what makes the new
  // default safe for the call sites that already format their own strings.
  describe("value formatting", () => {
    it("compacts a numeric value by default", () => {
      render(<MetricCard label="Revenue" value={50012102.632741} />);
      expect(screen.getByRole("button")).toHaveTextContent("50M");
    });

    it("leaves a pre-formatted string byte-identical", () => {
      render(<MetricCard label="Revenue" value="$42,000" />);
      expect(screen.getByText("$42,000")).toBeInTheDocument();
      // No control, because there is nothing shortened to restore.
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("passes an element through untouched", () => {
      render(<MetricCard label="Revenue" value={<span data-testid="custom">≈ 50M</span>} />);
      expect(screen.getByTestId("custom")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("prints every digit for valueFormat=number", () => {
      render(<MetricCard label="Revenue" value={1500000} valueFormat="number" />);
      expect(screen.getByText("1,500,000")).toBeInTheDocument();
    });

    it("renders currency with the requested code", () => {
      render(<MetricCard currency="EUR" label="Revenue" value={1234} valueFormat="currency" />);
      expect(screen.getByRole("button")).toHaveTextContent("€");
    });

    it("hands a function full control and offers no copy affordance", () => {
      render(
        <MetricCard label="Revenue" value={1234} valueFormat={(n) => <span>~{n} units</span>} />,
      );
      expect(screen.getByText(/~1234 units/)).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("offers the exact value on click when the display was shortened", () => {
      render(<MetricCard label="Revenue" value={50012102.632741} />);
      expect(screen.getByRole("button", { name: /50M.*Copy exact value/i })).toBeInTheDocument();
    });

    it("offers no copy affordance when the display already IS the exact value", () => {
      // 42 renders as "42" — a button around an unshortened number is noise.
      render(<MetricCard label="Orders" value={42} />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    // Two tiles in a grid can compact to the same display; the label is a
    // sibling node, so without it in the hint both buttons announce alike.
    it("names the copy button after the metric it belongs to", () => {
      render(
        <>
          <MetricCard label="Revenue" value={1234567} />
          <MetricCard label="Pipeline" value={1234567} />
        </>,
      );
      expect(screen.getByRole("button", { name: /1\.2M.*Revenue/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /1\.2M.*Pipeline/i })).toBeInTheDocument();
    });

    it("can be opted out of with copyExactValue={false}", () => {
      render(<MetricCard copyExactValue={false} label="Revenue" value={50012102.632741} />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByText("50M")).toBeInTheDocument();
    });
  });
});
