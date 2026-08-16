import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useState } from "react";
import { ListEditor } from "./list-editor";

const meta = {
  title: "Forms/ListEditor",
  component: ListEditor,
  tags: ["autodocs"],
  args: {
    placeholder: "--flag=value…",
  },
  argTypes: {
    value: {
      description: "Controlled list of strings.",
      control: false,
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial list of strings.",
      control: false,
      table: { category: "State" },
    },
    reorderable: {
      description: "Whether rows can be reordered via move-up/move-down buttons.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    max: {
      description: "Maximum number of rows allowed.",
      control: "number",
      table: { category: "Behavior" },
    },
    placeholder: {
      description: "Placeholder shown in each row's text field.",
      control: "text",
      table: { category: "Content" },
    },
    disabled: {
      description: "Disables the editor.",
      control: "boolean",
      table: { category: "State" },
    },
    addLabel: {
      description: 'Label for the "add item" control.',
      control: "text",
      table: { category: "Content" },
    },
    onValueChange: {
      description: "Called when the list changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof ListEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: ["--verbose", "--output=json"] },
};

export const Controlled: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [items, setItems] = useState(["one", "two"]);
    return (
      <div className="flex flex-col gap-2 max-w-sm">
        <ListEditor value={items} onValueChange={setItems} placeholder="Item…" />
        <p className="text-body text-muted-foreground">Items: {items.join(", ") || "none"}</p>
      </div>
    );
  },
};

export const NonReorderable: Story = {
  args: { defaultValue: ["first", "second"], reorderable: false },
};

/** Adds a row, types into it, removes a row, and moves a row up — all via real buttons. */
export const AddEditRemoveMove: Story = {
  args: { defaultValue: ["alpha", "beta"] },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /add item/i }));
    const rowInputs = canvas.getAllByRole("textbox");
    await expect(rowInputs).toHaveLength(3);
    await userEvent.type(rowInputs[2]!, "gamma");
    await expect(rowInputs[2]).toHaveValue("gamma");

    // Move the last row up one position via the keyboard-operable button.
    const moveUpButtons = canvas.getAllByRole("button", { name: /move item 3 up/i });
    await userEvent.click(moveUpButtons[0]!);
    const afterMove = canvas.getAllByRole("textbox");
    await expect(afterMove[1]).toHaveValue("gamma");

    await userEvent.click(canvas.getAllByRole("button", { name: /remove item 1/i })[0]!);
    await expect(canvas.getAllByRole("textbox")).toHaveLength(2);
  },
};

export const WithMax: Story = {
  args: { defaultValue: ["one", "two"], max: 2 },
};

export const Disabled: Story = {
  args: { defaultValue: ["locked"], disabled: true },
};

export const Empty: Story = {
  args: { defaultValue: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No items yet.")).toBeInTheDocument();
  },
};
