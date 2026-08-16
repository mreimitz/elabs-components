import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRef } from "react";
import { BlueprintSheet } from "./blueprint-sheet";

afterEach(cleanup);

describe("BlueprintSheet", () => {
  it("is a labelled sheet that renders its children + a docked title block", () => {
    const { getByRole, getByText } = render(
      <BlueprintSheet label="Sheet" titleBlock={<div>title-block</div>}>
        <span>content</span>
      </BlueprintSheet>,
    );
    expect(getByRole("group", { name: "Sheet" })).toBeInTheDocument();
    expect(getByText("content")).toBeInTheDocument();
    expect(getByText("title-block")).toBeInTheDocument();
  });

  it("draws corner ticks by default and omits them when corners=false", () => {
    const { rerender, getByRole } = render(<BlueprintSheet label="x">c</BlueprintSheet>);
    // 4 corner tick spans
    expect(
      getByRole("group", { name: "x" }).querySelectorAll("span.border-rule-strong"),
    ).toHaveLength(4);
    rerender(
      <BlueprintSheet label="x" corners={false}>
        c
      </BlueprintSheet>,
    );
    expect(
      getByRole("group", { name: "x" }).querySelectorAll("span.border-rule-strong"),
    ).toHaveLength(0);
  });

  it("forwards ref + className", () => {
    const ref = createRef<HTMLDivElement>();
    const { getByRole } = render(
      <BlueprintSheet ref={ref} label="x" className="custom">
        c
      </BlueprintSheet>,
    );
    const root = getByRole("group", { name: "x" });
    expect(root).toHaveClass("custom");
    expect(ref.current).toBe(root);
  });
});
