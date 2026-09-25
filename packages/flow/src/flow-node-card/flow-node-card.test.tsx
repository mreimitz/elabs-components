import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { FlowToneIndicator } from "../flow-tone";
import { FlowNodeCard } from "./flow-node-card";

describe("FlowNodeCard", () => {
  it("renders the card slot with a neutral, default tone", () => {
    const { container } = render(<FlowNodeCard>Body</FlowNodeCard>);
    const card = container.querySelector('[data-slot="flow-node-card"]');
    expect(card).toHaveAttribute("data-tone", "neutral");
    expect(card).toHaveAttribute("data-emphasis", "default");
    expect(card).toHaveClass("relative", "border-border");
  });

  it("carries the proxied focus indicator", () => {
    const { container } = render(<FlowNodeCard />);
    expect(container.firstElementChild).toHaveClass(
      "[[data-id]:focus-visible_&]:focus-ring-static",
    );
  });

  it("paints the selection ring only when selected", () => {
    const { container, rerender } = render(<FlowNodeCard />);
    expect(container.firstElementChild).not.toHaveClass("ring-2");
    rerender(<FlowNodeCard selected />);
    expect(container.firstElementChild).toHaveClass("ring-2", "ring-ring");
  });

  it("routes tone and emphasis through flowToneVariants", () => {
    const { container, rerender } = render(<FlowNodeCard tone="destructive" />);
    const card = container.firstElementChild!;
    expect(card).toHaveClass("border-destructive");
    expect(card).not.toHaveClass("border-border");
    rerender(<FlowNodeCard emphasis="featured" />);
    expect(card).toHaveClass("border-primary");
    expect(card).toHaveAttribute("data-emphasis", "featured");
  });

  it("forwards its ref, spreads props and merges className last", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <FlowNodeCard ref={ref} className="border-flow-group-border px-3" aria-label="Card" />,
    );
    const card = container.firstElementChild!;
    expect(ref.current).toBe(card);
    expect(card).toHaveAttribute("aria-label", "Card");
    expect(card).toHaveClass("border-flow-group-border", "px-3");
    expect(card).not.toHaveClass("border-border");
  });

  it("hosts a FlowToneIndicator as its non-colour channel", () => {
    const { getByText } = render(
      <FlowNodeCard tone="success">
        <FlowToneIndicator tone="success" />
      </FlowNodeCard>,
    );
    expect(getByText("Success")).toHaveClass("sr-only");
  });
});
