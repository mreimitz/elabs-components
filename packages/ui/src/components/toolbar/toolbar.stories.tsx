import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ItalicIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react";

import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarToggleGroup,
  ToolbarToggleItem,
} from "./toolbar";

/**
 * A dense row of controls that acts on the content beside it — and the only row
 * in the system that claims `role="toolbar"`, because it is the only one that
 * keeps the role's promise: **one tab stop, arrow keys move between controls**.
 *
 * For the ordinary control row above a list or table, reach for `ViewToolbar`
 * instead — there every control is its own tab stop, which is what readers
 * expect there.
 */
const meta = {
  title: "Layout/Toolbar",
  component: Toolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The one row that genuinely claims the `toolbar` ARIA role: Radix delegates a roving tabindex to it, so ten controls cost one tab stop instead of ten. The row above a list, table or board — filters left, actions right — is `Layout/ViewToolbar`, which deliberately does NOT claim that role because its controls are ordinary tab stops. See [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
  args: { "aria-label": "Formatting" },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Toolbar {...args}>
      <ToolbarButton aria-label="Undo" size="icon-sm">
        <Undo2Icon aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton aria-label="Redo" size="icon-sm">
        <Redo2Icon aria-hidden="true" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarToggleGroup type="multiple" aria-label="Text style">
        <ToolbarToggleItem value="bold" aria-label="Bold">
          <BoldIcon aria-hidden="true" />
        </ToolbarToggleItem>
        <ToolbarToggleItem value="italic" aria-label="Italic">
          <ItalicIcon aria-hidden="true" />
        </ToolbarToggleItem>
      </ToolbarToggleGroup>
      <ToolbarSeparator />
      <ToolbarToggleGroup type="single" defaultValue="left" aria-label="Alignment">
        <ToolbarToggleItem value="left" aria-label="Align left">
          <AlignLeftIcon aria-hidden="true" />
        </ToolbarToggleItem>
        <ToolbarToggleItem value="center" aria-label="Align centre">
          <AlignCenterIcon aria-hidden="true" />
        </ToolbarToggleItem>
        <ToolbarToggleItem value="right" aria-label="Align right">
          <AlignRightIcon aria-hidden="true" />
        </ToolbarToggleItem>
      </ToolbarToggleGroup>
      <span className="flex-1" />
      <ToolbarButton variant="outline">Publish</ToolbarButton>
    </Toolbar>
  ),
};

/**
 * The behaviour the role promises, exercised: Tab reaches the toolbar ONCE, and
 * the arrow keys walk it. A row that claims `role="toolbar"` without this tells
 * a screen-reader user to press keys that do nothing.
 */
export const KeyboardNavigation: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toolbar = canvas.getByRole("toolbar", { name: "Formatting" });

    await userEvent.tab();
    const undo = canvas.getByRole("button", { name: "Undo" });
    await expect(undo).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("button", { name: "Redo" })).toHaveFocus();

    // Out of the toolbar in one Tab — the whole row is a single stop.
    await userEvent.tab();
    await expect(toolbar.contains(document.activeElement)).toBe(false);
  },
};

/** A rail beside the content it acts on. Arrow keys follow the orientation. */
export const Vertical: Story = {
  args: { "aria-label": "Document", orientation: "vertical" },
  render: (args) => (
    <Toolbar {...args} className="w-fit">
      <ToolbarButton aria-label="Undo" size="icon-sm">
        <Undo2Icon aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton aria-label="Redo" size="icon-sm">
        <Redo2Icon aria-hidden="true" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarToggleGroup type="multiple" aria-label="Text style">
        <ToolbarToggleItem value="bold" aria-label="Bold">
          <BoldIcon aria-hidden="true" />
        </ToolbarToggleItem>
      </ToolbarToggleGroup>
    </Toolbar>
  ),
};

/** Explicitly horizontal — the default, spelled out. */
export const Horizontal: Story = {
  ...Default,
  args: { "aria-label": "Formatting", orientation: "horizontal" },
};
