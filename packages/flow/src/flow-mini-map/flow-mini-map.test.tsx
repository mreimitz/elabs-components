import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @xyflow/react's MiniMap needs real flow context/measurement — mock it and
// assert the brand wrapper's own output (token-driven color defaults +
// className merge). Real rendering + a11y are covered by Storybook
// interaction tests.
const miniMapSpy = vi.fn();

vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    MiniMap: (props: { className?: string }) => {
      miniMapSpy(props);
      return React.createElement("div", {
        "data-testid": "rf-minimap",
        className: props.className,
      });
    },
  };
});

import { FlowMiniMap } from "./flow-mini-map";

afterEach(() => {
  cleanup();
  miniMapSpy.mockClear();
});

describe("FlowMiniMap", () => {
  it("renders without throwing", () => {
    const { getByTestId } = render(<FlowMiniMap />);
    expect(getByTestId("rf-minimap")).toBeInTheDocument();
  });

  it("defaults nodeColor/nodeStrokeColor/maskColor to the flow-minimap tokens", () => {
    render(<FlowMiniMap />);
    const props = miniMapSpy.mock.calls[0]?.[0];
    expect(props.nodeColor).toBe("var(--flow-minimap-node)");
    expect(props.nodeStrokeColor).toBe("var(--flow-minimap-node)");
    expect(props.maskColor).toBe("var(--flow-minimap-mask)");
  });

  it("lets a caller override nodeColor/maskColor", () => {
    render(<FlowMiniMap nodeColor="red" maskColor="blue" />);
    const props = miniMapSpy.mock.calls[0]?.[0];
    expect(props.nodeColor).toBe("red");
    expect(props.maskColor).toBe("blue");
  });

  it("merges a custom className with the branded panel classes", () => {
    const { getByTestId } = render(<FlowMiniMap className="my-minimap" />);
    expect(getByTestId("rf-minimap")).toHaveClass("my-minimap");
  });
});
