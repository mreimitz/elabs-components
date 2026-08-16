import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "@elabs/components-ui";

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="Revenue" value="$42,000" />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("$42,000")).toBeInTheDocument();
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

  // Issue #162 — polarity (good/bad) must survive monochrome themes via a
  // non-color channel: a stable data-polarity hook (the decoration glyph rides it)
  // and the AT aria-label (good/bad is otherwise invisible to AT).
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

  it("marks a neutral delta with data-polarity=neutral and no polarity qualifier", () => {
    render(<MetricCard label="Sessions" value="100" delta="0%" deltaDirection="neutral" />);
    const el = screen.getByText(/0%/).closest("[data-polarity]");
    expect(el).toHaveAttribute("data-polarity", "neutral");
  });
});
