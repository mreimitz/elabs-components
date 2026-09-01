import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within, userEvent } from "storybook/test";
import { useState } from "react";
import { Folder, File, FileText, Database, Server } from "lucide-react";
import { Badge } from "../badge";
import { Tree, type TreeNode } from "./tree";

// ---------------------------------------------------------------------------
// Shared sample data
// ---------------------------------------------------------------------------

const fileTree: TreeNode[] = [
  {
    id: "src",
    label: "src",
    icon: <Folder className="size-4 text-muted-foreground" />,
    children: [
      {
        id: "components",
        label: "components",
        icon: <Folder className="size-4 text-muted-foreground" />,
        children: [
          {
            id: "button",
            label: "button.tsx",
            icon: <FileText className="size-4 text-muted-foreground" />,
          },
          {
            id: "tree-tsx",
            label: "tree.tsx",
            icon: <FileText className="size-4 text-muted-foreground" />,
          },
        ],
      },
      {
        id: "lib",
        label: "lib",
        icon: <Folder className="size-4 text-muted-foreground" />,
        children: [
          {
            id: "cn",
            label: "cn.ts",
            icon: <File className="size-4 text-muted-foreground" />,
          },
        ],
      },
      {
        id: "index",
        label: "index.ts",
        icon: <File className="size-4 text-muted-foreground" />,
      },
    ],
  },
  {
    id: "public",
    label: "public",
    icon: <Folder className="size-4 text-muted-foreground" />,
    children: [
      {
        id: "favicon",
        label: "favicon.ico",
        icon: <File className="size-4 text-muted-foreground" />,
      },
    ],
  },
  {
    id: "package-json",
    label: "package.json",
    icon: <File className="size-4 text-muted-foreground" />,
  },
];

const orgTree: TreeNode[] = [
  {
    id: "engineering",
    label: "Engineering",
    icon: <Server className="size-4 text-muted-foreground" />,
    children: [
      {
        id: "frontend",
        label: "Frontend",
        children: [
          { id: "alice", label: "Alice" },
          { id: "bob", label: "Bob" },
        ],
      },
      {
        id: "backend",
        label: "Backend",
        children: [
          { id: "charlie", label: "Charlie" },
          { id: "dana", label: "Dana", disabled: true },
        ],
      },
    ],
  },
  {
    id: "data",
    label: "Data",
    icon: <Database className="size-4 text-muted-foreground" />,
    children: [
      { id: "eve", label: "Eve" },
      { id: "frank", label: "Frank" },
    ],
  },
];

// The same file tree, with a trailing size badge on each file leaf (#369) —
// `TreeNode.accessory` renders it as a SIBLING of the label, so it never joins
// the row's accessible name and never triggers select/expand.
const fileTreeWithSizes: TreeNode[] = [
  {
    id: "src",
    label: "src",
    icon: <Folder className="size-4 text-muted-foreground" />,
    children: [
      {
        id: "components",
        label: "components",
        icon: <Folder className="size-4 text-muted-foreground" />,
        children: [
          {
            id: "button",
            label: "button.tsx",
            icon: <FileText className="size-4 text-muted-foreground" />,
            accessory: <Badge variant="outline">2.1 KB</Badge>,
          },
          {
            id: "tree-tsx",
            label: "tree.tsx",
            icon: <FileText className="size-4 text-muted-foreground" />,
            accessory: <Badge variant="outline">18.4 KB</Badge>,
          },
        ],
      },
      {
        id: "index",
        label: "index.ts",
        icon: <File className="size-4 text-muted-foreground" />,
        accessory: <Badge variant="outline">0.4 KB</Badge>,
      },
    ],
  },
  {
    id: "package-json",
    label: "package.json",
    icon: <File className="size-4 text-muted-foreground" />,
    accessory: <Badge variant="outline">1.2 KB</Badge>,
  },
];

// ---------------------------------------------------------------------------
// 5 000-node flat tree for the virtualization story
// ---------------------------------------------------------------------------

function buildLargeTree(count: number): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({ id: `node-${i}`, label: `Node ${i + 1}` });
  }
  return nodes;
}

const LARGE_NODES = buildLargeTree(5000);

// ---------------------------------------------------------------------------
// Lazy-loading demo data
// ---------------------------------------------------------------------------

function makeLazyRoot(): TreeNode[] {
  return [
    {
      id: "root-a",
      label: "Category A",
      hasChildren: true,
      icon: <Folder className="size-4 text-muted-foreground" />,
    },
    {
      id: "root-b",
      label: "Category B",
      hasChildren: true,
      icon: <Folder className="size-4 text-muted-foreground" />,
    },
    {
      id: "root-c",
      label: "Category C (fails to load)",
      hasChildren: true,
      icon: <Folder className="size-4 text-muted-foreground" />,
    },
    {
      id: "root-d",
      label: "Static leaf",
      icon: <File className="size-4 text-muted-foreground" />,
    },
  ];
}

async function fakeFetch(nodeId: string): Promise<TreeNode[]> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (nodeId === "root-c") throw new Error("Network error");
  return [
    {
      id: `${nodeId}-child-1`,
      label: `${nodeId} / child 1`,
      hasChildren: true,
      icon: <Folder className="size-4 text-muted-foreground" />,
    },
    {
      id: `${nodeId}-child-2`,
      label: `${nodeId} / child 2`,
      icon: <FileText className="size-4 text-muted-foreground" />,
    },
    {
      id: `${nodeId}-child-3`,
      label: `${nodeId} / child 3`,
      icon: <FileText className="size-4 text-muted-foreground" />,
    },
  ];
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Navigation/Tree",
  component: Tree,
  tags: ["autodocs"],
  args: {
    nodes: fileTree,
    defaultExpandedIds: ["src", "components"],
  },
  parameters: {
    layout: "padded",
  },
  argTypes: {
    nodes: {
      description: "Array of TreeNode objects describing the tree structure.",
      control: false,
      table: { category: "Data" },
    },
    selectionMode: {
      description: "Whether items can be selected — single, multiple, or none.",
      control: { type: "radio" },
      options: ["single", "multiple", "none"],
      table: { category: "Behaviour" },
    },
    checkboxes: {
      description: "Show checkboxes alongside nodes in multi-select mode.",
      control: "boolean",
      table: { category: "Behaviour" },
    },
    virtualize: {
      description: "Enable windowed rendering for large trees (>50 visible rows).",
      control: "boolean",
      table: { category: "Behaviour" },
    },
    estimateRowHeight: {
      description: "Estimated row height in px used by the virtualizer. Default 32.",
      control: "number",
      table: { category: "Behaviour" },
    },
    overscan: {
      description: "Extra rows rendered beyond the visible window by the virtualizer. Default 8.",
      control: "number",
      table: { category: "Behaviour" },
    },
    maxHeight: {
      description: "CSS max-height for the scroll viewport when virtualize is true.",
      control: "text",
      table: { category: "Behaviour" },
    },
    defaultExpandedIds: {
      description: "Uncontrolled initial set of expanded node ids.",
      control: false,
      table: { category: "State" },
    },
    expandedIds: {
      description: "Controlled set of expanded node ids.",
      control: false,
      table: { category: "State" },
    },
    onExpandedChange: {
      description: "Callback when the expanded set changes.",
      control: false,
      table: { category: "Events" },
    },
    defaultSelectedIds: {
      description: "Uncontrolled initial set of selected node ids.",
      control: false,
      table: { category: "State" },
    },
    selectedIds: {
      description: "Controlled set of selected node ids.",
      control: false,
      table: { category: "State" },
    },
    onSelectionChange: {
      description: "Callback when the selection set changes.",
      control: false,
      table: { category: "Events" },
    },
    loadChildren: {
      description: "Async function to load children for a node with hasChildren: true.",
      control: false,
      table: { category: "Behaviour" },
    },
    className: {
      description: "Additional CSS classes applied to the tree root.",
      control: "text",
      table: { category: "Styling" },
    },
  },
} satisfies Meta<typeof Tree>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Existing stories (unchanged)
// ---------------------------------------------------------------------------

/** Default single-selection file tree with icons. */
export const Default: Story = {
  // Confirms the pre-expanded nodes are visible and clicking a node selects it.
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    // "src" and "components" are pre-expanded via defaultExpandedIds
    const srcItem = canvas.getByRole("treeitem", { name: /^src$/i });
    await waitFor(() => expect(srcItem).toBeVisible());
    const componentsItem = canvas.getByRole("treeitem", { name: /^components$/i });
    await waitFor(() => expect(componentsItem).toBeVisible());
    // Click a leaf node to select it
    const buttonTsx = canvas.getByRole("treeitem", { name: /button\.tsx/i });
    await userEvent.click(buttonTsx);
    await expect(buttonTsx).toHaveAttribute("aria-selected", "true");
  },
};

/** Multiple selection with checkboxes. */
export const Multiple: Story = {
  args: {
    nodes: orgTree,
    defaultExpandedIds: ["engineering", "frontend", "backend", "data"],
    selectionMode: "multiple",
    checkboxes: true,
  },
};

/** Fully expanded at mount via defaultExpandedIds. */
export const Expanded: Story = {
  args: {
    defaultExpandedIds: ["src", "components", "lib", "public"],
  },
};

/** Collapsed — no nodes expanded at start. */
export const Collapsed: Story = {
  args: {
    defaultExpandedIds: [],
  },
};

/** Nodes with disabled items. */
export const DisabledNodes: Story = {
  args: {
    nodes: orgTree,
    defaultExpandedIds: ["engineering", "frontend", "backend", "data"],
    selectionMode: "single",
  },
};

/** Deep nesting — 4 levels. */
export const DeepNesting: Story = {
  args: {
    nodes: [
      {
        id: "l1",
        label: "Level 1",
        children: [
          {
            id: "l2",
            label: "Level 2",
            children: [
              {
                id: "l3",
                label: "Level 3",
                children: [
                  { id: "l4a", label: "Level 4 — A" },
                  { id: "l4b", label: "Level 4 — B" },
                ],
              },
            ],
          },
        ],
      },
    ],
    defaultExpandedIds: ["l1", "l2", "l3"],
  },
};

/** Controlled expand + select with external state display. */
export const Controlled: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [expanded, setExpanded] = useState<string[]>(["src"]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <div className="flex gap-8">
        <Tree
          nodes={fileTree}
          expandedIds={expanded}
          onExpandedChange={setExpanded}
          selectedIds={selected}
          onSelectionChange={setSelected}
          className="w-64"
        />
        <div className="text-body text-muted-foreground space-y-1">
          <p>
            <span className="font-medium">Expanded:</span> {expanded.join(", ") || "none"}
          </p>
          <p>
            <span className="font-medium">Selected:</span> {selected.join(", ") || "none"}
          </p>
        </div>
      </div>
    );
  },
};

/** No selection mode — purely navigational. */
export const NoSelection: Story = {
  args: {
    selectionMode: "none",
    defaultExpandedIds: ["src", "components"],
  },
};

// ---------------------------------------------------------------------------
// New story: 5 000-node virtualized tree
// ---------------------------------------------------------------------------

/**
 * 5 000 flat nodes rendered with `virtualize`. Only the visible window (~15–25
 * rows) is mounted in the DOM at any time; keyboard navigation and End/Home
 * work across all 5 000 items.
 */
export const Virtualized: Story = {
  args: {
    nodes: LARGE_NODES,
    virtualize: true,
    estimateRowHeight: 32,
    overscan: 8,
    maxHeight: "400px",
    selectionMode: "single",
    defaultExpandedIds: [],
  },
  parameters: {
    docs: {
      description: {
        story:
          "5 000 flat nodes with `virtualize={true}`. Only the visible window is in the DOM. Use keyboard ArrowDown/Up/Home/End to navigate; the virtualizer scrolls automatically.",
      },
    },
  },
};

/**
 * `scrollToId` reveals a node the virtualizer has windowed out of the DOM. Setting
 * `selectedIds` to a deep node alone would select it invisibly (structure shown,
 * but not "where I am"); passing the same id as `scrollToId` centers it. Click a
 * button — the matching row scrolls into view and shows as selected. (Use
 * `scrollSelectionIntoView` to reveal on every selection change instead.)
 */
function RevealSelectedNodeDemo() {
  const [target, setTarget] = useState<string | undefined>(undefined);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["node-50", "node-1200", "node-4300"].map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTarget(id)}
            className="rounded-md border border-border-strong bg-background px-3 py-1.5 text-body font-medium text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Navigate to Node {Number(id.split("-")[1]) + 1}
          </button>
        ))}
      </div>
      <Tree
        nodes={LARGE_NODES}
        virtualize
        estimateRowHeight={32}
        overscan={8}
        maxHeight="400px"
        selectionMode="single"
        selectedIds={target ? [target] : []}
        scrollToId={target}
      />
    </div>
  );
}

export const RevealSelectedNode: Story = {
  render: () => <RevealSelectedNodeDemo />,
  parameters: {
    docs: {
      description: {
        story:
          "Reveal a programmatically-selected node in a 5 000-node virtualized tree. `scrollToId` scrolls the windowed-out row into view (and expands its lazy ancestors when needed); keyboard navigation is unaffected.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Node 4301 (id node-4300) is far below the fold — not mounted initially.
    expect(canvas.queryByText("Node 4301")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Navigate to Node 4301" }));
    // scrollToId scrolls the virtualizer to it, so its row mounts and centers.
    await waitFor(() => expect(canvas.getByText("Node 4301")).toBeInTheDocument());
  },
};

// ---------------------------------------------------------------------------
// New story: lazy-loading children on demand
// ---------------------------------------------------------------------------

/**
 * `surface="sidebar"` renders the selected row with the sidebar's own active-item
 * treatment (`bg-sidebar-accent` + `text-sidebar-accent-foreground` + `font-medium`),
 * matching `SidebarMenuButton`'s active state — because the default `bg-accent`
 * fill is near-invisible against `--sidebar`. No fill is ≥3:1 on a sidebar, so
 * (like the Sidebar itself) perceivability comes from the foreground/weight shift
 * plus `aria-selected`, not fill contrast alone.
 *
 * NOTE: cross-theme visual correctness (every shipped theme — light,
 * dark) requires a real render and is owed to a human reviewer;
 * the tokens are semantic so they adapt, but pixel-level confirmation cannot be
 * automated in this environment.
 */
export const SidebarSurface: Story = {
  args: {
    nodes: fileTree,
    surface: "sidebar",
    defaultExpandedIds: ["src", "components"],
    defaultSelectedIds: ["button"],
    selectionMode: "single",
  },
  render: (args) => (
    <div className="w-64 rounded-md bg-sidebar p-2">
      <Tree {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const selected = canvas.getByRole("treeitem", { name: /button\.tsx/i });
    await waitFor(() => expect(selected).toBeVisible());
    await expect(selected).toHaveAttribute("aria-selected", "true");
  },
};

/**
 * Nodes marked `hasChildren: true` with no loaded `children` show the expand
 * chevron. On first expand, `loadChildren` is called; a skeleton loading row
 * appears under `aria-busy` while the request is in flight. Resolved children
 * are cached — re-expanding does not re-fetch. "Category C" simulates a
 * network error and shows the inline retry affordance.
 */
export const LazyLoading: Story = {
  args: {
    nodes: makeLazyRoot(),
    loadChildren: (node) => fakeFetch(node.id),
    selectionMode: "single",
    defaultExpandedIds: [],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Children are fetched on first expand via `loadChildren`. The spinner appears in the expand chevron while loading. A failed load shows a retry button.",
      },
    },
  },
};

// ---------------------------------------------------------------------------
// New story: per-node trailing accessory (#369)
// ---------------------------------------------------------------------------

/**
 * Per-node trailing content — e.g. a file-size badge — via `TreeNode.accessory`
 * (#369). It renders as a SIBLING of the label, outside the row's interactive
 * label region: it never joins the row's accessible name and clicking it never
 * selects or expands the row.
 */
export const TrailingAccessory: Story = {
  args: {
    nodes: fileTreeWithSizes,
    defaultExpandedIds: ["src", "components"],
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const buttonRow = canvas.getByRole("treeitem", { name: "button.tsx" });
    await waitFor(() => expect(buttonRow).toBeVisible());
    // The accessible name is exactly the file name — the badge text never leaks in.
    expect(canvas.queryByRole("treeitem", { name: /button\.tsx.*2\.1 KB/ })).toBeNull();

    // Clicking the badge does not select the row.
    await userEvent.click(canvas.getByText("2.1 KB"));
    await expect(buttonRow).not.toHaveAttribute("aria-selected", "true");

    // Clicking the row itself still selects it.
    await userEvent.click(buttonRow);
    await expect(buttonRow).toHaveAttribute("aria-selected", "true");
  },
};
