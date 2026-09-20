/**
 * AxisTitle placement (RM-127, a-13).
 *
 * A y tick label is centred ON its tick, so the TOP one reaches half a line
 * box above the plot's top edge. An outside vertical title that ends flush
 * with the plot edge therefore paints over it: measured on
 * `charts-autochart--dual-axis-spec` at 900 px, "Conversion rate, %" and its
 * own top tick "7.5" shared 82.3 px² of painted text, at every width and in
 * both themes.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AxisTitle } from "./axis-title";

afterEach(cleanup);

/** One `text-meta` line box, the height a tick label paints. */
const TICK_LINE_PX = 15;

const MARGIN = { top: 40, right: 56, bottom: 40, left: 40 };

function renderOutsideTitle(side: "left" | "right") {
  const { container } = render(
    <AxisTitle
      height={280}
      innerHeight={200}
      innerWidth={784}
      margin={MARGIN}
      placement="outside"
      side={side}
      width={880}
    >
      Conversion rate, %
    </AxisTitle>,
  );
  return container.querySelector('[data-slot="axis-title"]') as HTMLElement;
}

describe("AxisTitle — outside vertical title (a-13)", () => {
  it.each(["left", "right"] as const)(
    "ends its row clear of the top tick label on the %s axis",
    (side) => {
      const title = renderOutsideTitle(side);
      const rowHeight = Number.parseFloat(title.style.height);
      expect(Number.isFinite(rowHeight)).toBe(true);

      // The top tick label spans [margin.top − half a line, margin.top + half].
      const topTickLabelTop = MARGIN.top - TICK_LINE_PX / 2;
      expect(rowHeight).toBeLessThanOrEqual(topTickLabelTop);
      // Still inside the margin band, not floated to the container's top edge.
      expect(rowHeight).toBeGreaterThanOrEqual(TICK_LINE_PX);
    },
  );

  it("keeps a one-line row when the top margin is thinner than the clearance", () => {
    const { container } = render(
      <AxisTitle
        height={180}
        innerHeight={140}
        innerWidth={300}
        margin={{ top: 8, right: 40, bottom: 32, left: 40 }}
        placement="outside"
        side="right"
        width={380}
      >
        %
      </AxisTitle>,
    );
    const title = container.querySelector('[data-slot="axis-title"]') as HTMLElement;
    expect(Number.parseFloat(title.style.height)).toBe(TICK_LINE_PX);
  });
});
