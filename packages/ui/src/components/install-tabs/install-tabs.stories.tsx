import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { InstallTabs, type InstallTabsHostTab, type InstallTabsSelectOption } from "./install-tabs";

const PACKAGE_OPTIONS: InstallTabsSelectOption[] = [
  {
    id: "ai-assistant",
    label: "AI assistant",
    command: "pnpm add @elabs-ai/components-ai @elabs-ai/components-ui",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    command:
      "pnpm add @elabs-ai/components-charts @elabs-ai/components-data @elabs-ai/components-ui",
  },
  {
    id: "data-app",
    label: "Data app",
    command: "pnpm add @elabs-ai/components-data @elabs-ai/components-ui",
  },
];

const BLOCK_OPTIONS: InstallTabsSelectOption[] = [
  {
    id: "kpi-movers-01",
    label: "KPI movers",
    command: "npx shadcn@latest add https://elabs-ai.com/r/kpi-movers-01.json",
  },
  {
    id: "app-shell",
    label: "App shell",
    command: "npx shadcn@latest add https://elabs-ai.com/r/app-shell.json",
  },
];

const HOST_TABS: InstallTabsHostTab[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    commands: [
      { label: "Add marketplace", command: "/plugin marketplace add mreimitz/elabs-components" },
      { label: "Install plugin", command: "/plugin install brand-ui" },
    ],
  },
  {
    id: "cursor",
    label: "Cursor",
    commands: [
      {
        label: "Add MCP server",
        command: '{ "mcpServers": { "brand-ui": { "url": "https://elabs-ai.com/mcp" } } }',
      },
    ],
  },
];

const PROMPT =
  "Use brand-ui — MCP at https://elabs-ai.com/mcp, docs at /llms.txt — to build a dashboard for our support queue.";

const meta = {
  title: "Display/InstallTabs",
  component: InstallTabs,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Every way to bring brand-ui into a project, one tab strip: `pnpm add` by archetype, copy-own a registry block, per-host MCP setup, and an agent prompt.",
      },
    },
  },
  args: {
    packageOptions: PACKAGE_OPTIONS,
    blockOptions: BLOCK_OPTIONS,
    hostTabs: HOST_TABS,
    prompt: PROMPT,
    onCommandCopy: fn(),
    onPromptCopy: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InstallTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Picking the "dashboard" archetype swaps the shown command. */
export const ArchetypeSelected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: "Archetype" }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("option", { name: "Dashboard" }));
    await waitFor(() =>
      expect(
        canvas.getByText(
          "pnpm add @elabs-ai/components-charts @elabs-ai/components-data @elabs-ai/components-ui",
        ),
      ).toBeInTheDocument(),
    );
  },
};

/** The `Copy-own` tab lists blocks and shows the `shadcn add` command for the selection. */
export const CopyOwnTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Copy-own" }));
    await waitFor(() =>
      expect(
        canvas.getByText("npx shadcn@latest add https://elabs-ai.com/r/kpi-movers-01.json"),
      ).toBeInTheDocument(),
    );
  },
};

/** A host tab shows its own commands, top to bottom. */
export const HostTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Cursor" }));
    await waitFor(() =>
      expect(
        canvas.getByText('{ "mcpServers": { "brand-ui": { "url": "https://elabs-ai.com/mcp" } } }'),
      ).toBeInTheDocument(),
    );
  },
};

/** The prompt tab's text is read-only and contains the MCP URL and `/llms.txt`. */
export const PromptTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Prompt" }));
    const textbox = canvas.getByDisplayValue(PROMPT);
    await expect(textbox).toHaveAttribute("readonly");
  },
};
