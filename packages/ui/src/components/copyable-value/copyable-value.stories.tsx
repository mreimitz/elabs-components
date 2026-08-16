import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CopyableValue } from "./copyable-value";

const meta = {
  title: "Display/CopyableValue",
  component: CopyableValue,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Shown short, copied exact. Numbers are formatted compact across the library — this keeps the unrounded figure one click (or one Enter) away.",
      },
    },
  },
  argTypes: {
    value: {
      description: "The exact text written to the clipboard.",
      control: "text",
      table: { category: "Content" },
    },
    children: {
      description: "What the reader sees. Defaults to `value`.",
      table: { category: "Content" },
    },
    hint: {
      description: 'Screen-reader hint appended to the visible text. Default: "Copy exact value".',
      control: "text",
      table: { category: "Content" },
    },
    resetAfterMs: {
      description: 'ms the "Copied" confirmation stays. Default: 1500.',
      control: "number",
      table: { category: "Behavior" },
    },
  },
} satisfies Meta<typeof CopyableValue>;
export default meta;
type Story = StoryObj<typeof meta>;

/** With no children the exact value is also what is shown. */
export const Default: Story = {
  args: { value: "50012102.632741" },
};

/** The usual case: a compact display over an unrounded clipboard payload. */
export const Compacted: Story = {
  args: { value: "50012102.632741", children: "50M" },
};

/** Inline inside a sentence — it reads as text, not as a link. */
export const InProse: Story = {
  args: { value: "1500000" },
  render: (args) => (
    <p className="text-body text-foreground">
      Revenue reached <CopyableValue {...args}>1.5M</CopyableValue> across the quarter.
    </p>
  ),
};

/** The hint is part of the accessible name, so voice control can say what it reads. */
export const CustomHint: Story = {
  args: { value: "0.9612", children: "96.1%", hint: "Copy unrounded rate" },
};

/**
 * Keyboard path: the value is a real button, so it is a tab stop and Enter copies.
 * jsdom/Chromium may deny clipboard permission — the assertion is on the control's
 * reachability and name, not on the clipboard contents.
 */
export const KeyboardReachable: Story = {
  args: { value: "50012102.632741", children: "50M" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /50M Copy exact value/i });
    await userEvent.tab();
    await expect(button).toHaveFocus();
  },
};
