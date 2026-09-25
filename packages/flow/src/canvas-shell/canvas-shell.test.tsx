import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @xyflow/react requires real layout/measurement — mock the engine and assert
// the brand wrapper's own output. Real rendering + a11y are covered by Storybook
// interaction tests.
const reactFlowSpy = vi.fn();

vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    ReactFlow: (props: { children?: React.ReactNode; className?: string }) => {
      reactFlowSpy(props);
      const { children, className } = props;
      return React.createElement("div", { "data-testid": "react-flow", className }, children);
    },
    Background: () => React.createElement("div", { "data-testid": "rf-background" }),
    // Like the real provider, it renders no DOM of its own — so the shell's own div is
    // still the root in `helperLines` mode.
    ReactFlowProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, {}, children),
    // `helperLines` mode reads the live node store and the viewport.
    useReactFlow: () => ({ getNodes: () => [] }),
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    // Read at module load by the shared geometry helpers (`flow-geometry`).
    Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  };
});

import { CanvasShell } from "./canvas-shell";

afterEach(() => {
  cleanup();
  reactFlowSpy.mockClear();
});

describe("CanvasShell", () => {
  it("renders without throwing", () => {
    const { container } = render(<CanvasShell nodes={[]} edges={[]} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders the inner ReactFlow mock", () => {
    const { getByTestId } = render(<CanvasShell nodes={[]} edges={[]} />);
    expect(getByTestId("react-flow")).toBeInTheDocument();
  });

  it("renders the Background when background prop is true (default)", () => {
    const { getByTestId } = render(<CanvasShell nodes={[]} edges={[]} />);
    expect(getByTestId("rf-background")).toBeInTheDocument();
  });

  it("omits the Background when background={false}", () => {
    const { queryByTestId } = render(<CanvasShell nodes={[]} edges={[]} background={false} />);
    expect(queryByTestId("rf-background")).not.toBeInTheDocument();
  });

  it('marks its root with data-slot="canvas-shell"', () => {
    const { container } = render(<CanvasShell nodes={[]} edges={[]} className="my-canvas" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("data-slot", "canvas-shell");
    // The slot sits on the same element a caller's className lands on.
    expect(root).toHaveClass("my-canvas");
  });

  it('keeps data-slot="canvas-shell" on the root in helperLines mode', () => {
    const { container } = render(<CanvasShell nodes={[]} edges={[]} helperLines />);
    expect(container.firstChild).toHaveAttribute("data-slot", "canvas-shell");
    expect(container.querySelectorAll('[data-slot="canvas-shell"]')).toHaveLength(1);
  });

  it("applies custom className to the wrapper div", () => {
    const { container } = render(<CanvasShell nodes={[]} edges={[]} className="my-canvas" />);
    expect(container.firstChild).toHaveClass("my-canvas");
  });

  it("renders children inside the flow", () => {
    const { getByTestId } = render(
      <CanvasShell nodes={[]} edges={[]}>
        <div data-testid="child-panel">child</div>
      </CanvasShell>,
    );
    expect(getByTestId("child-panel")).toBeInTheDocument();
  });

  it("passes branded default ariaLabelConfig to ReactFlow", () => {
    render(<CanvasShell nodes={[]} edges={[]} />);
    const props = reactFlowSpy.mock.calls[0]?.[0];
    expect(props.ariaLabelConfig).toMatchObject({
      "controls.ariaLabel": "Canvas controls",
      "controls.zoomIn.ariaLabel": "Zoom in",
      "minimap.ariaLabel": "Minimap",
    });
  });

  // The badge is hidden by product decision, not by licence: @xyflow/react is MIT
  // (notice in source copies, no rendered badge required). This test exists so a
  // future agent cannot quietly flip it back — see .claude/rules/react-flow-components.md.
  it("hides the React Flow attribution badge", () => {
    render(<CanvasShell nodes={[]} edges={[]} />);
    const props = reactFlowSpy.mock.calls[0]?.[0];
    expect(props.proOptions).toMatchObject({ hideAttribution: true });
  });

  it("lets a caller restore the attribution badge via proOptions", () => {
    render(<CanvasShell nodes={[]} edges={[]} proOptions={{ hideAttribution: false }} />);
    const props = reactFlowSpy.mock.calls[0]?.[0];
    expect(props.proOptions).toMatchObject({ hideAttribution: false });
  });

  it("lets a caller-supplied ariaLabelConfig override the branded defaults", () => {
    render(
      <CanvasShell
        nodes={[]}
        edges={[]}
        ariaLabelConfig={{ "controls.ariaLabel": "Custom controls" }}
      />,
    );
    const props = reactFlowSpy.mock.calls[0]?.[0];
    expect(props.ariaLabelConfig).toMatchObject({
      "controls.ariaLabel": "Custom controls",
      // Unset keys still fall back to the branded default, not the library's.
      "controls.zoomIn.ariaLabel": "Zoom in",
    });
  });
});
