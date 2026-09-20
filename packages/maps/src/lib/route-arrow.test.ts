import { afterEach, describe, expect, it, vi } from "vitest";

import { createRouteArrowImage, ROUTE_ARROW_SIZE, routeArrowImageId } from "./route-arrow";

interface Stroked {
  points: [number, number][];
  strokeStyle: string;
}

/** A 2D context that records the path instead of rasterizing it. */
function stubCanvasContext() {
  const drawn: Stroked = { points: [], strokeStyle: "" };

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (kind: string) {
    if (kind !== "2d") return null;
    const context = {
      set strokeStyle(value: string) {
        drawn.strokeStyle = value;
      },
      get strokeStyle() {
        return drawn.strokeStyle;
      },
      lineWidth: 0,
      lineCap: "butt",
      lineJoin: "miter",
      clearRect: () => {},
      beginPath: () => {},
      moveTo: (x: number, y: number) => drawn.points.push([x, y]),
      lineTo: (x: number, y: number) => drawn.points.push([x, y]),
      stroke: () => {},
      getImageData: (_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
    };
    return context as unknown as CanvasRenderingContext2D;
  });

  return drawn;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("routeArrowImageId", () => {
  it("is one image per route, since the ink is per route", () => {
    expect(routeArrowImageId("aisle")).toBe("route-arrow-aisle");
    expect(routeArrowImageId("aisle")).not.toBe(routeArrowImageId("conveyor"));
  });
});

describe("createRouteArrowImage", () => {
  it("returns null with no 2D context, so the caller leaves the layer out", () => {
    // jsdom, unstubbed: an arrow layer pointing at a missing image draws nothing
    // and warns every frame, so the caller must be able to tell.
    expect(createRouteArrowImage("#000")).toBeNull();
  });

  it("draws a chevron pointing along +x, in the ink it was given", () => {
    const drawn = stubCanvasContext();

    const image = createRouteArrowImage("rgb(4, 5, 6)");

    expect(image).toEqual({
      width: ROUTE_ARROW_SIZE,
      height: ROUTE_ARROW_SIZE,
      data: new Uint8ClampedArray(ROUTE_ARROW_SIZE * ROUTE_ARROW_SIZE * 4),
    });
    expect(drawn.strokeStyle).toBe("rgb(4, 5, 6)");

    // Three points: back-top, tip, back-bottom. The tip is the rightmost point
    // and sits on the middle row — MapLibre aligns a line-placed symbol's x axis
    // with the line, so +x is "forward".
    expect(drawn.points).toHaveLength(3);
    const [top, tip, bottom] = drawn.points as [
      [number, number],
      [number, number],
      [number, number],
    ];
    expect(tip[0]).toBeGreaterThan(top[0]);
    expect(tip[0]).toBeGreaterThan(bottom[0]);
    expect(tip[1]).toBeCloseTo(ROUTE_ARROW_SIZE / 2, 5);
    expect(top[1]).toBeLessThan(tip[1]);
    expect(bottom[1]).toBeGreaterThan(tip[1]);
    // Symmetric about the middle row, so the chevron is not lopsided.
    expect(top[1] + bottom[1]).toBeCloseTo(ROUTE_ARROW_SIZE, 5);
  });
});
