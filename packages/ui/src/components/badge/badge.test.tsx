import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders content", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("forwards its ref to the rendered <span>", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Badge ref={ref}>New</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current).toBe(screen.getByText("New"));
  });

  it("renders no data-appearance attribute when appearance is unset", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).not.toHaveAttribute("data-appearance");
  });

  it("renders data-appearance when an explicit appearance is passed", () => {
    render(<Badge appearance="solid">New</Badge>);
    expect(screen.getByText("New")).toHaveAttribute("data-appearance", "solid");
  });

  it("carries the appearance recipe classes on a colour-bearing variant", () => {
    render(
      <Badge appearance="tint" variant="success">
        New
      </Badge>,
    );
    const badge = screen.getByText("New");
    expect(badge.classList.contains("badge-tint:bg-(--badge-fill)/10")).toBe(true);
    expect(badge.classList.contains("[--badge-fill:var(--success)]")).toBe(true);
  });
});
