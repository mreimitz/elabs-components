import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@elabs-ai/components-ui";

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

  it("takes every label from the locale seam, so an app can translate them", async () => {
    render(
      <LocaleProvider
        locale="de-DE"
        messages={{
          "maps.controls.zoomIn": "Hineinzoomen",
          "maps.controls.zoomOut": "Herauszoomen",
          "maps.controls.resetBearing": "Nach Norden ausrichten",
          "maps.controls.locate": "Meinen Standort finden",
          "maps.controls.fullscreen": "Vollbild umschalten",
          "maps.controls.fit": "Ganzen Plan zeigen",
        }}
      >
        <MapCanvas plan={{ width: 100, height: 50 }}>
          <MapControls showCompass showLocate showFullscreen />
        </MapCanvas>
      </LocaleProvider>,
    );

    for (const name of [
      "Hineinzoomen",
      "Herauszoomen",
      "Nach Norden ausrichten",
      "Meinen Standort finden",
      "Ganzen Plan zeigen",
      "Vollbild umschalten",
    ]) {
      expect(await screen.findByRole("button", { name })).toBeInTheDocument();
    }
  });
});

describe("MapControls fit button", () => {
  it("stays off a geographic map and appears on a plan", async () => {
    const { unmount } = render(
      <MapCanvas>
        <MapControls />
      </MapCanvas>,
    );
    expect(await screen.findByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fit the whole plan" })).not.toBeInTheDocument();
    unmount();

    render(
      <MapCanvas plan={{ width: 100, height: 50 }}>
        <MapControls />
      </MapCanvas>,
    );
    expect(await screen.findByRole("button", { name: "Fit the whole plan" })).toBeInTheDocument();
  });

  it("frames the plan's own extent and reports back", async () => {
    const user = userEvent.setup();
    const onFit = vi.fn();
    render(
      <MapCanvas plan={{ width: 100, height: 50 }}>
        <MapControls onFit={onFit} />
      </MapCanvas>,
    );

    const map = MockMap.instances[0]!;
    const before = map.fitBoundsCalls.length;
    await user.click(await screen.findByRole("button", { name: "Fit the whole plan" }));

    expect(map.fitBoundsCalls.length).toBe(before + 1);
    expect(map.fitBoundsCalls.at(-1)!.options).toMatchObject({ padding: 24 });
    expect(onFit).toHaveBeenCalledTimes(1);
  });

  it("frames caller bounds when they are given", async () => {
    const user = userEvent.setup();
    const bounds: [[number, number], [number, number]] = [
      [-1, -2],
      [3, 4],
    ];
    render(
      <MapCanvas plan={{ width: 100, height: 50 }}>
        <MapControls fitBounds={bounds} />
      </MapCanvas>,
    );

    const map = MockMap.instances[0]!;
    await user.click(await screen.findByRole("button", { name: "Fit the whole plan" }));

    expect(map.fitBoundsCalls.at(-1)!.bounds).toEqual(bounds);
  });

  // A static plan map drops the zoom chrome but still needs the fit button: it is
  // the only way back for a reader who cannot pan.
  it("survives a static plan map, where the zoom chrome is gone", async () => {
    render(
      <MapCanvas interactive={false} plan={{ width: 100, height: 50 }}>
        <MapControls />
      </MapCanvas>,
    );
    expect(await screen.findByRole("button", { name: "Fit the whole plan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
  });

  it("can be turned off on a plan", async () => {
    render(
      <MapCanvas plan={{ width: 100, height: 50 }}>
        <MapControls showFit={false} />
      </MapCanvas>,
    );
    expect(await screen.findByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fit the whole plan" })).not.toBeInTheDocument();
  });
});
