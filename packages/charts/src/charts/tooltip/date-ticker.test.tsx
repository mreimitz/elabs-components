import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DateTicker } from "./date-ticker";

afterEach(cleanup);

describe("DateTicker", () => {
  it("uses theme-safe ink tokens, never a raw zinc/dark: pair (compact variant, >60 labels)", () => {
    const labels = Array.from({ length: 61 }, (_, i) => `Jan ${i + 1}`);
    const { container } = render(<DateTicker currentIndex={0} labels={labels} visible />);
    const pill = container.querySelector("div")!;
    expect(pill.className).toContain("bg-foreground");
    expect(pill.className).toContain("text-background");
    expect(pill.className).not.toMatch(/zinc|dark:/);
  });

  it("uses theme-safe ink tokens, never a raw zinc/dark: pair (scrolling variant, <=60 labels)", () => {
    const labels = ["Jan 1", "Jan 2", "Feb 3"];
    const { container } = render(<DateTicker currentIndex={0} labels={labels} visible />);
    const pill = container.querySelector("div")!;
    expect(pill.className).toContain("bg-foreground");
    expect(pill.className).toContain("text-background");
    expect(pill.className).not.toMatch(/zinc|dark:/);
  });
});
