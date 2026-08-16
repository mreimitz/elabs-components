import type { Meta, StoryObj } from "@storybook/react-vite";
import { GridPaper } from "./grid-paper";

const meta = {
  title: "Blueprint/GridPaper",
  component: GridPaper,
  tags: ["autodocs"],
  globals: { theme: "blueprint" },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof GridPaper>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Lines: Story = {
  args: { variant: "lines", className: "h-72 w-full" },
};

export const Dots: Story = {
  args: { variant: "dots", className: "h-72 w-full" },
};

export const Crosshatch: Story = {
  args: { variant: "crosshatch", className: "h-72 w-full" },
};

export const Hatch: Story = {
  args: { variant: "hatch", className: "h-72 w-full" },
};

export const Faded: Story = {
  args: { variant: "lines", fade: true, className: "h-72 w-full" },
};

export const AsGround: Story = {
  render: () => (
    <GridPaper className="grid h-72 w-full place-items-center">
      <p className="font-mono text-body text-foreground">Content drawn on the sheet</p>
    </GridPaper>
  ),
};
