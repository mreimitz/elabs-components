import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  IntegrationMatrix,
  type IntegrationMatrixHost,
  type IntegrationMatrixRoutineStep,
  type IntegrationMatrixRow,
} from "./integration-matrix";

const HOSTS: IntegrationMatrixHost[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "vscode", label: "VS Code" },
  { id: "codex", label: "Codex" },
  { id: "other", label: "Other" },
];

const ROWS: IntegrationMatrixRow[] = [
  {
    id: "hosted-mcp",
    unit: "Hosted MCP",
    gives: "A remote MCP server — no local process to run.",
    actions: [
      {
        label: "Add server",
        kind: "copy",
        value: {
          "claude-code": "claude mcp add --transport http brand-ui https://elabs-ai.com/mcp",
          cursor: '{ "mcpServers": { "brand-ui": { "url": "https://elabs-ai.com/mcp" } } }',
          vscode: '{ "servers": { "brand-ui": { "url": "https://elabs-ai.com/mcp" } } }',
          codex: "https://elabs-ai.com/mcp",
          other: "https://elabs-ai.com/mcp",
        },
      },
    ],
  },
  {
    id: "local-mcp",
    unit: "Local MCP + CLI",
    gives: "The same tools, run from your machine, plus `audit --strict`.",
    actions: [{ label: "Run locally", kind: "copy", value: "npx -y @elabs-ai/components-cli mcp" }],
  },
  {
    id: "plugin",
    unit: "Claude Code plugin",
    gives: "11 skills your agent picks up automatically.",
    actions: [
      {
        label: "Add marketplace",
        kind: "copy",
        value: {
          "claude-code": "/plugin marketplace add mreimitz/elabs-components",
          cursor: "Plugin is Claude-Code-specific — use the hosted MCP row instead.",
          vscode: "Plugin is Claude-Code-specific — use the hosted MCP row instead.",
          codex: "Plugin is Claude-Code-specific — use the hosted MCP row instead.",
          other: "Plugin is Claude-Code-specific — use the hosted MCP row instead.",
        },
      },
    ],
  },
  {
    id: "llms-txt",
    unit: "llms.txt",
    gives: "A plain-text map of the docs for any agent that reads it.",
    actions: [{ label: "Open", kind: "link", value: "https://elabs-ai.com/llms.txt" }],
  },
  {
    id: "registry",
    unit: "Registry",
    gives: "65 shadcn-compatible blocks, copy-owned into your app.",
    actions: [{ label: "Browse", kind: "link", value: "https://elabs-ai.com/r" }],
  },
  {
    id: "manifest",
    unit: "Manifest",
    gives: "Every export, prop and gate, machine-readable.",
    actions: [
      { label: "Open", kind: "link", value: "https://elabs-ai.com/brand-ui.manifest.json" },
    ],
  },
];

const ROUTINE: IntegrationMatrixRoutineStep[] = [
  { verb: "info", does: "Prints the project's taste profile and package layer graph." },
  { verb: "search", does: "Finds a component by keyword across every package." },
  { verb: "docs", does: "Prints one component's props, variants and anti-patterns." },
  { verb: "build", does: "Scaffolds a screen from an archetype template." },
  { verb: "audit --strict", does: "Fails the build on a raw color, a missing focus ring, …" },
];

const meta = {
  title: "Display/IntegrationMatrix",
  component: IntegrationMatrix,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Every agent-facing integration unit as installable rows, with a host selector that swaps every row's copy command at once.",
      },
    },
  },
  args: { hosts: HOSTS, rows: ROWS, routine: ROUTINE, onCopyAction: fn(), onValueChange: fn() },
} satisfies Meta<typeof IntegrationMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A host picked up front (uncontrolled `defaultValue`) shows its own commands. */
export const CursorSelected: Story = { args: { defaultValue: "cursor" } };

/** One host only: no selector, every row shows its single command. */
export const SingleHost: Story = { args: { hosts: [HOSTS[0]!] } };

/** Choosing another host swaps every row's copy command at once. */
export const SwitchHost: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: "Host to show commands for" }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("option", { name: "Cursor" }));
    await waitFor(() =>
      expect(
        canvas.getByText('{ "mcpServers": { "brand-ui": { "url": "https://elabs-ai.com/mcp" } } }'),
      ).toBeInTheDocument(),
    );
  },
};

/** Copying a row's command writes the exact per-host string. */
export const CopyAction: Story = {
  play: async ({ canvasElement, args }) => {
    const writeText = fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("button", { name: "Copy command" })[0]!);
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "claude mcp add --transport http brand-ui https://elabs-ai.com/mcp",
      ),
    );
    await waitFor(() => expect(args.onCopyAction).toHaveBeenCalled());
  },
};

/** The routine chip's tooltip shows the verb's `does` text. */
export const RoutineTooltip: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByText("audit --strict");
    await userEvent.hover(chip);
    const body = within(canvasElement.ownerDocument.body);
    // Radix nests an sr-only role="tooltip" copy of the text INSIDE the visible popper
    // content, so the text matches twice — target the popper content node (the only one
    // carrying data-side), same pattern as tooltip.stories.tsx's own hover test.
    await waitFor(() =>
      expect(
        body.getByText("Fails the build on a raw color, a missing focus ring, …", {
          selector: "[data-side]",
        }),
      ).toBeInTheDocument(),
    );
  },
};
