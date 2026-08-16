import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingState } from "./loading-state";

const meta = {
  title: "States/LoadingState",
  component: LoadingState,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          '@deprecated — use `<StatePanel kind="loading" />` instead. Thin back-compat wrapper.',
      },
    },
  },
  argTypes: {
    label: {
      description: 'Accessible status label shown below the spinner. Default "Loading…".',
      control: "text",
      table: { category: "Content" },
    },
    size: {
      description: "Visual size of the spinner.",
      control: { type: "radio" },
      options: ["sm", "md", "lg"],
      table: { category: "Appearance" },
    },
    className: {
      description: "Additional CSS classes applied to the container.",
      control: "text",
      table: { category: "Styling" },
    },
  },
} satisfies Meta<typeof LoadingState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: "Loading workspace…" } };
