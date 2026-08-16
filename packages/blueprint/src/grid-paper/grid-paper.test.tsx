import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRef } from "react";
import { GridPaper } from "./grid-paper";

afterEach(cleanup);

describe("GridPaper", () => {
  it("renders a decorative ground (aria-hidden) when it has no children", () => {
    const { getByTestId } = render(<GridPaper data-testid="gp" />);
    expect(getByTestId("gp")).toHaveAttribute("aria-hidden", "true");
  });

  it("is not aria-hidden when used as a layout ground with children", () => {
    const { getByText } = render(
      <GridPaper>
        <span>inner</span>
      </GridPaper>,
    );
    expect(getByText("inner").parentElement).not.toHaveAttribute("aria-hidden");
  });

  it("merges className and forwards the ref + extra props", () => {
    const ref = createRef<HTMLDivElement>();
    const { getByTestId } = render(
      <GridPaper ref={ref} data-testid="gp" className="custom-class" />,
    );
    const el = getByTestId("gp");
    expect(ref.current).toBe(el);
    expect(el).toHaveClass("custom-class");
    // token-driven background is applied via inline style (CSS vars, no hex)
    expect(el.style.backgroundColor).toContain("--canvas");
  });

  it("fade={true} keeps drawing the historic edge vignette (via the shared token)", () => {
    const { getByTestId } = render(<GridPaper data-testid="gp" fade />);
    expect(getByTestId("gp").style.maskImage).toBe("var(--bp-fade-edges)");
  });

  it("fade accepts a direction and reuses the decoration system's mask tokens", () => {
    const { getByTestId } = render(<GridPaper data-testid="gp" fade="top" />);
    expect(getByTestId("gp").style.maskImage).toBe("var(--bp-fade-top)");
  });

  it("fade={false} applies no mask", () => {
    const { getByTestId } = render(<GridPaper data-testid="gp" />);
    expect(getByTestId("gp").style.maskImage).toBe("");
  });
});
