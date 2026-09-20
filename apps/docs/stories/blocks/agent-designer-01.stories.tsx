import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AgentDesigner } from "@/components/agent-designer-01/agent-designer";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: AgentDesigner,
  title: "Patterns/Blocks/Agent Ops/Agent Designer",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What is this agent allowed to use, and where does a person step in?",
      description: {
        component:
          "A canvas for designing business agents. The flow runs left to right — trigger, guardrail, agent, router, human approval, action — on solid arrows. Under each agent hangs its equipment on square ports and dashed links: a model, skills, MCP servers (with a switch per tool and “ask a person every time” on the ones that write), knowledge and memory. A searchable palette adds by drag or by click; a capability clicked while an agent is selected attaches to it and takes its seat in the column for its kind. The inspector has one form per node kind. Design checks point at the node they are about (an agent with no model, a server nobody signed in to, a payment that can run with no person on the path). A simulated test run lights the path, shows what each agent used and pauses at approvals. Undo/redo and auto-layout included.\n\nIt renders and edits plain data; it calls no model and no server.\n\nCopy-own it: `npx shadcn add agent-designer-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AgentDesigner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One well-equipped agent: three skills, two MCP servers, a router and an approval on the expensive path. */
export const SupportResolution: Story = {};

/** An agent in the inspector: identity, autonomy and limits, and its equipment by port. */
export const AgentSelected: Story = { args: { defaultSelectedNodeId: "resolver" } };

/** An MCP server in the inspector: connection state, a switch per tool, and “ask first” on the tools that write. */
export const McpServerSelected: Story = { args: { defaultSelectedNodeId: "resolver-mcp-5" } };

/** The design checks open: what a reviewer would ask before this goes live. */
export const DesignChecks: Story = { args: { defaultPanel: "checks" } };

/** A pipeline of two narrow agents ending in a ledger posting behind a controller’s signature. */
export const InvoiceProcessing: Story = { args: { defaultScenarioId: "invoices" } };

/** Four agents handing work along, with a reviewer on a stronger model before anything is sent. */
export const LeadQualification: Story = { args: { defaultScenarioId: "leads" } };

/**
 * A test run from start to finish: it lights the path, stops at the approval, and carries on
 * down the branch the answer picks. Simulated — nothing is called.
 */
export const TestRun: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Test run" }));
    // The run pauses at the human approval and says who it is waiting for.
    const approve = await canvas.findByRole("button", { name: "Approve" }, { timeout: 20_000 });
    await expect(canvas.getByText("Paused: waiting for a person.")).toBeVisible();
    await userEvent.click(approve);
    // Approved → the refund branch, then the run ends.
    await waitFor(() => expect(canvas.getByText(/^Finished · 6 steps/)).toBeVisible(), {
      timeout: 20_000,
    });
    await expect(canvas.getByRole("button", { name: "Issue refund" })).toBeVisible();
  },
};

/** Equipping an agent from the palette: select the agent, click a skill, and it takes its seat under the Skills port. */
export const EquipFromPalette: Story = {
  args: { defaultSelectedNodeId: "resolver" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = canvasElement.querySelectorAll('[data-slot="capability-node"]').length;
    await userEvent.click(canvas.getByRole("button", { name: /^SQL analyst/ }));
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot="capability-node"]').length).toBe(
        before + 1,
      ),
    );
    // The agent stays selected, so the next click equips it further; and the step is undoable.
    await expect(canvas.getByText(/to equip Support resolver/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Undo" })).toBeEnabled();
  },
};
