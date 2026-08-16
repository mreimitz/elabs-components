import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// MapLibre throws at construction when WebGL is unavailable — the canvas must
// degrade to a quiet panel, not an unhandled render error (smoke-test contract).
vi.mock("maplibre-gl", () => {
  class ThrowingMap {
    constructor() {
      throw new Error("Failed to initialize WebGL");
    }
  }
  return { default: { Map: ThrowingMap }, Map: ThrowingMap };
});

import { MapCanvas } from "./map-canvas";

afterEach(cleanup);

describe("MapCanvas without WebGL", () => {
  it("renders the unavailable panel instead of throwing", () => {
    render(
      <MapCanvas className="my-map">
        <div data-testid="child" />
      </MapCanvas>,
    );
    expect(screen.getByText("Map unavailable")).toBeInTheDocument();
    // Children (which need the map context) are not rendered in this state.
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });
});
