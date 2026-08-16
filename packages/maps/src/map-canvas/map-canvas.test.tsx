import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
});
