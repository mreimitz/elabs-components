import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRef } from "react";
import { PlaceholderBox } from "./placeholder-box";

afterEach(cleanup);

describe("PlaceholderBox", () => {
  it("draws a decorative cross and is aria-hidden when empty", () => {
    const { getByTestId } = render(<PlaceholderBox data-testid="pb" />);
    const el = getByTestId("pb");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.querySelectorAll("line")).toHaveLength(2);
  });

  it("omits the cross when cross=false", () => {
    const { getByTestId } = render(<PlaceholderBox data-testid="pb" cross={false} />);
    expect(getByTestId("pb").querySelector("line")).toBeNull();
  });

  it("renders a label and is not aria-hidden then", () => {
    const { getByText, getByTestId } = render(
      <PlaceholderBox data-testid="pb" label="illustration 2" />,
    );
    expect(getByText("illustration 2")).toBeInTheDocument();
    expect(getByTestId("pb")).not.toHaveAttribute("aria-hidden");
  });

  it("forwards ref + className", () => {
    const ref = createRef<HTMLDivElement>();
    const { getByTestId } = render(
      <PlaceholderBox ref={ref} data-testid="pb" className="custom" />,
    );
    expect(ref.current).toBe(getByTestId("pb"));
    expect(getByTestId("pb")).toHaveClass("custom");
  });
});
