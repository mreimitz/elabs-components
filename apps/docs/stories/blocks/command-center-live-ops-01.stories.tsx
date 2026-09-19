import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommandCenterLiveOps } from "@/components/command-center-live-ops-01/command-center-live-ops";
import { opsServices } from "@/components/command-center-live-ops-01/data/live-ops";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: CommandCenterLiveOps,
  title: "Patterns/Blocks/Command Centers/Live Ops Wall",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What is happening right now, and what needs me?",
      description: {
        component:
          "An operations wall that moves: a `LiveLineChart` streaming one reading a second and easing to each new value, three `Gauge` dials with their targets drawn on the dial, a `Timeline` of what the on-call already knows, services sorted worst first with a `Sparkline` and a status badge each, and a `HeatmapChart` of when the load arrives. The headline is computed from the services, so it is never out of step with the list. `paused` freezes the stream.\n\nCopy-own it: `npx shadcn add command-center-live-ops-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CommandCenterLiveOps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The stream held still — the state a screenshot or a reduced-motion reader gets. */
export const Paused: Story = { args: { paused: true } };

/** Nothing wrong: the headline says so and no badge is red. */
export const AllHealthy: Story = {
  args: {
    services: opsServices.map((service) => ({
      ...service,
      state: "healthy" as const,
      latency: service.latency || 140,
    })),
    incidents: [],
  },
};
