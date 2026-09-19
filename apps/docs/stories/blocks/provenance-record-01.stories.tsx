import type { Meta, StoryObj } from "@storybook/react-vite";
import { contactRecord } from "@/components/agent-ops-parts/data/atlas-ops";
import { ProvenanceRecord } from "@/components/provenance-record-01/provenance-record";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Agent Ops/Provenance Record",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Where did each field come from?",
      description: {
        component:
          "A record whose every field says where its value came from: derived (confidence + evidence kind), pinned (who, when), conflict (two sources disagree, nothing chosen) or empty (“No signal yet” — never a guess). Each state has its own glyph + text; the footer counts them.\n\nCopy-own it: `npx shadcn add provenance-record-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ProvenanceRecord>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <ProvenanceRecord /> };

/** Every field derived, nothing pinned and no conflict — the calm case. */
export const AllDerived: Story = {
  render: () => (
    <ProvenanceRecord
      fields={contactRecord.fields.filter((f) => f.provenance.state === "derived")}
      stage="Qualified"
    />
  ),
};

export const Narrow: Story = {
  render: () => (
    <div className="w-full max-w-sm">
      <ProvenanceRecord />
    </div>
  ),
};
