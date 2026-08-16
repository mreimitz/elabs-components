import type { Meta, StoryObj } from "@storybook/react-vite";
import { FigAnnotation } from "./fig-annotation";
import { GridPaper } from "../grid-paper";

const meta = {
  title: "Blueprint/FigAnnotation",
  component: FigAnnotation,
  tags: ["autodocs"],
  globals: { theme: "blueprint" },
} satisfies Meta<typeof FigAnnotation>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { figNumber: 1, caption: "Independent transforms on a single element." },
};

export const WithFigure: Story = {
  render: () => (
    <figure className="space-y-2">
      <GridPaper className="h-40 w-72 border border-rule" />
      <FigAnnotation figNumber={2} caption="Scroll-linked motion via ScrollTimeline." />
    </figure>
  ),
};
