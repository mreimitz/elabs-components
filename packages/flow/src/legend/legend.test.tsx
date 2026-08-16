import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
});
