import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { FlowToneIndicator } from "../flow-tone";
import { FlowNodeCard } from "./flow-node-card";

const meta = {
  title: "Flow/FlowNodeCard",
  component: FlowNodeCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof FlowNodeCard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The card body every custom node paints, with a title and a tone glyph. */
function CardBody({
  title,
  tone,
  emphasis,
}: {
  title: string;
  tone?: "neutral" | "info" | "success" | "warning" | "destructive";
  emphasis?: "default" | "featured";
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-body font-medium">{title}</span>
      <FlowToneIndicator tone={tone} emphasis={emphasis} />
    </div>
  );
}

/** A neutral card: the resting surface, no tone and no emphasis. */
export const Default: Story = {
  args: { className: "w-44 px-3 py-2", children: <CardBody title="Clean & join" /> },
};

/** Every status tone. The border and the glyph carry the tone together, never colour alone. */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <FlowNodeCard tone="neutral" className="w-44 px-3 py-2">
        <CardBody title="Transform" tone="neutral" />
      </FlowNodeCard>
      <FlowNodeCard tone="info" className="w-44 px-3 py-2">
        <CardBody title="Queued" tone="info" />
      </FlowNodeCard>
      <FlowNodeCard tone="success" className="w-44 px-3 py-2">
        <CardBody title="Dashboard" tone="success" />
      </FlowNodeCard>
      <FlowNodeCard tone="warning" className="w-44 px-3 py-2">
        <CardBody title="Latency" tone="warning" />
      </FlowNodeCard>
      <FlowNodeCard tone="destructive" className="w-44 px-3 py-2">
        <CardBody title="Failed" tone="destructive" />
      </FlowNodeCard>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Warning")).toHaveClass("sr-only");
    await expect(canvasElement.querySelectorAll('[data-slot="flow-node-card"]')).toHaveLength(5);
  },
};

/**
 * The `featured` emphasis: a star beside the title, on its own or with a status tone. On a
 * neutral card it also takes the primary border; a status tone keeps its own border.
 */
export const Featured: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <FlowNodeCard emphasis="featured" className="w-44 px-3 py-2">
        <CardBody title="Postgres" emphasis="featured" />
      </FlowNodeCard>
      <FlowNodeCard tone="success" emphasis="featured" className="w-44 px-3 py-2">
        <CardBody title="Dashboard" tone="success" emphasis="featured" />
      </FlowNodeCard>
      <FlowNodeCard tone="destructive" emphasis="default" className="w-44 px-3 py-2">
        <CardBody title="Failed" tone="destructive" emphasis="default" />
      </FlowNodeCard>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Featured")).toHaveClass("sr-only");
    await expect(canvas.getByText("Featured, Success")).toHaveClass("sr-only");
  },
};

/** A selected card paints the selection ring. Keyboard focus is a separate outline. */
export const Selected: Story = {
  args: {
    selected: true,
    tone: "success",
    className: "w-44 px-3 py-2",
    children: <CardBody title="Dashboard" tone="success" />,
  },
};
