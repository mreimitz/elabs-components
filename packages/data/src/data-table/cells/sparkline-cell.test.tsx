import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SparklineCell } from "./sparkline-cell";

describe("SparklineCell", () => {
  it("keeps every value as text and draws against the given (shared) domain", () => {
    const { container, getByText } = render(
      <SparklineCell values={[1, null, 4]} domain={{ min: 0, max: 8 }} label="1, –, 4" fill />,
    );
    expect(getByText("1, –, 4")).toHaveClass("sr-only");
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("data-y-max", "8");
    // A null breaks the line: two move-tos.
    const d = container.querySelector('[data-slot="sparkline-cell-line"]')?.getAttribute("d") ?? "";
    expect(d.match(/M/g)).toHaveLength(2);
  });
  it("prints end labels only when asked", () => {
    const { container, getByText } = render(
      <SparklineCell values={[1, 4]} domain={{ min: 1, max: 4 }} label="1, 4" ends={["1", "4"]} />,
    );
    expect(getByText("4", { selector: "span[aria-hidden]" })).toBeInTheDocument();
    expect(container.querySelectorAll("span[aria-hidden]")).toHaveLength(2);
  });
  it("reserves one end-label box per column, so every row draws on the same x scale", () => {
    const ends = (first: string, last: string) => {
      const { container } = render(
        <SparklineCell
          values={[1, 4]}
          domain={{ min: 1, max: 4 }}
          label={`${first}, ${last}`}
          ends={[first, last]}
          endsWidth={[3, 4]}
        />,
      );
      return [...container.querySelectorAll<HTMLElement>("span[aria-hidden]")].map(
        (span) => span.style.width,
      );
    };
    expect(ends("90", "110")).toEqual(["3ch", "4ch"]);
    expect(ends("300", "380")).toEqual(["3ch", "4ch"]);
  });
});
