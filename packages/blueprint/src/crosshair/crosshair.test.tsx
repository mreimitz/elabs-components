import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRef } from "react";
import { Crosshair, RegistrationMark } from "./crosshair";

afterEach(cleanup);

describe("Crosshair", () => {
  it("is decorative (aria-hidden) by default", () => {
    const { container } = render(<Crosshair />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("becomes a labelled image when aria-label is provided", () => {
    const { getByRole } = render(<Crosshair aria-label="Center" />);
    const svg = getByRole("img", { name: "Center" });
    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  it("forwards ref + className", () => {
    const ref = createRef<SVGSVGElement>();
    const { container } = render(<Crosshair ref={ref} className="text-rule" />);
    expect(ref.current).toBe(container.querySelector("svg"));
  });
});

describe("RegistrationMark", () => {
  it("renders a decorative target with a ring", () => {
    const { container } = render(<RegistrationMark />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.querySelector("circle")).toBeTruthy();
  });
});
