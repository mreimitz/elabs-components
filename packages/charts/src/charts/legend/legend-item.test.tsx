/**
 * `LegendItem` (#545) — was a plain `<div>` with only `onMouseEnter`/
 * `onMouseLeave`, unreachable by Tab. Locks in the real-`<button>` fix and
 * its keyboard parity with the pre-existing mouse-hover behaviour.
 */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Legend } from "./legend";
import { LegendItem } from "./legend-item";
import { LegendLabel } from "./legend-label";

afterEach(cleanup);

const items = [
  { label: "Alpha", value: 10, color: "var(--chart-1)" },
  { label: "Beta", value: 20, color: "var(--chart-2)" },
];

describe("LegendItem (#545)", () => {
  it("renders a real, Tab-reachable <button> for every item, not a plain <div>", () => {
    const { container } = render(
      <Legend items={items}>
        <LegendItem>
          <LegendLabel />
        </LegendItem>
      </Legend>,
    );

    const buttons = container.querySelectorAll(".legend-container > button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.getAttribute("tabindex")).not.toBe("-1");
      expect(button).toHaveClass("focus-ring");
    }
  });

  it("focusing an item sets the same hovered state a mouse hover does, and blur clears it", () => {
    const { container } = render(
      <Legend items={items}>
        <LegendItem>
          <LegendLabel />
        </LegendItem>
      </Legend>,
    );

    const buttons = container.querySelectorAll(".legend-container > button");
    const beta = buttons[1] as HTMLButtonElement;

    fireEvent.focus(beta);
    expect(beta.dataset.hovered).toBe("");

    fireEvent.blur(beta);
    expect(beta.dataset.hovered).toBeUndefined();

    // Mouse hover drives the identical state.
    fireEvent.mouseEnter(beta);
    expect(beta.dataset.hovered).toBe("");
    fireEvent.mouseLeave(beta);
    expect(beta.dataset.hovered).toBeUndefined();
  });
});
