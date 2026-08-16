import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Icon } from "./icon";

describe("Icon", () => {
  it("renders an svg element", () => {
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("is decorative (role=presentation, aria-hidden) when no title is given", () => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).toBe("presentation");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is an image (role=img, aria-label) when a title is provided", () => {
    render(<Icon title="Settings" />);
    const svg = screen.getByRole("img", { name: "Settings" });
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute("aria-label")).toBe("Settings");
  });

  it("renders a <title> element when title is provided", () => {
    const { container } = render(<Icon title="Close" />);
    const titleEl = container.querySelector("title");
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBe("Close");
  });

  it("does not render a <title> element when no title is given", () => {
    const { container } = render(<Icon />);
    expect(container.querySelector("title")).toBeNull();
  });

  it("applies the size prop to width and height", () => {
    const { container } = render(<Icon size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });
});
