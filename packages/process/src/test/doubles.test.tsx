import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { discoverGraph } from "../core/discover-graph";
import { extractVariants } from "../core/extract-variants";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import {
  PerformanceSpectrumDouble,
  ProcessKpiStripDouble,
  ProcessMapDouble,
  VariantExplorerDouble,
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

  // PerformanceSpectrum — RM-060
  it("PerformanceSpectrumDouble records the event count and accepts the default order", () => {
    const { container } = render(<PerformanceSpectrumDouble log={log} />);
    const el = container.querySelector('[data-process-double="PerformanceSpectrumDouble"]');
    expect(readProcessDoubleProps(el as Element)?.dataLength).toBe(log.events.length);
  });

  it("PerformanceSpectrumDouble accepts a variant path and rejects an order absent from the log", () => {
    expect(() =>
      render(<PerformanceSpectrumDouble log={log} order={{ variantId: variants[0]!.id }} />),
    ).not.toThrow();
    expect(() =>
      render(<PerformanceSpectrumDouble log={log} order={[{ from: "Nope", to: "Never" }]} />),
    ).toThrow(/resolves to no segment/);
  });

  it("throws a contract error when required data is missing (a broken test fails loudly)", () => {
    // @ts-expect-error -- deliberately omitting the required `graph` prop
    expect(() => render(<ProcessMapDouble />)).toThrow(/ProcessMapDouble/);
  });
});
