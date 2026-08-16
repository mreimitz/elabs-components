import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRef } from "react";
import { BlueprintFrame } from "./blueprint-frame";

afterEach(cleanup);

describe("BlueprintFrame", () => {
  it("is a labelled sheet region that renders its children", () => {
    const { getByRole, getByText } = render(
      <BlueprintFrame label="Sheet">
        <span>content</span>
      </BlueprintFrame>,
    );
    expect(getByRole("group", { name: "Sheet" })).toBeInTheDocument();
    expect(getByText("content")).toBeInTheDocument();
  });

  it("omits the graph-paper ground when grid is disabled", () => {
    const { getByRole } = render(
      <BlueprintFrame label="x" corners={false} grid={false}>
        c
      </BlueprintFrame>,
    );
    const root = getByRole("group", { name: "x" });
    expect(root.querySelector("[data-slot='grid-paper']")).toBeNull();
  });

  it("forwards ref + className", () => {
    const ref = createRef<HTMLDivElement>();
    const { getByRole } = render(
      <BlueprintFrame ref={ref} label="x" className="custom">
        c
      </BlueprintFrame>,
    );
    const root = getByRole("group", { name: "x" });
    expect(root).toHaveClass("custom");
    expect(ref.current).toBe(root);
  });
});
