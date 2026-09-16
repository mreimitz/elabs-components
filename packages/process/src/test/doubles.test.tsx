import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { discoverGraph } from "../core/discover-graph";
import { extractVariants } from "../core/extract-variants";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import { liftHappyPath } from "../core/reference-model";
import { tokenReplay } from "../core/token-replay";
import {
  ConformanceOverlayDouble,
  HappyPathEditorDouble,
  ProcessKpiStripDouble,
  ProcessMapDouble,
  VariantExplorerDouble,
  ViolationListDouble,
} from "./doubles";
import { readProcessDoubleProps } from "./contract";

const log = generateSyntheticLog({ cases: 20, seed: 7 });
const graph = discoverGraph(log);
const variants = extractVariants(log);

describe("process test doubles", () => {
  it("ProcessMapDouble mounts and records the graph's activity count", () => {
    const { container } = render(<ProcessMapDouble graph={graph} />);
    const el = container.querySelector('[data-process-double="ProcessMapDouble"]');
    expect(el).not.toBeNull();
    expect(readProcessDoubleProps(el as Element)?.dataLength).toBe(graph.activities.length);
  });

  it("VariantExplorerDouble mounts and records the variant count", () => {
    const { container } = render(<VariantExplorerDouble variants={variants} />);
    const el = container.querySelector('[data-process-double="VariantExplorerDouble"]');
    expect(readProcessDoubleProps(el as Element)?.dataLength).toBe(variants.length);
  });

  it("ProcessKpiStripDouble mounts with the graph payload", () => {
    const { container } = render(<ProcessKpiStripDouble graph={graph} />);
    const el = container.querySelector('[data-process-double="ProcessKpiStripDouble"]');
    expect(el).not.toBeNull();
  });

  it("forwards a ref to the underlying div", () => {
    let node: HTMLDivElement | null = null;
    render(
      <ProcessMapDouble
        graph={graph}
        ref={(el) => {
          node = el;
        }}
      />,
    );
    expect(node).toBeInstanceOf(HTMLDivElement);
  });

  it("throws a contract error when required data is missing (a broken test fails loudly)", () => {
    // @ts-expect-error -- deliberately omitting the required `graph` prop
    expect(() => render(<ProcessMapDouble />)).toThrow(/ProcessMapDouble/);
  });
});

describe("RM-062 doubles", () => {
  const path = { id: "p", label: "Path", steps: [{ activity: "A" }, { activity: "B" }] };
  const conformance = tokenReplay(log, liftHappyPath(path));

  it("ConformanceOverlayDouble records the replayed case count and needs a graph", () => {
    const { container } = render(
      <ConformanceOverlayDouble graph={graph} conformance={conformance} />,
    );
    const el = container.querySelector('[data-process-double="ConformanceOverlayDouble"]');
    expect(readProcessDoubleProps(el as Element)?.dataLength).toBe(conformance.traces.length);
    // @ts-expect-error -- deliberately omitting the required `graph` prop
    expect(() => render(<ConformanceOverlayDouble conformance={conformance} />)).toThrow(
      /missing required prop "graph"/,
    );
  });

  it("ViolationListDouble rejects a non-ConformanceResult", () => {
    // @ts-expect-error -- deliberately passing the wrong shape
    expect(() => render(<ViolationListDouble conformance={graph} />)).toThrow(/ConformanceResult/);
  });

  it("HappyPathEditorDouble records the step count and requires onChange", () => {
    const { container } = render(<HappyPathEditorDouble value={path} onChange={() => {}} />);
    const el = container.querySelector('[data-process-double="HappyPathEditorDouble"]');
    expect(readProcessDoubleProps(el as Element)?.dataLength).toBe(2);
    // @ts-expect-error -- deliberately omitting the required `onChange` prop
    expect(() => render(<HappyPathEditorDouble value={path} />)).toThrow(/onChange/);
  });
});
