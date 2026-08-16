import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRef } from "react";
import { Callout } from "./callout";

afterEach(cleanup);

describe("Callout", () => {
  it("renders the part number and label", () => {
    const { getByText } = render(<Callout number={3} label="Spring physics" />);
    expect(getByText("3")).toBeInTheDocument();
    expect(getByText("Spring physics")).toBeInTheDocument();
  });

  it("draws a decorative leader line by default", () => {
    const { container } = render(<Callout number={1} label="x" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("omits the leader when leader='none'", () => {
    const { container } = render(<Callout number={1} label="x" leader="none" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("forwards ref + className", () => {
    const ref = createRef<HTMLDivElement>();
    const { getByText } = render(<Callout ref={ref} number={9} className="custom" />);
    // closest [data-slot] is the root callout element
    const root = getByText("9").closest("[data-slot='callout']");
    expect(root).toHaveClass("custom");
    expect(ref.current).toBe(root);
  });
});
