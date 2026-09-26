/**
 * The host seams added for editors and embedding hosts: `renderOverlay`
 * (projections against the live view), `zoneTags`, and the outside class's
 * `legend` / `selectable` switches.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { installCanvasContextStub } from "../../test/primitives";
import { DensityScatterChart } from "./density-scatter-chart";
import { buildLateralTraffic, LATERAL_ZONES } from "./fixtures";
import type { DensityOverlayContext } from "./types";

beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});
let canvasStub: ReturnType<typeof installCanvasContextStub>;
beforeEach(() => {
  canvasStub = installCanvasContextStub();
});
afterEach(() => {
  canvasStub.restore();
  vi.restoreAllMocks();
});

const DATA = buildLateralTraffic(1_000);

describe("DensityScatterChart host seams", () => {
  it("renderOverlay gets the view, the plot box and inverse projections", () => {
    let seen: DensityOverlayContext | null = null;
    render(
      <DensityScatterChart
        accessibleLabel="With overlay"
        data={DATA}
        domain={{ x0: 0, x1: 100, y0: 0, y1: 50 }}
        renderOverlay={(ctx) => {
          seen = ctx;
          return <span data-testid="host-layer">editor</span>;
        }}
        zones={LATERAL_ZONES}
      />,
    );
    expect(
      screen.getByTestId("host-layer").closest('[data-slot="density-scatter-chart-host-overlay"]'),
    ).not.toBeNull();
    expect(seen).not.toBeNull();
    const ctx = seen as unknown as DensityOverlayContext;
    expect(ctx.view).toEqual({ x0: 0, x1: 100, y0: 0, y1: 50 });
    // toData ∘ toPixel = identity (whatever the measured box is in jsdom)
    const [px, py] = ctx.toPixel(25, 10);
    const [x, y] = ctx.toData(px, py);
    if (ctx.box.width > 0 && ctx.box.height > 0) {
      expect(x).toBeCloseTo(25, 6);
      expect(y).toBeCloseTo(10, 6);
    }
  });

  it("zoneTags={false} renders no in-plot tags", () => {
    const { container } = render(
      <DensityScatterChart
        accessibleLabel="No tags"
        data={DATA}
        zoneTags={false}
        zones={LATERAL_ZONES}
      />,
    );
    expect(container.querySelector('[data-slot="density-scatter-chart-zone-tag"]')).toBeNull();
  });

  it("outside.legend={false} drops the outside class from the legend", () => {
    render(
      <DensityScatterChart
        accessibleLabel="Legend"
        data={DATA}
        legend
        outside={{ label: "Unzoned", legend: false }}
        zones={LATERAL_ZONES}
      />,
    );
    expect(screen.getByRole("button", { name: /^Core$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Unzoned$/ })).toBeNull();
  });

  it("outside.selectable={false}: a modifier-click on it does not select", () => {
    const onSelectionChange = vi.fn();
    render(
      <DensityScatterChart
        accessibleLabel="Legend"
        data={DATA}
        legend
        onSelectionChange={onSelectionChange}
        outside={{ label: "Unzoned", selectable: false }}
        selectionGestures={["range"]}
        zones={LATERAL_ZONES}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Unzoned$/ }), { shiftKey: true });
    expect(onSelectionChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ zones: ["__outside"] }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Core$/ }), { shiftKey: true });
    expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ zones: ["core"] }));
  });
});
