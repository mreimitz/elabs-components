import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { SankeyChart } from "./sankey-chart";
import { SankeyLink } from "./sankey-link";
import { SankeyNode } from "./sankey-node";
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
