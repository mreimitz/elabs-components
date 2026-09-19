import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfographicDependencyWeb } from "@/components/infographic-dependency-web-01/infographic-dependency-web";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: InfographicDependencyWeb,
  title: "Patterns/Blocks/Infographics/Dependency Web",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What depends on what?",
      description: {
        component:
          "A platform's call graph as a `NetworkChart` — node size is traffic, colour is tier — beside the same services as a `TreeChart` of who owns what. The headline counts inbound links and names the service the most others lean on.\n\nCopy-own it: `npx shadcn add infographic-dependency-web-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicDependencyWeb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One ring, chords bundled toward the centre — every label stays readable. */
export const CircularLayout: Story = { args: { layout: "circular" } };
