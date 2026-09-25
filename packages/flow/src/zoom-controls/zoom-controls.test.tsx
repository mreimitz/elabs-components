import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@elabs-ai/components-ui";

// @xyflow/react requires real layout/measurement — mock the engine and assert
// the brand component's own output. Real rendering + a11y are covered by
// Storybook interaction tests.
const zoomIn = vi.fn();
const zoomOut = vi.fn();
const fitView = vi.fn();

vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    useReactFlow: () => ({ zoomIn, zoomOut, fitView }),
    Panel: ({ children, position }: { children?: React.ReactNode; position?: string }) =>
      React.createElement(
        "div",
        { "data-testid": "rf-panel", "data-position": position },
        children,
      ),
  };
});

import { ZoomControls } from "./zoom-controls";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ZoomControls", () => {
  it("renders without throwing", () => {
    const { container } = render(<ZoomControls />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders Zoom in, Zoom out, and Fit view buttons", () => {
    render(<ZoomControls />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit view" })).toBeInTheDocument();
  });

  it("calls zoomIn when Zoom in button is clicked", () => {
    render(<ZoomControls />);
    screen.getByRole("button", { name: "Zoom in" }).click();
    expect(zoomIn).toHaveBeenCalledTimes(1);
  });

  it("calls zoomOut when Zoom out button is clicked", () => {
    render(<ZoomControls />);
    screen.getByRole("button", { name: "Zoom out" }).click();
    expect(zoomOut).toHaveBeenCalledTimes(1);
  });

  it("calls fitView when Fit view button is clicked", () => {
    render(<ZoomControls />);
    screen.getByRole("button", { name: "Fit view" }).click();
    expect(fitView).toHaveBeenCalledTimes(1);
  });

  it("renders inside a Panel with the default position bottom-right", () => {
    const { getByTestId } = render(<ZoomControls />);
    expect(getByTestId("rf-panel")).toHaveAttribute("data-position", "bottom-right");
  });

  it("passes a custom position to the Panel", () => {
    const { getByTestId } = render(<ZoomControls position="top-left" />);
    expect(getByTestId("rf-panel")).toHaveAttribute("data-position", "top-left");
  });

  it('marks its controls group with data-slot="zoom-controls"', () => {
    render(<ZoomControls className="my-zoom" />);
    const inner = screen.getByTestId("rf-panel").firstChild as HTMLElement;
    expect(inner).toHaveAttribute("data-slot", "zoom-controls");
    // The slot sits on the element a caller's className lands on.
    expect(inner).toHaveClass("my-zoom");
  });

  it("uses the inset focus ring, since the rounded group clips anything drawn outside", () => {
    render(<ZoomControls />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveClass("focus-ring-inset");
      expect(button).not.toHaveClass("focus-ring");
    }
  });

  it("hides the decorative button glyphs from assistive tech", () => {
    const { container } = render(<ZoomControls />);
    const glyphs = container.querySelectorAll("button svg");
    expect(glyphs).toHaveLength(3);
    for (const glyph of glyphs) expect(glyph).toHaveAttribute("aria-hidden", "true");
  });

  it("names the buttons with the English defaults when no LocaleProvider is mounted", () => {
    render(<ZoomControls />);
    const names = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual(["Zoom in", "Zoom out", "Fit view"]);
  });

  it("lets a LocaleProvider's messages rename every button", () => {
    render(
      <LocaleProvider
        locale="de-DE"
        messages={{
          "flow.zoomControls.zoomIn": "Vergrößern",
          "flow.zoomControls.zoomOut": "Verkleinern",
          "flow.zoomControls.fitView": "Ansicht anpassen",
        }}
      >
        <ZoomControls />
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Vergrößern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verkleinern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ansicht anpassen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
  });

  it("keeps the English default for a key the provider does not override", () => {
    render(
      <LocaleProvider locale="de-DE" messages={{ "flow.zoomControls.zoomIn": "Vergrößern" }}>
        <ZoomControls />
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Vergrößern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit view" })).toBeInTheDocument();
  });

  it("clicks the localized button through to the same zoom action", () => {
    render(
      <LocaleProvider messages={{ "flow.zoomControls.fitView": "Ansicht anpassen" }}>
        <ZoomControls />
      </LocaleProvider>,
    );
    screen.getByRole("button", { name: "Ansicht anpassen" }).click();
    expect(fitView).toHaveBeenCalledTimes(1);
  });

  it("applies custom className to the controls wrapper", () => {
    render(<ZoomControls className="my-zoom" />);
    const panel = screen.getByTestId("rf-panel");
    // The className is on the inner div, child of the Panel
    const inner = panel.firstChild as HTMLElement;
    expect(inner).toHaveClass("my-zoom");
  });
});
