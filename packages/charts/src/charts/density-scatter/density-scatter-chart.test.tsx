/**
 * `DensityScatterChart` in jsdom: no WebGL, a stubbed 2D context (the
 * package's own `installCanvasContextStub`), a stubbed ResizeObserver. What
 * this file can check is the DOM contract — the figure semantics, the parallel
 * summary, the keyboard range sliders, the zone tags, the legend toggle, the
 * intents — not the pixels; the stories carry the picture.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { installCanvasContextStub } from "../../test/primitives";
import { DensityScatterChart } from "./density-scatter-chart";
import { buildLateralTraffic, LATERAL_ZONES } from "./fixtures";
import type { ChartSelectionIntent } from "../selection/types";

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

const DATA = buildLateralTraffic(2_000);

describe("DensityScatterChart", () => {
  it("renders a figure with a parallel summary naming the zone shares", () => {
    render(
      <DensityScatterChart accessibleLabel="Lateral deviation" data={DATA} zones={LATERAL_ZONES} />,
    );
    const figure = screen.getByRole("figure", { name: "Lateral deviation" });
    expect(figure).toHaveAttribute("data-slot", "density-scatter-chart");
    expect(figure).toHaveAccessibleDescription(
      /2,000 points; x from .*; zones: Core \d+%, Expanded EIS \d+%, Outside \d+%/,
    );
    // No gestures → no sliders, no gutters.
    expect(screen.queryByRole("slider")).toBeNull();
    // Canvas surfaces are hidden from AT.
    expect(figure.querySelectorAll("canvas[aria-hidden='true']")).toHaveLength(2);
  });

  it("mounts keyboard range sliders with gestures and emits range intents", () => {
    const intents: ChartSelectionIntent[] = [];
    const changes: unknown[] = [];
    render(
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={DATA}
        onSelectionChange={(s) => changes.push(s)}
        onSelectionIntent={(i) => intents.push(i)}
        selectionGestures={["range", "lasso"]}
        xKey="along"
        zones={LATERAL_ZONES}
      />,
    );
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(4);
    const xFrom = screen.getByRole("slider", { name: "x range from" });
    fireEvent.keyDown(xFrom, { key: "ArrowRight" });
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      field: "along",
      mode: "replace",
      source: "keyboard",
      gesture: { kind: "range", axis: "x" },
    });
    expect(changes[0]).toMatchObject({ x: expect.any(Array) });
    fireEvent.keyDown(xFrom, { key: "Escape" });
    expect(changes[1]).toEqual({});
  });

  it("legend toggles hide a class; a modifier-click selects it", () => {
    const intents: ChartSelectionIntent[] = [];
    const hidden: ReadonlySet<string>[] = [];
    const selections: unknown[] = [];
    render(
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={DATA}
        legend
        onHiddenKeysChange={(k) => hidden.push(k)}
        onSelectionChange={(s) => selections.push(s)}
        onSelectionIntent={(i) => intents.push(i)}
        zones={LATERAL_ZONES}
      />,
    );
    const core = screen.getByRole("button", { name: /Core/, pressed: true });
    fireEvent.click(core);
    expect([...hidden[0]!]).toEqual(["core"]);
    expect(selections).toHaveLength(0);
    fireEvent.click(core, { shiftKey: true });
    expect(selections[0]).toEqual({ zones: ["core"] });
    expect(intents[0]).toMatchObject({
      field: "zone",
      values: ["core"],
      mode: "add",
      gesture: { kind: "click", category: "core" },
    });
    expect(hidden).toHaveLength(1);
  });

  it("reports the renderer it could get", () => {
    const { container } = render(<DensityScatterChart data={DATA} />);
    // jsdom + the 2D stub → the Canvas-2D fallback, never WebGL.
    expect(container.querySelector("[data-slot='density-scatter-chart']")).toHaveAttribute(
      "data-renderer",
      "canvas2d",
    );
  });
});
