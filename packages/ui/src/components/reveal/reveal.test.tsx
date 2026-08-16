import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Reveal, RevealGroup } from "./reveal";

describe("Reveal", () => {
  it("renders children with the gated entrance classes", () => {
    render(<Reveal data-testid="r">hello</Reveal>);
    const el = screen.getByTestId("r");
    expect(el).toHaveTextContent("hello");
    expect(el.className).toContain("animate-in");
    expect(el.className).toContain("duration-slow"); // gated duration utility (default speed)
  });

  it("applies a delay when delayMs is set", () => {
    render(
      <Reveal data-testid="r" delayMs={120}>
        x
      </Reveal>,
    );
    expect(screen.getByTestId("r").style.animationDelay).toBe("120ms");
  });
});

describe("RevealGroup", () => {
  it("clones children in place (no wrapper) with staggered delays", () => {
    render(
      <RevealGroup staggerMs={50}>
        <span data-testid="a">a</span>
        <span data-testid="b">b</span>
        <span data-testid="c">c</span>
      </RevealGroup>,
    );
    const a = screen.getByTestId("a");
    const b = screen.getByTestId("b");
    const c = screen.getByTestId("c");
    // Children keep their own tag (cloned in place, no wrapper div).
    expect(a.tagName).toBe("SPAN");
    expect(a.className).toContain("animate-in");
    expect(a.style.animationDelay).toBe("0ms");
    expect(b.style.animationDelay).toBe("50ms");
    expect(c.style.animationDelay).toBe("100ms");
  });
});
