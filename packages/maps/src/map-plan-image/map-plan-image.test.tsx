import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { createPlanCrs } from "../lib/plan-crs";
import { resetMapWarnings } from "../lib/warn-once";
import { MapPlanImage } from "./map-plan-image";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
  resetMapWarnings();
});

const PLAN = { width: 1600, height: 900 };
const SRC = "https://plans.example.com/level-3.png";

function lastMap() {
  return MockMap.instances.at(-1)!;
}

describe("MapPlanImage", () => {
  it("covers the whole plan extent without being told any coordinates", async () => {
    render(
      <MapCanvas plan={PLAN}>
        <MapPlanImage id="floor" src={SRC} alt="Level 3 floor plan" />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getSource("plan-image-source-floor")).toBeDefined();
      return instance;
    });

    const source = map.getSource("plan-image-source-floor")!;
    expect(source.spec.type).toBe("image");
    expect(source.spec.url).toBe(SRC);
    expect(source.spec.coordinates).toEqual(createPlanCrs(PLAN).imageCoordinates);
  });

  it("places one wing of a plan from an extent in plan units", async () => {
    render(
      <MapCanvas plan={PLAN}>
        <MapPlanImage id="wing" src={SRC} extent={{ x: 100, y: 50, width: 400, height: 200 }} />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getSource("plan-image-source-wing")).toBeDefined();
      return instance;
    });

    const crs = createPlanCrs(PLAN);
    expect(map.getSource("plan-image-source-wing")!.spec.coordinates).toEqual([
      crs.toLngLat({ x: 100, y: 50 }),
      crs.toLngLat({ x: 500, y: 50 }),
      crs.toLngLat({ x: 500, y: 250 }),
      crs.toLngLat({ x: 100, y: 250 }),
    ]);
  });

  it("draws the picture under the data and never cross-fades a floor swap", async () => {
    render(
      <MapCanvas plan={PLAN}>
        <MapPlanImage id="floor" src={SRC} opacity={0.35} resampling="nearest" />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getLayer("plan-image-layer-floor")).toBeDefined();
      return instance;
    });

    const layer = map.getLayer("plan-image-layer-floor");
    expect(layer.type).toBe("raster");
    expect(layer.paint["raster-opacity"]).toBe(0.35);
    expect(layer.paint["raster-fade-duration"]).toBe(0);
    expect(layer.paint["raster-resampling"]).toBe("nearest");
  });

  it("swaps the picture in place instead of tearing the source down", async () => {
    const { rerender } = render(
      <MapCanvas plan={PLAN}>
        <MapPlanImage id="floor" src={SRC} />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getSource("plan-image-source-floor")).toBeDefined();
      return instance;
    });
    const source = map.getSource("plan-image-source-floor")!;

    rerender(
      <MapCanvas plan={PLAN}>
        <MapPlanImage id="floor" src="https://plans.example.com/level-4.png" />
      </MapCanvas>,
    );

    await waitFor(() => expect(source.updateImageCalls).toHaveLength(1));
    expect((source.updateImageCalls[0] as { url: string }).url).toBe(
      "https://plans.example.com/level-4.png",
    );
    expect(map.getSource("plan-image-source-floor")).toBe(source);
  });

  it("hides the picture with a visibility change, keeping the source mounted", async () => {
    const { rerender } = render(
      <MapCanvas plan={PLAN}>
        <MapPlanImage id="floor" src={SRC} />
      </MapCanvas>,
    );

    const map = await waitFor(() => {
      const instance = lastMap();
      expect(instance.getLayer("plan-image-layer-floor")).toBeDefined();
      return instance;
    });

    rerender(
      <MapCanvas plan={PLAN}>
        <MapPlanImage id="floor" src={SRC} visible={false} />
      </MapCanvas>,
    );

    await waitFor(() => expect(map.layout.get("plan-image-layer-floor:visibility")).toBe("none"));
    expect(map.getSource("plan-image-source-floor")).toBeDefined();
  });

  it("reports a failed picture on the source, not the map", async () => {
    const onError = vi.fn();
    const onLoad = vi.fn();
    render(
      <MapCanvas plan={PLAN}>
        <MapPlanImage id="floor" src={SRC} onLoad={onLoad} onError={onError} />
      </MapCanvas>,
    );

    const source = await waitFor(() => {
      const instance = lastMap().getSource("plan-image-source-floor");
      expect(instance).toBeDefined();
      return instance!;
    });

    source.emit("data", { sourceDataType: "content" });
    expect(onLoad).not.toHaveBeenCalled();

    source.emit("data", { sourceDataType: "metadata" });
    expect(onLoad).toHaveBeenCalledTimes(1);

    source.emit("error", { error: new Error("404") });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "404" }));
  });

  it("describes a picture assistive technology cannot reach", async () => {
    render(
      <MapCanvas plan={PLAN}>
        <MapPlanImage src={SRC} alt="Level 3 floor plan, 14 rooms around a central core" />
      </MapCanvas>,
    );

    expect(
      await screen.findByText("Level 3 floor plan, 14 rooms around a central core"),
    ).toHaveClass("sr-only");
  });
});
