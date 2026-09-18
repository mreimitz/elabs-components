import type { Meta, StoryObj } from "@storybook/react-vite";
import { auditEntries } from "@/components/agent-ops-parts/data/atlas-ops";
import { AuditLog } from "@/components/audit-log-01/audit-log";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Agent Ops/Who Did What (Audit Log)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "An append-only audit table whose actor column tells copilot, delegated agent and person apart by glyph, and whose result column is a status badge with an icon (Applied / Held / Stopped / Reverted). Monospace tabular timestamps; one plain sentence per action.\n\nCopy-own it: `npx shadcn add audit-log-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AuditLog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <AuditLog /> };

/** Only the copilot’s own writes — a filter a real log offers. */
export const CopilotOnly: Story = {
  render: () => <AuditLog entries={auditEntries.filter((e) => e.actor.kind === "copilot")} />,
};

export const Narrow: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <AuditLog />
    </div>
  ),
};
