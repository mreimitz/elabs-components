import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createRef } from "react";
import { TitleBlock } from "./title-block";

afterEach(cleanup);

describe("TitleBlock", () => {
  it("is a labelled group", () => {
    const { getByRole } = render(<TitleBlock title="Sheet" />);
    expect(getByRole("group", { name: "Title block" })).toBeInTheDocument();
  });

  it("renders the standard metadata cells that have values", () => {
    const { getByText } = render(<TitleBlock scale="1:2" sheet="A-01" />);
    expect(getByText("Scale")).toBeInTheDocument();
    expect(getByText("1:2")).toBeInTheDocument();
    expect(getByText("Sheet")).toBeInTheDocument();
    expect(getByText("A-01")).toBeInTheDocument();
  });

  it("appends extra fields", () => {
    const { getByText } = render(<TitleBlock fields={[{ label: "Units", value: "px" }]} />);
    expect(getByText("Units")).toBeInTheDocument();
    expect(getByText("px")).toBeInTheDocument();
  });

  it("forwards ref + className", () => {
    const ref = createRef<HTMLDivElement>();
    const { getByRole } = render(<TitleBlock ref={ref} title="x" className="custom" />);
    const root = getByRole("group", { name: "Title block" });
    expect(root).toHaveClass("custom");
    expect(ref.current).toBe(root);
  });
});
