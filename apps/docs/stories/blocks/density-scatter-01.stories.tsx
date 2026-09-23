import type { Meta, StoryObj } from "@storybook/react-vite";
import { DensityScatterBlock } from "@/components/density-scatter-01/density-scatter-block";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: DensityScatterBlock,
  title: "Patterns/Blocks/Editorial Charts/Density scatter",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I show every one of 200,000 points — and still see the shape?",
      description: {
        component:
          "Three uses of `DensityScatterChart`: a flight-test envelope (200k positions against two zones on the axes), a semiconductor wafer map (150k dies by test bin) and a trading fill-latency plot (250k fills with SLA bands). Every point is drawn; density carries the colour; zoom in and the shape resolves into dots. Selection is the intersection of an x range, a y range, a lasso and a zone pick.\n\nCopy-own it: `npx shadcn add density-scatter-01`.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    useCase: { control: "radio", options: ["approach", "wafer", "fills"] },
  },
} satisfies Meta<typeof DensityScatterBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Flight test: 200,000 recorded positions against the operational design domain. */
export const FlightTestEnvelope: Story = { args: { useCase: "approach" } };

/** Semiconductor: a 150,000-die wafer map coloured by test bin. */
export const WaferProbeMap: Story = { args: { useCase: "wafer" } };

/** Trading: 250,000 fills, order size against latency, SLA bands on the axis. */
export const FillLatency: Story = { args: { useCase: "fills" } };
