/**
 * jsdom ships no 2D canvas context, which is exactly the environment
 * `createPlanPatternTile` must survive — so the no-context path is asserted for
 * real, and the drawing itself is asserted against a recording stub.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type MapLibreGL from "maplibre-gl";

import { MockMap } from "../test-utils/maplibre-mock";
import { createPlanPatternTile, planPatternImageId, usePlanPatterns } from "./plan-patterns";
import { PLAN_STATUSES, PLAN_STATUS_ENCODING, type PlanPatternKind } from "./plan-status";

interface DrawnLine {
  from: [number, number];
  to: [number, number];
  width: number;
}

interface RecordingContext {
  lines: DrawnLine[];
  strokeStyle: string;
  globalAlpha: number;
  lineWidth: number;
}

/** A 2D context that records what was stroked instead of rasterizing it. */
function stubCanvasContext() {
  const recorded: RecordingContext[] = [];

  const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
    kind: string,
  ) {
    if (kind !== "2d") return null;

    const state: RecordingContext = {
      lines: [],
      strokeStyle: "",
      globalAlpha: 1,
      lineWidth: 1,
    };
    recorded.push(state);

    let pen: [number, number] = [0, 0];
    const context = {
      set strokeStyle(value: string) {
        state.strokeStyle = value;
      },
      get strokeStyle() {
        return state.strokeStyle;
      },
      set globalAlpha(value: number) {
        state.globalAlpha = value;
      },
      get globalAlpha() {
        return state.globalAlpha;
      },
      set lineWidth(value: number) {
        state.lineWidth = value;
      },
      get lineWidth() {
        return state.lineWidth;
      },
      lineCap: "butt",
      clearRect: () => {},
      beginPath: () => {},
      moveTo: (x: number, y: number) => {
        pen = [x, y];
      },
      lineTo: (x: number, y: number) => {
        state.lines.push({ from: pen, to: [x, y], width: state.lineWidth });
      },
      stroke: () => {},
      getImageData: (_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
    };

    return context as unknown as CanvasRenderingContext2D;
  });

  return { recorded, spy };
}

afterEach(() => {
  vi.restoreAllMocks();
  MockMap.instances = [];
});

describe("planPatternImageId", () => {
  it("namespaces the id, so two plans on one map cannot collide", () => {
    expect(planPatternImageId("diagonal")).toBe("plan-pattern-diagonal");
    const kinds: PlanPatternKind[] = ["diagonal", "cross", "dense"];
    expect(new Set(kinds.map(planPatternImageId)).size).toBe(kinds.length);
  });
});

describe("createPlanPatternTile", () => {
  it("returns null for the untextured status and for a context-less environment", () => {
    // No stub: jsdom has no 2D context, and the dash channel carries the meaning.
    expect(createPlanPatternTile("none", "#000")).toBeNull();
    expect(createPlanPatternTile("diagonal", "#000")).toBeNull();
  });

  it("draws a 16px tile in the ink it was handed, below full alpha", () => {
    const { recorded } = stubCanvasContext();

    const tile = createPlanPatternTile("diagonal", "rgb(1, 2, 3)");

    expect(tile).not.toBeNull();
    expect(tile!.width).toBe(16);
    expect(tile!.height).toBe(16);
    expect(recorded[0]!.strokeStyle).toBe("rgb(1, 2, 3)");
    expect(recorded[0]!.globalAlpha).toBeLessThan(1);
  });

  it("gives each kind its own line geometry, and joins across tile edges", () => {
    const { recorded } = stubCanvasContext();

    createPlanPatternTile("diagonal", "#000");
    createPlanPatternTile("cross", "#000");
    createPlanPatternTile("dense", "#000");

    const [diagonal, cross, dense] = recorded as [
      RecordingContext,
      RecordingContext,
      RecordingContext,
    ];

    // `cross` hatches both ways; the other two run one way only.
    const slopes = (state: RecordingContext) =>
      new Set(
        state.lines.map((line) =>
          Math.sign((line.to[1] - line.from[1]) / (line.to[0] - line.from[0])),
        ),
      );
    expect(slopes(diagonal).size).toBe(1);
    expect(slopes(cross).size).toBe(2);
    // `dense` is the same direction as `diagonal` at half the spacing, so it
    // must draw more lines or the two would read alike.
    expect(dense.lines.length).toBeGreaterThan(diagonal.lines.length);
    expect(slopes(dense).size).toBe(1);

    // Every line starts or ends outside the 16px tile: that overshoot is what
    // makes the pattern seamless across tile edges.
    for (const state of recorded) {
      for (const line of state.lines) {
        const coordinates = [...line.from, ...line.to];
        expect(coordinates.some((value) => value < 0 || value > 16)).toBe(true);
      }
    }
  });
});

describe("usePlanPatterns", () => {
  const renderWith = (map: MockMap | null, isLoaded = true, ink = "#111") =>
    renderHook(
      ({ ink: currentInk }: { ink: string }) =>
        usePlanPatterns(map as unknown as MapLibreGL.Map | null, isLoaded, currentInk),
      { initialProps: { ink } },
    );

  it("registers one image per textured status, at pixelRatio 2", () => {
    stubCanvasContext();
    const map = new MockMap({ container: document.createElement("div") });

    renderWith(map);

    const textured = new Set(
      PLAN_STATUSES.map((status) => PLAN_STATUS_ENCODING[status].pattern).filter(
        (pattern) => pattern !== "none",
      ),
    );
    expect(map.addImageCalls).toHaveLength(textured.size);
    for (const [id, , options] of map.addImageCalls) {
      expect(id.startsWith("plan-pattern-")).toBe(true);
      expect(options).toEqual({ pixelRatio: 2 });
    }
    expect(map.hasImage(planPatternImageId("diagonal"))).toBe(true);
  });

  it("re-registers on styledata, because setStyle drops every style image", () => {
    stubCanvasContext();
    const map = new MockMap({ container: document.createElement("div") });

    renderWith(map);
    const added = map.addImageCalls.length;
    map.updateImageCalls = [];

    // A theme swap calls setStyle, which fires styledata with the images gone.
    map.emit("styledata");

    // Second pass updates in place rather than adding twice.
    expect(map.addImageCalls).toHaveLength(added);
    expect(map.updateImageCalls.length).toBeGreaterThan(0);
  });

  it("stops listening when it unmounts", () => {
    stubCanvasContext();
    const map = new MockMap({ container: document.createElement("div") });

    const view = renderWith(map);
    view.unmount();
    map.updateImageCalls = [];
    map.emit("styledata");

    expect(map.updateImageCalls).toHaveLength(0);
  });

  it("redraws when the ink changes, so a theme swap re-inks the hatch", () => {
    const { recorded } = stubCanvasContext();
    const map = new MockMap({ container: document.createElement("div") });

    const view = renderWith(map);
    // Only the drawing passes count: the registration reads the tile back
    // through a second `getContext("2d")` that strokes nothing.
    const inks = () =>
      new Set(recorded.filter((state) => state.lines.length > 0).map((state) => state.strokeStyle));
    expect(inks()).toEqual(new Set(["#111"]));

    view.rerender({ ink: "#eee" });

    expect(inks()).toEqual(new Set(["#111", "#eee"]));
  });

  it("does nothing without a map or before the style loads", () => {
    stubCanvasContext();
    const map = new MockMap({ container: document.createElement("div") });

    renderWith(null);
    renderWith(map, false);

    expect(map.addImageCalls).toHaveLength(0);
  });
});
