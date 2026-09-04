import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor } from "storybook/test";
import { ChartFrame } from "../../chart-frame/chart-frame";
import { SankeyChart } from "./sankey-chart";
import { SankeyLink } from "./sankey-link";
import { SankeyNode } from "./sankey-node";
import { SankeyThreadLinks } from "./sankey-threads";
import { SankeyTooltip } from "./sankey-tooltip";

const meta = {
  title: "Charts/SankeyChart",
  component: SankeyChart,
  tags: ["autodocs"],
} satisfies Meta<typeof SankeyChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Traffic-funnel flow: acquisition sources → landing → product → checkout.
 *  Node colors cycle through --chart-1..12 tokens; links use --chart-foreground-muted. */
const funnelData = {
  nodes: [
    { name: "Paid Ads", category: "source" as const },
    { name: "Organic", category: "source" as const },
    { name: "Referral", category: "source" as const },
    { name: "Landing", category: "landing" as const },
    { name: "Product", category: "outcome" as const },
    { name: "Checkout", category: "outcome" as const },
  ],
  links: [
    { source: 0, target: 3, value: 42 },
    { source: 1, target: 3, value: 31 },
    { source: 2, target: 3, value: 14 },
    { source: 3, target: 4, value: 60 },
    { source: 4, target: 5, value: 38 },
  ],
};

export const Default: Story = {
  args: {
    data: funnelData,
    aspectRatio: "16 / 9",
  },
  render: (args) => (
    <div className="h-72 w-[560px]">
      <SankeyChart {...args}>
        <SankeyLink />
        <SankeyNode />
        <SankeyTooltip />
      </SankeyChart>
    </div>
  ),
  /**
   * The real-browser HALF of the #185 dash-reveal check. `AnimatedLink` measures
   * the link path with `getTotalLength()` in a layout effect and feeds the result
   * into `stroke-dasharray`; while `pathLength` is 0 the attribute stays `"none"`
   * and the reveal cannot animate. Only a real browser implements
   * `getTotalLength()`, so only here can we assert the measurement is REAL.
   *
   * This is a complement, not the regression lock: the `storybook` CI job is
   * `continue-on-error: true`, so a failure here does not block. The blocking lock
   * — that the measurement is scoped to `[path]` and does not re-run on every
   * hover/fade render — lives in `sankey-link.test.tsx`, which `pnpm test` runs.
   */
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const dashes = Array.from(canvasElement.querySelectorAll("g.sankey-links path")).map((p) =>
        p.getAttribute("stroke-dasharray"),
      );
      expect(dashes.length).toBeGreaterThan(0);
      // Every link reports a measured length pair ("<len> <len>"), never "none".
      for (const dash of dashes) {
        expect(dash).toMatch(/^\d+(\.\d+)? \d+(\.\d+)?$/);
      }
    });
  },
};

/** Minimal two-node, one-link graph — useful for testing edge cases. */
const minimalData = {
  nodes: [{ name: "Source" }, { name: "Target" }],
  links: [{ source: 0, target: 1, value: 100 }],
};

export const Minimal: Story = {
  args: {
    data: minimalData,
    aspectRatio: "2 / 1",
  },
  render: (args) => (
    <div className="h-64 w-[480px]">
      <SankeyChart {...args}>
        <SankeyLink />
        <SankeyNode />
        <SankeyTooltip />
      </SankeyChart>
    </div>
  ),
};

/** Wider multi-stage pipeline — exercises the layout engine across more columns. */
const pipelineData = {
  nodes: [
    { name: "Discovery" },
    { name: "Qualified" },
    { name: "Demo" },
    { name: "Proposal" },
    { name: "Closed Won" },
    { name: "Closed Lost" },
  ],
  links: [
    { source: 0, target: 1, value: 80 },
    { source: 1, target: 2, value: 55 },
    { source: 2, target: 3, value: 40 },
    { source: 3, target: 4, value: 22 },
    { source: 3, target: 5, value: 18 },
  ],
};

export const Pipeline: Story = {
  args: {
    data: pipelineData,
    aspectRatio: "21 / 9",
    animationDuration: 800,
  },
  render: (args) => (
    <div className="h-64 w-[700px]">
      <SankeyChart {...args}>
        <SankeyLink />
        <SankeyNode />
        <SankeyTooltip />
      </SankeyChart>
    </div>
  ),
};

// ── mode="threads" (RM-037) ──────────────────────────────────────────────
// lieflat B3 `big-threads.html` volume: 26 sources → 40 processors → 10
// destinations, 126 individual routes (deterministic, not random — a story
// snapshot must not flake). Each route is one record with an ordered `path`
// of node names; `SankeyChart` derives the aggregate node layout from every
// route's hop pairs, then `SankeyThreadLinks` draws one polyline per record
// through that shared layout.
const THREAD_SOURCES = Array.from({ length: 26 }, (_, i) => `Source ${i + 1}`);
const THREAD_PROCESSORS = Array.from({ length: 40 }, (_, i) => `Processor ${i + 1}`);
const THREAD_DESTINATIONS = Array.from({ length: 10 }, (_, i) => `Dest ${i + 1}`);

const THREAD_ROUTE_COUNT = 126;

const threadsData = {
  nodes: [
    ...THREAD_SOURCES.map((name) => ({ name, category: "source" as const })),
    ...THREAD_PROCESSORS.map((name) => ({ name, category: "landing" as const })),
    ...THREAD_DESTINATIONS.map((name) => ({ name, category: "outcome" as const })),
  ],
  links: Array.from({ length: THREAD_ROUTE_COUNT }, (_, i) => {
    const source = THREAD_SOURCES[i % THREAD_SOURCES.length] as string;
    const processor = THREAD_PROCESSORS[(i * 7 + 3) % THREAD_PROCESSORS.length] as string;
    const destination = THREAD_DESTINATIONS[(i * 13 + 5) % THREAD_DESTINATIONS.length] as string;
    return {
      source: 0, // unused in threads mode — `path` drives routing
      target: 0,
      value: 5 + ((i * 11) % 40),
      path: [source, processor, destination],
    };
  }),
};

export const Threads: Story = {
  args: {
    data: threadsData,
    mode: "threads",
    aspectRatio: "21 / 9",
  },
  render: (args) => {
    const totalValue = threadsData.links.reduce((sum, link) => sum + link.value, 0);
    return (
      <ChartFrame
        description={`${THREAD_ROUTE_COUNT} individual routes, source through processor to destination — one polyline per record instead of one aggregate edge per node pair.`}
        detail={
          <div className="space-y-1 text-body">
            <div>{THREAD_ROUTE_COUNT} routes</div>
            <div>{totalValue.toLocaleString()} total value</div>
          </div>
        }
        height={420}
        title="Route threads"
      >
        <SankeyChart {...args}>
          <SankeyNode />
          <SankeyThreadLinks />
          <SankeyTooltip />
        </SankeyChart>
      </ChartFrame>
    );
  },
  /**
   * Regression lock for the interaction contract (RM-037 acceptance): hover
   * bundles a thread to full opacity, click pins it (persists across
   * mouse-out), Escape releases the pin, and a click on empty chart space
   * also releases it.
   */
  play: async ({ canvasElement }) => {
    let threadGroups: SVGGElement[] = [];
    await waitFor(() => {
      threadGroups = Array.from(
        canvasElement.querySelectorAll("g.sankey-threads > g[data-thread-id]"),
      ) as SVGGElement[];
      expect(threadGroups.length).toBe(THREAD_ROUTE_COUNT);
    });

    const firstGroup = threadGroups[0] as SVGGElement;
    const hitTwin = firstGroup.querySelector("path[aria-hidden]") as SVGPathElement;
    const visiblePath = firstGroup.querySelector("path:not([aria-hidden])") as SVGPathElement;

    // Hover → bundle highlight: the hovered thread's visible path reaches
    // full opacity while it is hovered. `userEvent.hover` dispatches directly
    // at the given node (pointerover/mouseover, with the right relatedTarget)
    // rather than resolving a screen coordinate — needed here because the
    // hit-twin's interactive area is its 9px STROKE, not its bounding box, so
    // a geometry-based hover could miss it entirely.
    await userEvent.hover(hitTwin);
    await waitFor(() => {
      expect(visiblePath.getAttribute("opacity")).toBe("1");
    });
    await userEvent.unhover(hitTwin);
    await waitFor(() => {
      expect(visiblePath.getAttribute("opacity")).not.toBe("1");
    });

    // Click → pin: persists even after the pointer leaves the thread.
    await fireEvent.click(hitTwin);
    await waitFor(() => {
      expect(firstGroup.getAttribute("data-pinned")).toBe("true");
    });
    await userEvent.hover(hitTwin);
    await userEvent.unhover(hitTwin);
    expect(firstGroup.getAttribute("data-pinned")).toBe("true");

    // Escape → releases the pin from anywhere in the chart. Dispatched on the
    // thread itself so it bubbles up to the container's onKeyDown handler
    // (the same path a focused ChartDatapointLayer target's keydown takes).
    await fireEvent.keyDown(hitTwin, { key: "Escape" });
    await waitFor(() => {
      expect(firstGroup.getAttribute("data-pinned")).toBeNull();
    });

    // Click again to pin, then click empty chart space to release.
    await fireEvent.click(hitTwin);
    await waitFor(() => {
      expect(firstGroup.getAttribute("data-pinned")).toBe("true");
    });
    // `canvasElement.querySelector("svg")` would risk matching a toolbar
    // icon's own <svg> (ChartFrame renders several) — walk up from the
    // chart's own content instead.
    const svg = firstGroup.closest("svg") as SVGSVGElement;
    await fireEvent.click(svg);
    await waitFor(() => {
      expect(firstGroup.getAttribute("data-pinned")).toBeNull();
    });
  },
};
