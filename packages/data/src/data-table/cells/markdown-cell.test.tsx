import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownCell, isSafeCellUrl } from "./markdown-cell";

describe("MarkdownCell", () => {
  it("renders the safe inline subset as elements", () => {
    const { container } = render(
      <MarkdownCell text="**Oslo** is *big*, see [docs](https://example.com) and `x`, 10^2^" />,
    );
    expect(container.querySelector("strong")).toHaveTextContent("Oslo");
    expect(container.querySelector("em")).toHaveTextContent("big");
    expect(screen.getByRole("link", { name: "docs" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(container.querySelector("code")).toHaveTextContent("x");
    expect(container.querySelector("sup")).toHaveTextContent("2");
  });
  it("never links an unsafe URL and leaves raw HTML as text", () => {
    const { container } = render(<MarkdownCell text="[x](javascript:alert(1)) <b>y</b>" />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>y</b>");
    expect(isSafeCellUrl("//evil.example")).toBe(false);
    expect(isSafeCellUrl("/path")).toBe(true);
  });
  it("images are off by default (alt text prints) and on with images", () => {
    const { container, rerender } = render(
      <MarkdownCell text="![flag](https://example.com/f.png)" />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("flag");
    rerender(<MarkdownCell text="![flag](https://example.com/f.png)" images />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "flag");
  });
});
