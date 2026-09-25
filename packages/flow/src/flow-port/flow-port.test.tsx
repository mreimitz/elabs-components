import { render } from "@testing-library/react";
import { Position, ReactFlowProvider } from "@xyflow/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { FLOW_HANDLE_ANCHOR_CLASS } from "../flow-handle";
import { FlowPort, flowPortId } from "./flow-port";

// A Handle reads its node id from context; outside a node it still renders, as long as
// a React Flow store is present.
const Store = ({ children }: { children: ReactNode }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
);

describe("flowPortId", () => {
  it("prefixes a target port with in: and a source port with out:", () => {
    expect(flowPortId("target", "score")).toBe("in:score");
    expect(flowPortId("source", "score")).toBe("out:score");
  });
});

describe("FlowPort", () => {
  it("names the handle by the port convention", () => {
    const { container } = render(<FlowPort type="target" position={Position.Left} port="score" />, {
      wrapper: Store,
    });
    const handle = container.querySelector('[data-slot="flow-port"]');
    expect(handle).toHaveAttribute("data-handleid", "in:score");
  });

  it("uses an explicit id verbatim", () => {
    const { container } = render(<FlowPort type="source" position={Position.Right} id="right" />, {
      wrapper: Store,
    });
    expect(container.querySelector('[data-slot="flow-port"]')).toHaveAttribute(
      "data-handleid",
      "right",
    );
  });

  it("draws the standard dot and keeps the anchor class last", () => {
    const { container } = render(
      <FlowPort
        type="source"
        position={Position.Bottom}
        className="!border-flow-group-border transition-all"
      />,
      { wrapper: Store },
    );
    const handle = container.querySelector('[data-slot="flow-port"]')!;
    expect(handle).toHaveClass("!size-2", "!border-flow-group-border", FLOW_HANDLE_ANCHOR_CLASS);
    expect(handle).not.toHaveClass("!border-flow-edge");
    // A caller's transition can never outlive the measurement-anchor rule.
    expect(handle).not.toHaveClass("transition-all");
  });
});
