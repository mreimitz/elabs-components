import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingTrust } from "@/components/marketing-trust-01/marketing-trust";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingTrust,
  title: "Patterns/Blocks/Marketing/Trust",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Will security sign this off?",
      description: {
        component:
          "Compliance and security stated plainly: the standards as text badges with a shield rather than borrowed certifier logos, four facts about how data is handled with the uptime figure on a real `Meter`, and a strip of proofs each linking to the document behind it, with the trust centre one click away.\n\nCopy-own it: `npx shadcn add marketing-trust-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingTrust>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Fewer standards, no proof strip — an early-stage product that is honest about it. */
export const EarlyStage: Story = {
  args: {
    title: "Where we are on security, today",
    description:
      "SOC 2 is in progress. Everything below is already true and we will show you the evidence.",
    badges: [
      { id: "soc2", label: "SOC 2 Type II", status: "Audit under way, report in Q1" },
      { id: "gdpr", label: "GDPR", status: "Compliant, EU processing" },
    ],
    proofs: [],
  },
};
