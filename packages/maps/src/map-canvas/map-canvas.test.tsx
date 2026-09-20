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

  describe("static mode (interactive={false})", () => {
    it("switches every gesture handler off but keeps MapLibre's own listeners", () => {
      render(<MapCanvas interactive={false} />);
      const options = MockMap.instances[0]!.options;
      for (const key of [
        "scrollZoom",
        "boxZoom",
        "dragRotate",
        "dragPan",
        "keyboard",
        "doubleClickZoom",
        "touchZoomRotate",
        "touchPitch",
      ]) {
        expect(options[key]).toBe(false);
      }
      // MapLibre's `interactive: false` would detach hover / click too.
      expect(options.interactive).toBeUndefined();
    });

    it("drops the grab cursor and the tab stop, and marks the container", async () => {
      const { container } = render(<MapCanvas interactive={false} />);
      const map = MockMap.instances[0]!;
      await waitFor(() => {
        expect(map.getCanvas().tabIndex).toBe(-1);
      });
      expect(map.canvasContainer).not.toHaveClass("maplibregl-interactive");
      expect(container.querySelector('[data-slot="map-canvas"]')).toHaveAttribute(
        "data-interactive",
        "false",
      );
    });

    it("turns the handlers back on when the map becomes interactive again", async () => {
      const { rerender } = render(<MapCanvas interactive={false} />);
      const map = MockMap.instances[0]!;
      await waitFor(() => expect(map.dragPan.enabled).toBe(false));
      rerender(<MapCanvas interactive scrollZoom={false} />);
      await waitFor(() => expect(map.dragPan.enabled).toBe(true));
      // An explicit `scrollZoom={false}` stays off.
      expect(map.scrollZoom.enabled).toBe(false);
      expect(map.getCanvas().tabIndex).toBe(0);
    });

    it("leaves an interactive map's handlers alone (no default change)", async () => {
      render(<MapCanvas />);
      const map = MockMap.instances[0]!;
      const disable = vi.spyOn(map.dragPan, "disable");
      const enable = vi.spyOn(map.dragPan, "enable");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(disable).not.toHaveBeenCalled();
      expect(enable).not.toHaveBeenCalled();
      expect(map.options.dragPan).toBeUndefined();
    });
  });

  it('accepts the "globe" shorthand and applies it as a projection spec', async () => {
    render(<MapCanvas projection="globe" />);
    const map = MockMap.instances[0]!;
    const setProjection = vi.spyOn(map, "setProjection");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(setProjection).toHaveBeenCalledWith({ type: "globe" });
  });

  it("ignores a projection when the MapLibre build cannot switch one", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<MapCanvas projection="globe" />);
    const map = MockMap.instances[0]!;
    (map as unknown as { setProjection: unknown }).setProjection = undefined;
    await act(async () => {
      map.emit("styledata");
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("cannot switch projections"));
    warn.mockRestore();
  });

  describe("height and tiers", () => {
    function atWidth(width: number) {
      return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        width,
        height: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    }

    it("publishes its tier and gives an unsized map the default aspect", () => {
      const spy = atWidth(348);
      const { container } = render(<MapCanvas />);
      const root = container.querySelector<HTMLElement>('[data-slot="map-canvas"]')!;
      expect(root).toHaveAttribute("data-map-breakpoint", "narrow");
      expect(root.style.aspectRatio).toBe("1 / 1");
      // `h-full` still sizes a map whose parent has a height of its own.
      expect(root).toHaveClass("h-full");
      spy.mockRestore();
    });

    it("sizes the box for its tier BEFORE MapLibre measures it", () => {
      const spy = atWidth(348);
      render(<MapCanvas />);
      const map = MockMap.instances[0]!;
      // The narrow square was already on the box when the map was built, so
      // the canvas and any `bounds` fit use the final size.
      expect(map.aspectAtConstruction).toBe("1 / 1");
      spy.mockRestore();
    });

    // A height / aspect change is layout the ENGINE measures. `transition-property`
    // defaults to `all` and the house reduced-motion clamp forces a 0.01 ms
    // duration on every element, so without this the new rule only lands on the
    // next animation frame — ~0.7 s away under a busy WebGL first paint, long
    // after MapLibre measured the box.
    it("never lets the box's geometry animate", () => {
      const spy = atWidth(348);
      const { container } = render(<MapCanvas />);
      const root = container.querySelector<HTMLElement>('[data-slot="map-canvas"]')!;
      expect(root.style.transitionProperty).toBe("none");
      expect(MockMap.instances[0]!.transitionAtConstruction).toBe("none");
      spy.mockRestore();
    });

    it("resolves a responsive height at the measured tier", () => {
      const spy = atWidth(868);
      const { container } = render(<MapCanvas height={{ base: 420, narrow: { aspect: 1 } }} />);
      const root = container.querySelector<HTMLElement>('[data-slot="map-canvas"]')!;
      expect(root).toHaveAttribute("data-map-breakpoint", "wide");
      expect(root.style.height).toBe("420px");
      spy.mockRestore();
    });

    // MapLibre fits `bounds` ONCE, against the box it measures at construction.
    // A box that settles later (a responsive height landing after the first
    // paint, a panel opening) used to keep that stale viewport: measured on the
    // narrow locator, a 348×218 fit left on a 348×348 box drew North America
    // instead of Lake Ontario ("500 km" on the scale bar, not "50 km").
    describe("re-fitting bounds when the box settles", () => {
      const BOUNDS: [[number, number], [number, number]] = [
        [-80.05, 43.2],
        [-76.2, 44.28],
      ];

      /** A resizable box: mutate `box`, then `fireResize()`. */
      function sizedBox(box: { width: number; height: number }) {
        const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
          () =>
            ({
              width: box.width,
              height: box.height,
              top: 0,
              left: 0,
              right: box.width,
              bottom: box.height,
              x: 0,
              y: 0,
              toJSON: () => ({}),
            }) as DOMRect,
        );
        const callbacks: ResizeObserverCallback[] = [];
        class TestResizeObserver {
          constructor(callback: ResizeObserverCallback) {
            callbacks.push(callback);
          }
          observe() {}
          unobserve() {}
          disconnect() {}
        }
        const previous = globalThis.ResizeObserver;
        globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
        return {
          fireResize: () =>
            act(() => {
              callbacks.forEach((callback) =>
                callback([] as unknown as ResizeObserverEntry[], {} as ResizeObserver),
              );
            }),
          restore: () => {
            rectSpy.mockRestore();
            globalThis.ResizeObserver = previous;
          },
        };
      }

      it("re-fits bounds after the container box changes size", () => {
        const box = { width: 348, height: 218 };
        const { fireResize, restore } = sizedBox(box);
        render(<MapCanvas bounds={BOUNDS} fitBoundsOptions={{ padding: 24 }} />);
        const map = MockMap.instances[0]!;
        // Nothing to re-fit while the box is the one MapLibre measured.
        expect(map.fitBoundsCalls).toEqual([]);

        box.height = 348;
        fireResize();

        expect(map.fitBoundsCalls).toEqual([
          { bounds: BOUNDS, options: { padding: 24, duration: 0 } },
        ]);
        expect(map.resizeCount).toBeGreaterThan(0);
        restore();
      });

      it("stops re-fitting once a gesture has moved the map", () => {
        const box = { width: 868, height: 543 };
        const { fireResize, restore } = sizedBox(box);
        render(<MapCanvas bounds={BOUNDS} />);
        const map = MockMap.instances[0]!;
        act(() => {
          map.emit("movestart", undefined, { originalEvent: new MouseEvent("mousedown") });
        });

        box.height = 300;
        fireResize();

        expect(map.fitBoundsCalls).toEqual([]);
        // The canvas still follows the box — only the framing is left alone.
        expect(map.resizeCount).toBeGreaterThan(0);
        restore();
      });

      it("resizes but never fits a map that was not given bounds", () => {
        const box = { width: 868, height: 543 };
        const { fireResize, restore } = sizedBox(box);
        render(<MapCanvas center={[-79.38, 43.65]} zoom={9} />);
        const map = MockMap.instances[0]!;
        const before = map.resizeCount;

        box.height = 300;
        fireResize();

        expect(map.fitBoundsCalls).toEqual([]);
        expect(map.resizeCount).toBeGreaterThan(before);
        restore();
      });
    });

    it("renders no strips above or below the map until furniture asks", () => {
      const { container } = render(<MapCanvas className="my-map" />);
      expect(container.firstChild).toHaveClass("my-map");
      expect(container.querySelector('[data-slot="map-canvas-above"]')).toBeNull();
      expect(container.querySelector('[data-slot="map-canvas-below"]')).toBeNull();
    });
  });
});

describe("MapCanvas basemap labels (c-6, c-11)", () => {
  /** A basemap's own layers: two label layers and one that only draws ground. */
  function seedBasemapLayers(map: MockMap) {
    map.addLayer({ id: "place-city", type: "symbol", layout: { "text-field": ["get", "name"] } });
    map.addLayer({ id: "water-name", type: "symbol", layout: { "text-field": ["get", "name"] } });
    map.addLayer({ id: "landcover", type: "fill", paint: { "fill-color": "#eee" } });
  }

  it("keeps the basemap's own labels by default", async () => {
    const { rerender } = render(<MapCanvas />);
    const map = MockMap.instances[0]!;
    seedBasemapLayers(map);
    rerender(<MapCanvas basemapLabels />);
    await waitFor(() => expect(map.layoutProperties.size).toBe(0));
  });

  it("hides every text label layer when basemapLabels is false, and only those", async () => {
    const { rerender } = render(<MapCanvas />);
    const map = MockMap.instances[0]!;
    seedBasemapLayers(map);
    rerender(<MapCanvas basemapLabels={false} />);
    await waitFor(() => {
      expect(map.getLayoutProperty("place-city", "visibility")).toBe("none");
      expect(map.getLayoutProperty("water-name", "visibility")).toBe("none");
    });
    expect(map.getLayoutProperty("landcover", "visibility")).toBeUndefined();
  });

  it("restores only the label layers it hid when basemapLabels goes back on", async () => {
    const { rerender } = render(<MapCanvas />);
    const map = MockMap.instances[0]!;
    seedBasemapLayers(map);
    // A layer the STYLE itself ships hidden must stay hidden.
    map.addLayer({ id: "poi-name", type: "symbol", layout: { "text-field": ["get", "name"] } });
    map.setLayoutProperty("poi-name", "visibility", "none");

    rerender(<MapCanvas basemapLabels={false} />);
    await waitFor(() => expect(map.getLayoutProperty("place-city", "visibility")).toBe("none"));

    rerender(<MapCanvas basemapLabels />);
    await waitFor(() => expect(map.getLayoutProperty("place-city", "visibility")).toBe("visible"));
    expect(map.getLayoutProperty("water-name", "visibility")).toBe("visible");
    expect(map.getLayoutProperty("poi-name", "visibility")).toBe("none");
  });

  // c-10: MapLibre owns the canvas element, so the house focus indicator has
  // to be put on it — a bare canvas paints the browser's own blue outline,
  // which does not follow the theme.
  it("gives the MapLibre canvas the house focus ring", async () => {
    render(<MapCanvas />);
    const map = MockMap.instances[0]!;
    await waitFor(() => expect(map.getCanvas().classList.contains("focus-ring")).toBe(true));
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
    expect(map.fitBoundsCalls.at(-1)!.bounds).toEqual(square.bounds);
    expect(map.maxBounds).toEqual(square.maxBounds());
  });
});
