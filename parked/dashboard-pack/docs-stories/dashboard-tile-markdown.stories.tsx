import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  DashboardProvider,
  DashboardSheet,
  builtInTiles,
  createLocalSelectionDriver,
  type DashboardSpec,
} from "@elabs-ai/components-charts/dashboard";
import {
  createMarkdownTileKind,
  markdownTileKind,
} from "@/components/dashboard-tile-markdown/dashboard-tile-markdown";

/**
 * Renders the SHIPPED registry block (`@/components/…` maps to `registry/blocks`), a
 * `DashboardTileKind` for a markdown tile. See `.claude/rules/registry.md`.
 */
const ROWS = [
  { Region: "EMEA", Product: "Widget" },
  { Region: "EMEA", Product: "Gadget" },
  { Region: "APAC", Product: "Gizmo" },
];

const BODY = `## Sales reporting — project concept

Selected regions: **\${{selection.Region}}** (\${{selection.count('Region')}} selected).
Target this year: **\${{variables.target}}**. Pipeline: **\${{=Sum(Pipeline)}}**.

| Metric | Value |
| --- | --- |
| Revenue YTD | \${{msr:rev-ytd:Revenue YTD}} |
| Win rate | 41 % |

- Data model agreed
- Filters under review
`;

const SPEC: DashboardSpec = {
  version: 1,
  id: "markdown-tile-demo",
  grid: { mode: "fit", columns: 12, rows: 8, gap: 8 },
  variables: [{ name: "target", type: "number", default: 12000000, label: "Annual target" }],
  tiles: [
    {
      id: "note",
      kind: "text",
      title: "Project concept",
      layout: { x: 0, y: 0, w: 8, h: 8 },
      content: { body: BODY },
    },
    {
      id: "region",
      kind: "filter",
      layout: { x: 8, y: 0, w: 4, h: 8 },
      content: {
        field: "Region",
        values: [
          { value: "EMEA", count: 2 },
          { value: "APAC", count: 1 },
        ],
      },
    },
  ],
};

const TILES = [
  ...Object.values(builtInTiles).filter((k) => k.kind !== "text"),
  createMarkdownTileKind("text"),
];

function MarkdownTileDemo({ mode = "view" }: { mode?: "view" | "edit" }) {
  const driver = createLocalSelectionDriver();
  driver.register("rows", ROWS, ["Region", "Product"]);
  return (
    <div className="h-[520px] w-full min-w-[720px]">
      <DashboardProvider
        spec={SPEC}
        tiles={TILES}
        driver={driver}
        mode={mode}
        host={{
          markdown: {
            evaluate: (expr: string) =>
              expr.startsWith("msr:") ? "€ 4.2 M" : expr === "=Sum(Pipeline)" ? "€ 9.8 M" : "—",
            items: [
              { id: "rev-ytd", label: "Revenue YTD", group: "Measures" },
              { id: "region", label: "Region", group: "Dimensions" },
            ],
          },
        }}
      >
        <DashboardSheet renderAll />
      </DashboardProvider>
    </div>
  );
}

const meta = {
  title: "Dashboard/Recipes/Tile — Markdown",
  component: MarkdownTileDemo,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof MarkdownTileDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** View mode: the body renders as prose, placeholders resolve, a selection re-resolves them. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Selected regions:/)).toHaveTextContent("All");
    await expect(await canvas.findByText("€ 4.2 M")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("option", { name: "EMEA" }));
    await waitFor(() => expect(canvas.getByText(/Selected regions:/)).toHaveTextContent("EMEA"));
  },
};

/** Edit mode: the Edit content button opens the rail + editor + preview dialog; Save patches the tile. */
export const Editor: Story = {
  args: { mode: "edit" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Edit content" }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    await expect(
      within(dialog).getByRole("textbox", { name: "Markdown body" }),
    ).toBeInTheDocument();
    // The rail lists the sheet's variable, the selection field and the host's items.
    await expect(within(dialog).getByRole("button", { name: "Annual target" })).toBeInTheDocument();
    await expect(within(dialog).getByRole("button", { name: "Revenue YTD" })).toBeInTheDocument();
    // Insert the variable from the rail at the caret (the body's start): the preview
    // resolves it live, Save writes the body back to the tile.
    await userEvent.click(within(dialog).getByRole("textbox", { name: "Markdown body" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Annual target" }));
    const preview = within(dialog).getByRole("region", { name: "Preview" });
    await expect(await within(preview).findByText(/^12000000/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
    await expect(await canvas.findByText(/^12000000/)).toBeInTheDocument();
  },
};

/** Cancel discards the draft. */
export const EditorCancel: Story = {
  args: { mode: "edit" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Edit content" }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    // The dialog's close animation keeps it mounted for a moment.
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
  },
};

/** The kind under its own name, for a sheet that keeps the built-in text tile as well. */
export const OwnKind: Story = {
  render: () => (
    <div className="h-[320px] w-full min-w-[480px]">
      <DashboardProvider
        spec={{
          version: 1,
          id: "markdown-own",
          grid: { mode: "fit", columns: 8, rows: 6, gap: 8 },
          tiles: [
            {
              id: "md",
              kind: "markdown",
              layout: { x: 0, y: 0, w: 8, h: 6 },
              content: { body: "### Hello\n\nA **markdown** tile.", padding: 2 },
            },
          ],
        }}
        tiles={[markdownTileKind]}
      >
        <DashboardSheet renderAll />
      </DashboardProvider>
    </div>
  ),
};
