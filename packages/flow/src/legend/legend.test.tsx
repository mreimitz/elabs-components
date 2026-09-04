import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { computeEdgeWeightScale, type WeightedEdgeLike } from "../flow-weighted-edge/weight-scale";
import { Legend } from "./legend";

afterEach(cleanup);

describe("Legend", () => {
  const items = [
    { label: "Source", color: "var(--chart-1)" },
    { label: "Target", color: "var(--chart-2)" },
  ];

  it("renders all item labels", () => {
    render(<Legend items={items} />);
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
  });

  it("renders the title when provided", () => {
    render(<Legend items={items} title="Legend Title" />);
    expect(screen.getByText("Legend Title")).toBeInTheDocument();
  });

  it("omits the title when not provided", () => {
    const { container } = render(<Legend items={items} />);
    // No title text in the container beyond the items
    expect(container.querySelector(".font-medium")).toBeNull();
  });

  it("renders a color swatch for each item", () => {
    const { container } = render(<Legend items={items} />);
    const swatches = container.querySelectorAll("span[aria-hidden='true']");
    expect(swatches).toHaveLength(2);
  });

  it("applies custom className", () => {
    const { container } = render(<Legend items={items} className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("renders an empty list when items is empty", () => {
    render(<Legend items={[]} />);
    const list = screen.queryByRole("list");
    expect(list).toBeInTheDocument();
  });

  // Same cases as above, but explicitly passing `variant="categorical"` — the
  // additive prop must be a true no-op, not merely an omission that happens
  // to work.
  it('renders identically with variant="categorical" made explicit', () => {
    render(<Legend variant="categorical" items={items} title="Legend Title" />);
    expect(screen.getByText("Legend Title")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
  });
});

describe('Legend variant="scale", kind="width"', () => {
  it("draws min/max sample strokes at exactly computeEdgeWeightScale's widths for that domain (#219)", () => {
    const { container } = render(<Legend variant="scale" kind="width" domain={[2, 48]} />);
    const expected = computeEdgeWeightScale([
      { id: "0", data: { weight: 2 } },
      { id: "1", data: { weight: 48 } },
    ] satisfies WeightedEdgeLike[]);

    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(2);
    expect(Number(lines[0]!.getAttribute("stroke-width"))).toBeCloseTo(expected.get("0")!, 5);
    expect(Number(lines[1]!.getAttribute("stroke-width"))).toBeCloseTo(expected.get("1")!, 5);
  });

  it('adds the domain midpoint as a third stroke under ticks="minmedmax", matching computeEdgeWeightScale for 2/25/48', () => {
    const { container } = render(
      <Legend variant="scale" kind="width" domain={[2, 48]} ticks="minmedmax" />,
    );
    const expected = computeEdgeWeightScale([
      { id: "0", data: { weight: 2 } },
      { id: "1", data: { weight: 25 } },
      { id: "2", data: { weight: 48 } },
    ] satisfies WeightedEdgeLike[]);

    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(3);
    expect(Number(lines[0]!.getAttribute("stroke-width"))).toBeCloseTo(expected.get("0")!, 5);
    expect(Number(lines[1]!.getAttribute("stroke-width"))).toBeCloseTo(expected.get("1")!, 5);
    expect(Number(lines[2]!.getAttribute("stroke-width"))).toBeCloseTo(expected.get("2")!, 5);
  });

  it("renders formatted min/max tick labels with tabular-nums", () => {
    render(<Legend variant="scale" kind="width" domain={[2, 48]} />);
    expect(screen.getByText("2")).toHaveClass("tabular-nums");
    expect(screen.getByText("48")).toHaveClass("tabular-nums");
  });

  it("applies a caller-supplied format function to every tick", () => {
    render(
      <Legend
        variant="scale"
        kind="width"
        domain={[2, 48]}
        ticks="minmedmax"
        format={(v) => `${v} evt/s`}
      />,
    );
    expect(screen.getByText("2 evt/s")).toBeInTheDocument();
    expect(screen.getByText("25 evt/s")).toBeInTheDocument();
    expect(screen.getByText("48 evt/s")).toBeInTheDocument();
  });

  it("keeps the smallest tick's stroke at the readable floor (default 1.5px), never thinner", () => {
    const { container } = render(<Legend variant="scale" kind="width" domain={[2, 1000]} />);
    const lines = container.querySelectorAll("line");
    const widths = Array.from(lines).map((l) => Number(l.getAttribute("stroke-width")));
    expect(Math.min(...widths)).toBeCloseTo(1.5, 5);
  });

  it("handles a zero-width domain (min === max) without crashing, all samples at the midpoint width", () => {
    const { container } = render(
      <Legend variant="scale" kind="width" domain={[10, 10]} ticks="minmedmax" />,
    );
    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(3);
    const widths = Array.from(lines).map((l) => Number(l.getAttribute("stroke-width")));
    // computeEdgeWeightScale's own zero-variance behavior: the midpoint of
    // the default [1.5, 8] output range.
    for (const w of widths) expect(w).toBeCloseTo(4.75, 5);
    expect(screen.getAllByText("10")).toHaveLength(3);
  });

  it("is a single keyboard tab stop with an aria-label summarizing the domain", () => {
    render(<Legend variant="scale" kind="width" domain={[2, 48]} ticks="minmedmax" />);
    const group = screen.getByRole("group", {
      name: "Edge width scale, 2 to 48, minimum to maximum",
    });
    expect(group).toHaveAttribute("tabindex", "0");
    // No descendant of the legend is itself a tab stop — one Tab reaches the
    // whole reading key, not one per tick.
    const innerTabbables = group.querySelectorAll(
      "button, a[href], input, select, textarea, [tabindex]",
    );
    expect(innerTabbables).toHaveLength(0);
  });

  it("does not render the categorical <ul> item list", () => {
    const { container } = render(<Legend variant="scale" kind="width" domain={[2, 48]} />);
    expect(container.querySelector("ul")).toBeNull();
  });
});

describe('Legend variant="scale", kind="color"', () => {
  it("renders a 5-stop gradient using the flow-edge-weak/strong tokens", () => {
    const { container } = render(<Legend variant="scale" kind="color" domain={[0, 100]} />);
    const bar = container.querySelector("[aria-hidden='true'][style*='linear-gradient']");
    expect(bar).not.toBeNull();
    const backgroundImage = (bar as HTMLElement).style.backgroundImage;
    expect(backgroundImage).toContain("var(--flow-edge-weak)");
    expect(backgroundImage).toContain("var(--flow-edge-strong)");
    // 5 explicit percentage stops: 0, 25, 50, 75, 100.
    for (const pct of ["0%", "25%", "50%", "75%", "100%"]) {
      expect(backgroundImage).toContain(pct);
    }
  });

  it("labels every one of the 5 stops via the caller's format function — colour is never the only channel (#387-style, WCAG 1.4.1)", () => {
    render(<Legend variant="scale" kind="color" domain={[0, 100]} format={(v) => `${v}%`} />);
    for (const label of ["0%", "25%", "50%", "75%", "100%"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("uses the default locale number format when none is supplied", () => {
    render(<Legend variant="scale" kind="color" domain={[0, 1000]} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("750")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  it("handles a domain spanning several orders of magnitude", () => {
    render(<Legend variant="scale" kind="color" domain={[1, 1_000_000]} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("1,000,000")).toBeInTheDocument();
  });

  it("handles a zero-width domain (min === max) — all 5 stop labels equal, no crash", () => {
    render(<Legend variant="scale" kind="color" domain={[10, 10]} />);
    expect(screen.getAllByText("10")).toHaveLength(5);
  });

  it("truncates a very long formatted label instead of breaking layout", () => {
    render(
      <Legend
        variant="scale"
        kind="color"
        domain={[0, 1]}
        format={(v) => `${v} — a very long description of what this stop means in context`}
      />,
    );
    const label = screen.getByText(
      "0 — a very long description of what this stop means in context",
    );
    expect(label).toHaveClass("truncate");
    expect(label).toHaveClass("min-w-0");
  });

  it("is a single keyboard tab stop with an aria-label summarizing the domain", () => {
    render(<Legend variant="scale" kind="color" domain={[0, 100]} />);
    const group = screen.getByRole("group", {
      name: "Edge color scale, 0 to 100, minimum to maximum",
    });
    expect(group).toHaveAttribute("tabindex", "0");
  });
});
