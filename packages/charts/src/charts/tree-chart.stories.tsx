import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button, ToggleGroup, ToggleGroupItem } from "@elabs-ai/components-ui";
import type { ChartDatapoint } from "./chart-datapoint";
import { TreeChart } from "./tree-chart";
import type {
  TreeChartNodeRenderProps,
  TreeDatapointDatum,
  TreeNode,
  TreeOrientation,
} from "./tree-chart";

const meta = {
  title: "Charts/TreeChart",
  component: TreeChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A left-to-right (or top-to-bottom) hierarchy diagram — who belongs to whom — where " +
          "every node draws at the same visual weight; there is no `value` field, because a " +
          "tree answers what contains what, never how big each part is. Branches open and " +
          "close out of the box: click a node, or Tab in and use the arrow keys. A closed " +
          "branch shows how many children it holds, like “Platform (3)”, beside a ringed dot, " +
          "and every change animates into the new layout (it snaps when reduced motion is on). " +
          "Set `orientation` to `lr` or `tb`, draw your own cards with `renderNode`, and pass " +
          "`collapsible={false}` for the static chart. The moment the question becomes how big " +
          "each part is, reach for `TreemapChart`, which sizes every leaf’s area by its value " +
          "over the same kind of hierarchy; see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
} satisfies Meta<typeof TreeChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Data ─────────────────────────────────────────────────────────────────────
// Every tree is declared here, above the first story, so no `name:` key sits
// between two story exports.

// Every @elabs-ai/components-* package, a handful of its components as leaves:
// 1 root + 12 package branches + 27 leaves = 40 nodes.
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

// Three levels, with explicit ids: what a controlled `expandedIds` keys on.
const companyOrg: TreeNode = {
  id: "company",
  name: "Company",
  children: [
    {
      id: "product",
      name: "Product",
      children: [
        { id: "web", name: "Web" },
        { id: "mobile", name: "Mobile" },
        { id: "design", name: "Design" },
      ],
    },
    {
      id: "sales",
      name: "Sales",
      children: [
        { id: "emea", name: "EMEA" },
        { id: "amer", name: "AMER" },
      ],
    },
    {
      id: "support",
      name: "Support",
      children: [
        { id: "tier-1", name: "Tier 1" },
        { id: "tier-2", name: "Tier 2" },
      ],
    },
  ],
};

interface TeamData {
  headcount: number;
}

const teamTree: TreeNode<TeamData> = {
  name: "Engineering",
  data: { headcount: 48 },
  children: [
    {
      name: "Platform",
      data: { headcount: 21 },
      children: [
        { name: "CI", data: { headcount: 6 } },
        { name: "Infra", data: { headcount: 15 } },
      ],
    },
    {
      name: "Product",
      data: { headcount: 27 },
      children: [
        { name: "Web", data: { headcount: 16 } },
        { name: "Mobile", data: { headcount: 11 } },
      ],
    },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Every branch id in depth-first order: what "Expand all" hands back. */
function branchIds(node: TreeNode): string[] {
  if (!node.children?.length) return [];
  return [node.id ?? node.name, ...node.children.flatMap(branchIds)];
}

function namesById(node: TreeNode, into = new Map<string, string>()): Map<string, string> {
  into.set(node.id ?? node.name, node.name);
  for (const child of node.children ?? []) namesById(child, into);
  return into;
}

const COMPANY_BRANCHES = branchIds(companyOrg);
const COMPANY_NAMES = namesById(companyOrg);

/** The lr / tb switch the orientation stories share. */
function OrientationToggle({
  value,
  onChange,
}: {
  value: TreeOrientation;
  onChange: (next: TreeOrientation) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Tree direction"
      className="self-start"
      onValueChange={(next) => {
        if (next) onChange(next as TreeOrientation);
      }}
      size="sm"
      type="single"
      value={value}
      variant="segmented"
    >
      <ToggleGroupItem value="lr">Left to right</ToggleGroupItem>
      <ToggleGroupItem value="tb">Top to bottom</ToggleGroupItem>
    </ToggleGroup>
  );
}

// With `onDatapointClick`, Enter (or a click on a node's label) reports the
// node; Space, the arrow keys and the dot still open and close branches.
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

function OrientationDemo() {
  const [orientation, setOrientation] = useState<TreeOrientation>("lr");
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <OrientationToggle onChange={setOrientation} value={orientation} />
      <div className="h-[380px]">
        <TreeChart
          accessibleLabel="Company structure"
          data={companyOrg}
          orientation={orientation}
        />
      </div>
    </div>
  );
}

/** A small team card: the facts it shows are restated in `teamCardLabel`. */
function TeamCard({ name, node, color, isLeaf, childCount }: TreeChartNodeRenderProps<TeamData>) {
  const headcount = node.data?.headcount ?? 0;
  return (
    <div className="flex size-full min-w-0 flex-col justify-center gap-0.5 rounded-xl border border-border bg-card px-3 shadow-xs">
      <span className="flex min-w-0 items-center gap-2 text-body font-medium text-card-foreground">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{name}</span>
      </span>
      <span className="truncate text-meta tabular-nums text-muted-foreground">
        {headcount} people{isLeaf ? "" : ` · ${childCount} teams`}
      </span>
    </div>
  );
}

function teamCardLabel(point: Omit<ChartDatapoint, "source">): string {
  const datum = point.datum as unknown as TreeDatapointDatum<TeamData>;
  const parts = [datum.name, `${datum.data?.headcount ?? 0} people`];
  if (datum.path.length > 1) parts.push(`in ${datum.path.slice(0, -1).join(" › ")}`);
  if (!datum.isLeaf && datum.childCount != null) parts.push(`${datum.childCount} teams`);
  return parts.join(", ");
}

function CustomNodesDemo() {
  const [orientation, setOrientation] = useState<TreeOrientation>("lr");
  return (
    <div className="flex w-full max-w-[800px] flex-col gap-3">
      <OrientationToggle onChange={setOrientation} value={orientation} />
      <div className="h-[420px]">
        <TreeChart
          accessibleLabel="Engineering teams"
          data={teamTree}
          datapointLabel={teamCardLabel}
          nodeHeight={56}
          nodeWidth={152}
          orientation={orientation}
          renderNode={(props) => <TeamCard {...props} />}
        />
      </div>
    </div>
  );
}

function ControlledDemo() {
  const [expanded, setExpanded] = useState<string[]>(["company"]);
  const open = expanded.map((id) => COMPANY_NAMES.get(id) ?? id);
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <div className="flex gap-2">
        <Button onClick={() => setExpanded(COMPANY_BRANCHES)} size="sm" variant="outline">
          Expand all
        </Button>
        <Button onClick={() => setExpanded([])} size="sm" variant="outline">
          Collapse all
        </Button>
      </div>
      <div className="h-[360px]">
        <TreeChart
          accessibleLabel="Company structure"
          data={companyOrg}
          expandedIds={expanded}
          onExpandedChange={setExpanded}
        />
      </div>
      <output
        className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground"
        data-testid="open-branches"
      >
        {open.length > 0 ? `Open: ${open.join(", ")}` : "Every branch is closed."}
      </output>
    </div>
  );
}

// ── Stories ──────────────────────────────────────────────────────────────────

/** Forty nodes in a 400×320 card: the tree keeps its spacing and scrolls
 * inside the card instead of shrinking to fit. */
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

/** `orientation="tb"` — root on top, growing down; the same before/after
 * label convention rotates onto the vertical growth axis. */
export const TopToBottom: Story = {
  args: {
    data: smallOrgChart,
    orientation: "tb",
    accessibleLabel: "Engineering org chart, top to bottom",
  },
  render: (args) => (
    <div className="h-[400px] w-[560px]">
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

/** Start with the branches closed: `defaultExpandedDepth={1}` opens only the
 * root, so each package shows how many components it holds, like
 * “tokens (3)”, beside a ringed dot. Click a dot to open it, or Tab in and use
 * the arrow keys: Right opens a branch, Left closes it. */
export const Collapsed: Story = {
  args: {
    data: everythingThePlatformShips,
    defaultExpandedDepth: 1,
    accessibleLabel: "Everything the platform ships, packages closed",
  },
  render: (args) => (
    <div className="h-[420px] w-[300px]">
      <TreeChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree", {
      name: "Everything the platform ships, packages closed",
    });
    // The root and its 12 closed packages.
    await expect(within(tree).getAllByRole("treeitem")).toHaveLength(13);

    const [root] = within(tree).getAllByRole("treeitem");
    (root as HTMLElement).focus();
    await userEvent.keyboard("{ArrowDown}");

    const tokens = within(tree).getByRole("treeitem", { name: /^tokens,/ });
    await waitFor(() => expect(tokens).toHaveFocus());
    await expect(tokens).toHaveAttribute("aria-expanded", "false");

    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(tokens).toHaveAttribute("aria-expanded", "true"));
    const themeProvider = within(tree).getByRole("treeitem", { name: /^ThemeProvider,/ });
    await expect(themeProvider).toBeInTheDocument();
    await expect(within(tree).getAllByRole("treeitem")).toHaveLength(16);
    // Opening a branch scrolls its new children into the 300px box.
    const scroller = tree.closest<HTMLElement>('[data-slot="tree-chart"]');
    await waitFor(
      () => {
        const view = (scroller as HTMLElement).getBoundingClientRect();
        const child = themeProvider.getBoundingClientRect();
        expect(child.left).toBeGreaterThanOrEqual(view.left);
        expect(child.left + 24).toBeLessThanOrEqual(view.right);
        expect(child.top).toBeGreaterThanOrEqual(view.top);
        expect(child.bottom).toBeLessThanOrEqual(view.bottom);
      },
      { timeout: 2000 },
    );

    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(tokens).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(within(tree).getAllByRole("treeitem")).toHaveLength(13));
  },
};

/** Click a node — or Tab in and press Enter — to report it below. */
export const Interactive: Story = {
  args: { data: everythingThePlatformShips },
  render: () => <InteractiveDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree", { name: "Everything the platform ships" });
    const items = within(tree).getAllByRole("treeitem");

    // Exactly one tab stop for the whole tree (roving tabindex).
    await expect(items.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);

    (items[0] as HTMLElement).focus();
    await expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(canvas.getByTestId("node-detail")).toHaveTextContent(/via keyboard/);
    });
  },
};

/** Switch between left to right and top to bottom: the same tree glides into
 * its new layout, and any branch you closed stays closed. */
export const Orientation: Story = {
  args: { data: companyOrg },
  parameters: { layout: "padded" },
  render: () => <OrientationDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree", { name: "Company structure" });
    const sales = within(tree).getByRole("treeitem", { name: /^Sales,/ });
    await expect(sales).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(canvas.getByRole("radio", { name: "Top to bottom" }));
    await expect(canvas.getByRole("radio", { name: "Top to bottom" })).toBeChecked();
    await expect(within(tree).getAllByRole("treeitem")).toHaveLength(11);
  },
};

/** Draw each node as your own card with `renderNode`, sized by `nodeWidth`
 * and `nodeHeight`. The chart adds the open/close pill on the side the tree
 * grows towards, in either direction. Cards stay the same size, whatever they
 * show: a tree answers what contains what, never how big each part is. Each
 * card’s facts are restated for screen readers through `datapointLabel`. */
export const CustomNodes: Story = {
  args: { data: teamTree },
  parameters: { layout: "padded" },
  render: () => <CustomNodesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree", { name: "Engineering teams" });
    const platform = within(tree).getByRole("treeitem", {
      name: "Platform, 21 people, in Engineering, 2 teams",
    });
    await expect(platform).toHaveAttribute("aria-expanded", "true");

    // Space closes the branch; the pill opens it again.
    platform.focus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(platform).toHaveAttribute("aria-expanded", "false"));
    const pill = platform.querySelector<HTMLElement>('[data-slot="tree-chart-toggle"]');
    await expect(pill).not.toBeNull();
    await userEvent.click(pill as HTMLElement);
    await waitFor(() => expect(platform).toHaveAttribute("aria-expanded", "true"));

    // The same in the other direction.
    await userEvent.click(canvas.getByRole("radio", { name: "Top to bottom" }));
    const platformTb = within(tree).getByRole("treeitem", { name: /^Platform,/ });
    platformTb.focus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(platformTb).toHaveAttribute("aria-expanded", "false"));
    const pillTb = platformTb.querySelector<HTMLElement>('[data-slot="tree-chart-toggle"]');
    await userEvent.click(pillTb as HTMLElement);
    await waitFor(() => expect(platformTb).toHaveAttribute("aria-expanded", "true"));
  },
};

/** Own the open branches yourself: pass `expandedIds` and `onExpandedChange`,
 * and drive them from anywhere, such as these “Expand all” and
 * “Collapse all” buttons. */
export const Controlled: Story = {
  args: { data: companyOrg },
  parameters: { layout: "padded" },
  render: () => <ControlledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree", { name: "Company structure" });
    const output = canvas.getByTestId("open-branches");
    await expect(output).toHaveTextContent("Open: Company");
    await expect(within(tree).getAllByRole("treeitem")).toHaveLength(4);

    await userEvent.click(canvas.getByRole("button", { name: "Expand all" }));
    await waitFor(() => expect(within(tree).getAllByRole("treeitem")).toHaveLength(11));
    await expect(output).toHaveTextContent("Open: Company, Product, Sales, Support");

    await userEvent.click(canvas.getByRole("button", { name: "Collapse all" }));
    await waitFor(() => expect(within(tree).getAllByRole("treeitem")).toHaveLength(1));
    await expect(output).toHaveTextContent("Every branch is closed.");
  },
};

/** `collapsible={false}` draws the static chart: no open/close, no tree to
 * Tab through. `collapseDepth={1}` then folds everything past the package
 * level into one “+k” pill, where k counts the leaves it hides. */
export const Static: Story = {
  args: {
    data: everythingThePlatformShips,
    collapsible: false,
    collapseDepth: 1,
    accessibleLabel: "Everything the platform ships, static",
  },
  render: (args) => (
    <div className="h-[420px] w-[300px]">
      <TreeChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("tree")).toBeNull();
  },
};
