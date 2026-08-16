import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { ErrorState } from "./error-state";

const meta = {
  title: "States/ErrorState",
  component: ErrorState,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          '@deprecated — use `<StatePanel kind="error" />` instead. Thin back-compat wrapper.',
      },
    },
  },
  argTypes: {
    title: {
      description: 'Heading text. Defaults to "Something went wrong".',
      control: "text",
      table: { category: "Content" },
    },
    description: {
      description: "Supporting description. Defaults to a generic error message.",
      control: "text",
      table: { category: "Content" },
    },
    actions: {
      description: "Retry or support action buttons.",
      control: false,
      table: { category: "Content" },
    },
    className: {
      description: "Additional CSS classes applied to the container.",
      control: "text",
      table: { category: "Styling" },
    },
  },
} satisfies Meta<typeof ErrorState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    actions: (
      <Button size="sm" variant="outline">
        Retry
      </Button>
    ),
  },
};
