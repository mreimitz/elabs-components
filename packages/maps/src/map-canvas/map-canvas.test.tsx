import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// maplibre-gl requires WebGL — mock the engine and assert the brand wrapper's
// own output. Real rendering + a11y are covered by Storybook story tests.
vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { createPlanCrs } from "../lib/plan-crs";
import { MapCanvas } from "./map-canvas";
import { useMap } from "./map-context";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
});

describe("MapCanvas", () => {
  it("renders the container and applies custom className", () => {
    const { container } = render(<MapCanvas className="my-map" />);
    expect(container.firstChild).toHaveClass("my-map");
  });

  it("creates a MapLibre map on mount and removes it on unmount", () => {
    const { unmount } = render(<MapCanvas />);
    expect(MockMap.instances).toHaveLength(1);
    unmount();
    expect(MockMap.instances[0]!.removed).toBe(true);
  });

  // A deliberate maintainer default for internal use — see
  // .claude/rules/map-components.md. The rule carries the constraint that the
  // Carto/OSM basemap legally requires the credit for PUBLIC surfaces; these two
  // tests exist so the default can't be flipped, or the override broken, silently.
  it("disables the MapLibre attribution control by default", () => {
    render(<MapCanvas />);
    expect(MockMap.instances[0]!.options.attributionControl).toBe(false);
  });

  it("lets a consumer re-enable the attribution control for a public surface", () => {
    render(<MapCanvas attributionControl={{ compact: true }} />);
    expect(MockMap.instances[0]!.options.attributionControl).toEqual({ compact: true });
  });

  it("renders children once the map instance exists", async () => {
    render(
      <MapCanvas>
        <div data-testid="child">child</div>
      </MapCanvas>,
    );
    expect(await screen.findByTestId("child")).toBeInTheDocument();
  });

  it("shows an accessible loading overlay while loading", () => {
    render(<MapCanvas loading />);
    expect(screen.getByRole("status", { name: "Loading map" })).toBeInTheDocument();
  });

  it("hides the loading overlay once loaded and not loading", async () => {
    render(<MapCanvas loading={false} />);
    // The mock fires "load" synchronously, so the overlay must be gone.
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("exposes the map instance through context", async () => {
    let seen: unknown = null;
    function Probe() {
      const { map } = useMap();
      seen = map;
      return null;
    }
    render(
      <MapCanvas>
        <Probe />
      </MapCanvas>,
    );
    await waitFor(() => {
      expect(seen).toBe(MockMap.instances[0]);
    });
  });

  it("useMap throws outside of MapCanvas", () => {
    function Bare() {
      useMap();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/within a <MapCanvas>/);
  });

  it("applies the CURRENT projection prop on a later styledata event, not the value from mount", async () => {
    const globe = { type: "globe" } as const;
    const mercator = { type: "mercator" } as const;
    const { rerender } = render(<MapCanvas projection={globe} />);
    const map = MockMap.instances[0]!;
    // Let the mount-time styledata's own 100ms timeout settle first.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    const setProjectionSpy = vi.spyOn(map, "setProjection");
    rerender(<MapCanvas projection={mercator} />);
    // The dedicated "sync projection on prop change" effect also fires here —
    // clear it so the assertion below isolates the `styledata` handler alone.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    setProjectionSpy.mockClear();

    // A style reload (theme swap, `setStyle`) re-fires `styledata` on the SAME
    // mount-only handler — it must read the current prop via a ref, not the
    // value closed over when the handler was registered.
    await act(async () => {
      map.emit("styledata");
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(setProjectionSpy).toHaveBeenCalledWith(mercator);
    expect(setProjectionSpy).not.toHaveBeenCalledWith(globe);
  });
});

describe("MapCanvas with a plan", () => {
  const PLAN = { width: 1600, height: 900 };

  it("keeps a geographic canvas free of every plan option", () => {
    render(<MapCanvas />);
    const { options } = MockMap.instances[0]!;

    expect(options.maxBounds).toBeUndefined();
    expect(options.minZoom).toBeUndefined();
    expect(options.maxZoom).toBeUndefined();
    expect(options.dragRotate).toBeUndefined();
    expect(options.cooperativeGestures).toBeUndefined();
    expect(options.bounds).toBeUndefined();
  });

  it("frames the plan and clamps the camera to it", () => {
    render(<MapCanvas plan={PLAN} />);
    const { options } = MockMap.instances[0]!;
    const crs = createPlanCrs(PLAN);

    expect(options.bounds).toEqual(crs.bounds);
    expect(options.maxBounds).toEqual(crs.maxBounds());
    expect(options.minZoom).toBe(crs.minZoom);
    expect(options.maxZoom).toBe(crs.maxZoom);
    // A plan has no north and no horizon: rotation and pitch stay off.
    expect(options.dragRotate).toBe(false);
    expect(options.pitchWithRotate).toBe(false);
    expect(options.touchPitch).toBe(false);
    expect(options.bearing).toBe(0);
    expect(options.pitch).toBe(0);
  });

  it("lets a caller override a plan default", () => {
    render(<MapCanvas plan={PLAN} maxZoom={4} cooperativeGestures={false} />);
    const { options } = MockMap.instances[0]!;

    expect(options.maxZoom).toBe(4);
    expect(options.cooperativeGestures).toBe(false);
  });

  it("does not wrap a plan around a globe", () => {
    render(<MapCanvas plan={PLAN} projection={{ type: "globe" }} />);

    expect(MockMap.instances[0]!.options.projection).toBeUndefined();
  });

  it("publishes the coordinate system on the context", async () => {
    let seen: ReturnType<typeof useMap> | null = null;
    function Probe() {
      seen = useMap();
      return null;
    }

    render(
      <MapCanvas plan={PLAN}>
        <Probe />
      </MapCanvas>,
    );

    await waitFor(() => expect(seen?.plan).not.toBeNull());
    expect(seen!.plan!.extent).toEqual({
      width: 1600,
      height: 900,
      origin: "top-left",
      unit: "px",
    });
  });

  it("re-frames and re-clamps when the plan changes size", async () => {
    const { rerender } = render(<MapCanvas plan={PLAN} />);
    const map = MockMap.instances[0]!;

    rerender(<MapCanvas plan={{ width: 400, height: 400 }} />);

    const square = createPlanCrs({ width: 400, height: 400 });
    await waitFor(() => expect(map.fitBoundsCalls.length).toBeGreaterThan(0));
    expect(map.fitBoundsCalls.at(-1)![0]).toEqual(square.bounds);
    expect(map.maxBounds).toEqual(square.maxBounds());
  });
});
