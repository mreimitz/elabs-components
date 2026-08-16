import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useState } from "react";
import { KeyValueEditor, type KeyValueRow } from "./key-value-editor";

const meta = {
  title: "Forms/KeyValueEditor",
  component: KeyValueEditor,
  tags: ["autodocs"],
  args: {
    keyPlaceholder: "KEY…",
    valuePlaceholder: "value…",
  },
  argTypes: {
    value: {
      description: "Controlled, ordered rows.",
      control: false,
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial rows.",
      control: false,
      table: { category: "State" },
    },
    keyPlaceholder: {
      description: "Placeholder for each row's key field.",
      control: "text",
      table: { category: "Content" },
    },
    valuePlaceholder: {
      description: "Placeholder for each row's value field.",
      control: "text",
      table: { category: "Content" },
    },
    addLabel: {
      description: 'Label for the "add row" control.',
      control: "text",
      table: { category: "Content" },
    },
    disabled: {
      description: "Disables the whole editor.",
      control: "boolean",
      table: { category: "State" },
    },
    onValueChange: {
      description: "Called when the rows change.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof KeyValueEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: [
      { key: "REGION", value: "us-east-1" },
      { key: "LOG_LEVEL", value: "debug" },
    ],
  },
};

/** A secret row renders masked with a reveal toggle; its value is never exposed while masked. */
export const WithSecret: Story = {
  args: {
    defaultValue: [
      { key: "REGION", value: "us-east-1" },
      { key: "API_KEY", value: "sk-live-51H8x9K", secret: true },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    const valueInput = canvas.getByLabelText("Value 2");
    await expect(valueInput).toHaveAttribute("type", "password");

    const revealBtn = canvas.getByRole("button", { name: /reveal value 2/i });
    await userEvent.click(revealBtn);
    await expect(valueInput).toHaveAttribute("type", "text");
    await expect(valueInput).toHaveValue("sk-live-51H8x9K");

    await userEvent.click(canvas.getByRole("button", { name: /hide value 2/i }));
    await expect(valueInput).toHaveAttribute("type", "password");
  },
};

export const Controlled: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [rows, setRows] = useState<KeyValueRow[]>([{ key: "TOKEN", value: "", secret: true }]);
    return (
      <div className="flex flex-col gap-2 max-w-md">
        <KeyValueEditor value={rows} onValueChange={setRows} />
        <p className="text-body text-muted-foreground">{rows.length} row(s)</p>
      </div>
    );
  },
};

/** Add a row, edit its key/value, and remove it — all via the composed primitives. */
export const AddEditRemove: Story = {
  args: { defaultValue: [] },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /add row/i }));
    const keyInput = canvas.getByLabelText("Key 1");
    const valueInput = canvas.getByLabelText("Value 1");
    await userEvent.type(keyInput, "REGION");
    await userEvent.type(valueInput, "eu-west-1");
    await expect(keyInput).toHaveValue("REGION");
    await expect(valueInput).toHaveValue("eu-west-1");

    await userEvent.click(canvas.getByRole("button", { name: /remove row 1/i }));
    await expect(canvas.queryByLabelText("Key 1")).not.toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: { defaultValue: [{ key: "LOCKED", value: "true" }], disabled: true },
};

export const Empty: Story = {
  args: { defaultValue: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No entries yet.")).toBeInTheDocument();
  },
};
