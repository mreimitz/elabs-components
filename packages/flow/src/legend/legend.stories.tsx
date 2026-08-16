import type { Meta, StoryObj } from "@storybook/react-vite";
import { Legend } from "./legend";

const meta = {
  title: "Flow/Legend",
  component: Legend,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Legend>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default legend with a title and token-based color references. */
export const Default: Story = {
  args: {
    title: "Node types",
    items: [
      { label: "Source", color: "var(--primary)" },
      { label: "Transform", color: "var(--muted-foreground)" },
      { label: "Output", color: "var(--success)" },
    ],
  },
};

/** Legend without a title — items only. */
export const NoTitle: Story = {
  args: {
    items: [
      { label: "Source", color: "var(--primary)" },
      { label: "Transform", color: "var(--muted-foreground)" },
      { label: "Output", color: "var(--success)" },
    ],
  },
};

/** Richer set of items representing a full pipeline. */
export const FullPipeline: Story = {
  args: {
    title: "Pipeline stages",
    items: [
      { label: "Source", color: "var(--primary)" },
      { label: "Transform", color: "var(--muted-foreground)" },
      { label: "Validate", color: "var(--warning)" },
      { label: "Output", color: "var(--success)" },
      { label: "Error", color: "var(--destructive)" },
    ],
  },
};

/** Single item. */
export const SingleItem: Story = {
  args: {
    title: "Key",
    items: [{ label: "Active node", color: "var(--primary)" }],
  },
};
