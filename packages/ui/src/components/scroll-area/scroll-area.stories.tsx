import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "./scroll-area";
const meta = {
  title: "Display/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
  argTypes: {
    type: {
      description: "Controls scrollbar visibility: `auto` (default), `always`, `scroll`, `hover`.",
      control: { type: "select" },
      options: ["auto", "always", "scroll", "hover"],
      table: { category: "Behavior" },
    },
    scrollHideDelay: {
      description:
        "Duration (ms) before the scrollbar hides (applicable to `scroll` and `hover` types).",
      control: "number",
      table: { category: "Behavior" },
    },
    dir: {
      description: "Reading direction — affects scrollbar placement.",
      control: { type: "radio" },
      options: ["ltr", "rtl"],
      table: { category: "Behavior" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn() on the root.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof ScrollArea>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <ScrollArea className="h-40 w-56 rounded-md border p-3">
      <div className="space-y-2 text-body">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i}>Row {i + 1}</p>
        ))}
      </div>
    </ScrollArea>
  ),
};
