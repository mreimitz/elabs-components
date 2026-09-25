/**
 * `LegendItem` keyboard reachability (issue 545).
 *
 * `focusOnHover`'s spotlight/dim (RM-112) only ever responded to
 * pointer/touch on this compound legend: the item was a plain, non-focusable
 * `<div>` with `onMouseEnter`/`onMouseLeave` only, so a keyboard user had no
 * way to reach the same hovered state `Legend`/`useLegend` already drive.
 * These tests lock the fix in: the item is a real `<button>`, and
 * `onFocus`/`onBlur` set/clear the SAME `hoveredIndex` state a mouse hover
 * does.
 */
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Legend } from "./legend";
import { LegendItem } from "./legend-item";
import { LegendLabel } from "./legend-label";
import { LegendMarker } from "./legend-marker";

const items = [
  { label: "Alpha", value: 10, color: "var(--chart-1)" },
  { label: "Beta", value: 20, color: "var(--chart-2)" },
];

function renderLegend(props: Partial<React.ComponentProps<typeof Legend>> = {}) {
  return render(
    <Legend items={items} {...props}>
      <LegendItem className="flex items-center gap-2">
        <LegendMarker />
        <LegendLabel />
      </LegendItem>
    </Legend>,
  );
}

describe("LegendItem", () => {
  it("renders each item as a real, Tab-reachable <button> — never a div-as-button", () => {
    const { container } = renderLegend();
    const buttons = container.querySelectorAll(".legend-container > button");
    expect(buttons).toHaveLength(items.length);
    for (const button of buttons) {
      expect(button).toHaveAttribute("type", "button");
      expect(button.getAttribute("tabindex")).not.toBe("-1");
    }
    expect(container.querySelectorAll("div.cursor-pointer")).toHaveLength(0);
  });

  it("carries a visible focus ring", () => {
    const { container } = renderLegend();
    for (const button of container.querySelectorAll("button")) {
      expect(button).toHaveClass("focus-ring");
    }
  });

  it("focusing an item sets the same hovered index a mouse hover does, blurring clears it (issue 545)", () => {
    const onHoverChange = vi.fn();
    const { container } = renderLegend({ hoveredIndex: null, onHoverChange });
    const buttons = container.querySelectorAll("button");

    fireEvent.focus(buttons[1] as HTMLButtonElement);
    expect(onHoverChange).toHaveBeenLastCalledWith(1);

    fireEvent.blur(buttons[1] as HTMLButtonElement);
    expect(onHoverChange).toHaveBeenLastCalledWith(null);
  });

  it("focus and mouse hover drive the identical highlighted state (data-hovered)", () => {
    const { container } = renderLegend();
    const buttons = container.querySelectorAll("button");

    fireEvent.mouseEnter(buttons[1] as HTMLButtonElement);
    expect(buttons[1]?.getAttribute("data-hovered")).toBe("");
    fireEvent.mouseLeave(buttons[1] as HTMLButtonElement);
    expect(buttons[1]?.hasAttribute("data-hovered")).toBe(false);

    fireEvent.focus(buttons[1] as HTMLButtonElement);
    expect(buttons[1]?.getAttribute("data-hovered")).toBe("");
    fireEvent.blur(buttons[1] as HTMLButtonElement);
    expect(buttons[1]?.hasAttribute("data-hovered")).toBe(false);
  });
});
