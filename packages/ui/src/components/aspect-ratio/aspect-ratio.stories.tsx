import type { Meta, StoryObj } from "@storybook/react-vite";
import { AspectRatio } from "./aspect-ratio";
const meta = {
  title: "Display/AspectRatio",
  component: AspectRatio,
  tags: ["autodocs"],
  argTypes: {
    ratio: {
      description: "Aspect ratio as a number (e.g. `16/9`, `4/3`, `1`). Defaults to `1`.",
      control: "number",
      table: { category: "Appearance" },
    },
    className: {
      description: "Extra Tailwind classes merged on the wrapper.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof AspectRatio>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <div className="w-72">
      <AspectRatio
        ratio={16 / 9}
        className="flex items-center justify-center rounded-md bg-muted text-body text-muted-foreground"
      >
        16 / 9
      </AspectRatio>
    </div>
  ),
};

export const Square: Story = {
  render: () => (
    <div className="w-48">
      <AspectRatio
        ratio={1}
        className="flex items-center justify-center rounded-md bg-muted text-body text-muted-foreground"
      >
        1 / 1
      </AspectRatio>
    </div>
  ),
};
