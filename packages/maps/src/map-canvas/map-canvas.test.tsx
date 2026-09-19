import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// maplibre-gl requires WebGL — mock the engine and assert the brand wrapper's
// own output. Real rendering + a11y are covered by Storybook story tests.
vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, resetMaplibreMock } from "../test-utils/maplibre-mock";
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

    it("resolves a responsive height at the measured tier", () => {
      const spy = atWidth(868);
      const { container } = render(<MapCanvas height={{ base: 420, narrow: { aspect: 1 } }} />);
      const root = container.querySelector<HTMLElement>('[data-slot="map-canvas"]')!;
      expect(root).toHaveAttribute("data-map-breakpoint", "wide");
      expect(root.style.height).toBe("420px");
      spy.mockRestore();
    });

    it("renders no strips above or below the map until furniture asks", () => {
      const { container } = render(<MapCanvas className="my-map" />);
      expect(container.firstChild).toHaveClass("my-map");
      expect(container.querySelector('[data-slot="map-canvas-above"]')).toBeNull();
      expect(container.querySelector('[data-slot="map-canvas-below"]')).toBeNull();
    });
  });
});
