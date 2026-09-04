import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { ChartDatapoint } from "./chart-datapoint";
import { TreeChart } from "./tree-chart";
import type { TreeNode } from "./tree-chart";

const meta = {
  title: "Charts/TreeChart",
  component: TreeChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A left-to-right (or top-to-bottom) orthogonal hierarchy diagram — who belongs to " +
          "whom — where every node draws at the same visual weight; there is no `value` " +
          "field, because a tree answers what contains what, never how big each part is. The " +
          "moment the question becomes how big each part is, reach for `TreemapChart`, which " +
          "sizes every leaf’s area by its value over the same kind of hierarchy; see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
} satisfies Meta<typeof TreeChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// lieflat G7 "Everything the platform ships" recreation (RM-035) — every
// @elabs-ai/components-* package, a handful of its components as leaves. 1
// root + 12 package branches + 27 leaves = 40 nodes.
const everythingThePlatformShips: TreeNode = {
  name: "brand-ui",
  children: [
    {
      name: "tokens",
      children: [{ name: "ThemeProvider" }, { name: "useTheme" }, { name: "themes.css" }],
    },
    {
      name: "ui",
      children: [{ name: "Button" }, { name: "Card" }, { name: "Dialog" }, { name: "Tabs" }],
    },
    {
      name: "icons",
      children: [{ name: "Icon" }, { name: "BrandLogo" }],
    },
    {
      name: "data",
      children: [{ name: "DataTable" }, { name: "FilterBar" }],
    },
    {
      name: "ai",
      children: [{ name: "ChatShell" }, { name: "Message" }, { name: "PromptInput" }],
    },
    {
      name: "flow",
      children: [{ name: "FlowCanvas" }, { name: "FlowNode" }],
    },
    {
      name: "maps",
      children: [{ name: "MapCanvas" }, { name: "MapMarker" }],
    },
    {
      name: "charts",
      children: [{ name: "MetricCard" }, { name: "ChartFrame" }, { name: "AutoChart" }],
    },
    {
      name: "marketing",
      children: [{ name: "Hero" }, { name: "FeatureGrid" }],
    },
    {
      name: "editor",
      children: [{ name: "CodeEditor" }, { name: "DiffEditor" }],
    },
    {
      name: "viewer",
      children: [{ name: "FileViewer" }],
    },
    {
      name: "terminal",
      children: [{ name: "Terminal" }],
    },
  ],
};

/** The 40-node G7 recreation, scrolling inside a fixed 400×320 card — the
 * acceptance bar: never shrink the layout to fit, scroll instead. */
export const Default: Story = {
  args: {
    data: everythingThePlatformShips,
    accessibleLabel: "Everything the platform ships",
    accessibleDescription:
      "Every @elabs-ai/components package as a branch, a handful of its components as leaves.",
  },
  render: (args) => (
    <div className="h-[320px] w-[400px] overflow-auto rounded-md border border-border">
      <TreeChart {...args} />
    </div>
  ),
};

const smallOrgChart: TreeNode = {
  name: "Engineering",
  children: [
    {
      name: "Platform",
      children: [{ name: "CI" }, { name: "Infra" }, { name: "Release" }],
    },
    {
      name: "Product",
      children: [{ name: "Onboarding" }, { name: "Billing" }, { name: "Search" }],
    },
  ],
};

/** `orientation="tb"` — root on top, growing down; the same before/after
 * label convention rotates onto the vertical growth axis. */
export const TopToBottom: Story = {
  args: {
    data: smallOrgChart,
    orientation: "tb",
    accessibleLabel: "Engineering org chart, top to bottom",
  },
  render: (args) => (
    <div className="h-[360px] w-[560px]">
      <TreeChart {...args} />
    </div>
  ),
};

/** `palette="categorical"` — one hue per top-level branch; the root stays
 * neutral since it belongs to no branch. */
export const Categorical: Story = {
  args: {
    data: everythingThePlatformShips,
    palette: "categorical",
    accessibleLabel: "Everything the platform ships, one hue per package",
  },
  render: (args) => (
    <div className="h-[420px] w-[720px] overflow-auto">
      <TreeChart {...args} />
    </div>
  ),
};

/** `collapseDepth={1}` — every branch past depth 1 collapses into a single
 * "+k" pill, `k` = the number of leaves it hides. */
export const Collapsed: Story = {
  args: {
    data: everythingThePlatformShips,
    collapseDepth: 1,
    accessibleLabel: "Everything the platform ships, collapsed past the package level",
  },
  render: (args) => (
    <div className="h-[420px] w-[300px]">
      <TreeChart {...args} />
    </div>
  ),
};

// #349: leaves and branches are the keyboard datapoint targets —
// `onDatapointClick` is the only click handler this chart carries.
function InteractiveDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);
  return (
    <div className="flex w-[720px] flex-col gap-3">
      <div className="h-[420px]">
        <TreeChart
          accessibleLabel="Everything the platform ships"
          data={everythingThePlatformShips}
          onDatapointClick={(point) => setSelected(point)}
        />
      </div>
      <output
        className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground"
        data-testid="node-detail"
      >
        {selected
          ? `${String(selected.category)} (via ${selected.source})`
          : "Select a node to see its path."}
      </output>
    </div>
  );
}

/** Click a node — or Tab in and press Enter — to report it below. */
export const Interactive: Story = {
  render: () => <InteractiveDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByRole("group", { name: /chart data points/i });
    const targets = within(group).getAllByRole("button");

    // Exactly one tab stop for the whole chart (roving tabindex).
    await expect(targets.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);

    (targets[0] as HTMLElement).focus();
    await expect(targets[0]).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(canvas.getByTestId("node-detail")).toHaveTextContent(/via keyboard/);
    });
  },
};
