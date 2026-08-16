import type { Meta, StoryObj } from "@storybook/react-vite";
import { TitleBlock } from "./title-block";

const meta = {
  title: "Blueprint/TitleBlock",
  component: TitleBlock,
  tags: ["autodocs"],
  globals: { theme: "blueprint" },
} satisfies Meta<typeof TitleBlock>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Pump Assembly",
    scale: "1:2",
    sheet: "A-01",
    revision: "C",
    drawnBy: "A. Jensen",
    date: "2026-06-06",
    className: "w-[28rem]",
  },
};

export const WithExtraFields: Story = {
  args: {
    title: "Motion · Examples",
    scale: "1:1",
    sheet: "M-380",
    revision: "12.40.0",
    fields: [
      { label: "Project", value: "Blueprint UI" },
      { label: "Units", value: "px" },
    ],
    className: "w-[28rem]",
  },
};
