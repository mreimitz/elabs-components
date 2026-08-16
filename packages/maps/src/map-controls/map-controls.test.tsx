import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { MapControls } from "./map-controls";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
});

describe("MapControls", () => {
  it("renders zoom buttons by default with accessible names", async () => {
    render(
      <MapCanvas>
        <MapControls />
      </MapCanvas>,
    );
    expect(await screen.findByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reset bearing to north" }),
    ).not.toBeInTheDocument();
  });

  it("renders compass, locate and fullscreen controls when enabled", async () => {
    render(
      <MapCanvas>
        <MapControls showCompass showLocate showFullscreen />
      </MapCanvas>,
    );
    expect(
      await screen.findByRole("button", { name: "Reset bearing to north" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find my location" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle fullscreen" })).toBeInTheDocument();
  });

  it("zooms the map when zoom in is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MapCanvas>
        <MapControls />
      </MapCanvas>,
    );
    await user.click(await screen.findByRole("button", { name: "Zoom in" }));
    expect(MockMap.instances[0]!.zoomToCalls.length).toBeGreaterThan(0);
  });
});
