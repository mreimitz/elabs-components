import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { MapInset } from "./map-inset";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
});

describe("MapInset", () => {
  it("renders a second, static globe canvas that marks the main view", async () => {
    render(
      <MapCanvas>
        <MapInset />
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMap.instances).toHaveLength(2));
    const inset = MockMap.instances[1]!;
    expect(inset.options.dragPan).toBe(false);
    expect(inset.options.scrollZoom).toBe(false);
    await waitFor(() =>
      expect([...inset.layers.keys()].some((id) => id.includes("map-inset-box"))).toBe(true),
    );
    const wrapper = document.querySelector<HTMLElement>('[data-slot="map-inset"]')!;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(wrapper).toHaveAttribute("data-kind", "globe");
    expect(wrapper.style.maxWidth).toBe("40%");
  });

  it("uses a zoomed-out mercator map for a region inset", async () => {
    render(
      <MapCanvas zoom={7}>
        <MapInset kind="region" />
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMap.instances).toHaveLength(2));
    expect(MockMap.instances[1]!.options.projection).toBeUndefined();
    expect(document.querySelector('[data-slot="map-inset"]')).toHaveAttribute(
      "data-kind",
      "region",
    );
  });
});
