import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

  it("hides zoom chrome on a static map, and renders no control box at all", async () => {
    const { container } = render(
      <MapCanvas interactive={false}>
        <MapControls />
      </MapCanvas>,
    );
    await waitFor(() => {
      expect(container.querySelector("[data-slot='map-canvas']")).not.toBeNull();
    });
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zoom out" })).not.toBeInTheDocument();
    // No empty, absolutely-positioned control box left behind either.
    expect(container.querySelector(".absolute.z-10")).toBeNull();
  });

  it("keeps zoom chrome on a static map when the host asks for it", async () => {
    render(
      <MapCanvas interactive={false}>
        <MapControls showZoom />
      </MapCanvas>,
    );
    expect(await screen.findByRole("button", { name: "Zoom in" })).toBeInTheDocument();
  });

  it("still renders an explicitly enabled group on a static map", async () => {
    render(
      <MapCanvas interactive={false}>
        <MapControls showFullscreen />
      </MapCanvas>,
    );
    expect(await screen.findByRole("button", { name: "Toggle fullscreen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
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
