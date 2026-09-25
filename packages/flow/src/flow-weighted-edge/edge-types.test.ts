import { describe, expect, expectTypeOf, it } from "vitest";
import type { Edge, EdgeProps } from "@xyflow/react";
import type { BrandFlowButtonEdge, FlowButtonEdgeData } from "../flow-button-edge";
import type { BrandFlowEdge } from "../flow-edge";
import type {
  BrandFlowFloatingEdge,
  FlowFloatingEdge,
  FlowFloatingEdgeData,
} from "../flow-floating-edge";
import type { BrandFlowSelfLoopEdge, FlowSelfLoopEdgeData } from "../flow-self-loop-edge";
import type { BrandFlowSmartEdge } from "../flow-smart-edge";
import { FLOW_EDGE_TYPE } from "../flow-types";
import type {
  BrandFlowWeightedEdge,
  FlowWeightedEdgeBaseData,
  FlowWeightedEdgeData,
} from "./index";

/**
 * Type-level locks for the edge data shapes. `expectTypeOf` is checked by `tsc`
 * (`pnpm typecheck`), so a drift here fails the typecheck, not only this run.
 */
describe("edge data types", () => {
  it("shares one weighted base between FlowWeightedEdgeData and FlowSelfLoopEdgeData", () => {
    expectTypeOf<FlowWeightedEdgeData>().toExtend<FlowWeightedEdgeBaseData>();
    expectTypeOf<FlowSelfLoopEdgeData>().toExtend<FlowWeightedEdgeBaseData>();

    // The shared fields are the SAME fields, not two look-alikes.
    type Shared = keyof FlowWeightedEdgeBaseData;
    expectTypeOf<Pick<FlowWeightedEdgeData, Shared>>().toEqualTypeOf<
      Pick<FlowWeightedEdgeBaseData, Shared>
    >();
    expectTypeOf<Pick<FlowSelfLoopEdgeData, Shared>>().toEqualTypeOf<
      Pick<FlowWeightedEdgeBaseData, Shared>
    >();

    // Loop-only and weighted-only fields stay on their own side.
    expectTypeOf<FlowSelfLoopEdgeData["loopRadius"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<FlowWeightedEdgeData["variant"]>().toEqualTypeOf<"forward" | "back" | undefined>();
  });

  it("keys every Brand*Edge alias on FLOW_EDGE_TYPE", () => {
    expectTypeOf<BrandFlowEdge>().toEqualTypeOf<
      Edge<Record<string, unknown>, typeof FLOW_EDGE_TYPE.brand>
    >();
    expectTypeOf<BrandFlowButtonEdge>().toEqualTypeOf<
      Edge<FlowButtonEdgeData, typeof FLOW_EDGE_TYPE.button>
    >();
    expectTypeOf<BrandFlowSmartEdge>().toEqualTypeOf<
      Edge<Record<string, unknown>, typeof FLOW_EDGE_TYPE.smart>
    >();
    expectTypeOf<BrandFlowFloatingEdge>().toEqualTypeOf<
      Edge<FlowFloatingEdgeData, typeof FLOW_EDGE_TYPE.floating>
    >();
    expectTypeOf<BrandFlowWeightedEdge>().toEqualTypeOf<
      Edge<FlowWeightedEdgeData, typeof FLOW_EDGE_TYPE.weighted>
    >();
    expectTypeOf<BrandFlowSelfLoopEdge>().toEqualTypeOf<
      Edge<FlowSelfLoopEdgeData, typeof FLOW_EDGE_TYPE.selfLoop>
    >();

    // And a literal edge object built from the constant type-checks as the alias.
    const loop: BrandFlowSelfLoopEdge = {
      id: "loop",
      source: "a",
      target: "a",
      type: FLOW_EDGE_TYPE.selfLoop,
      data: { weight: 3, loopRadius: 40 },
    };
    expect(loop.type).toBe("self-loop");
  });

  it("keeps every built-in edge component accepting plain EdgeProps", () => {
    // A consumer's wrapping edge (`(props: EdgeProps) => <FlowFloatingEdge {...props} />`)
    // compiled before `data` was typed; typing `data` must not pin `type` on the component.
    expectTypeOf<EdgeProps>().toExtend<Parameters<typeof FlowFloatingEdge>[0]>();
  });
});
