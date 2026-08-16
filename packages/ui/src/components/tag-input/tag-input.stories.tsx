import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useState } from "react";
import { TagInput } from "./tag-input";

const meta = {
  title: "Forms/TagInput",
  component: TagInput,
  tags: ["autodocs"],
  args: {
    placeholder: "Add tag…",
  },
  argTypes: {
    value: {
      description: "Controlled tag list.",
      control: false,
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial tag list.",
      control: false,
      table: { category: "State" },
    },
    max: {
      description: "Maximum number of tags allowed.",
      control: "number",
      table: { category: "Behavior" },
    },
    allowDuplicates: {
      description: "Allow adding the same tag more than once.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    placeholder: {
      description: "Placeholder text for the entry field.",
      control: "text",
      table: { category: "Content" },
    },
    disabled: {
      description: "Disables the input.",
      control: "boolean",
      table: { category: "State" },
    },
    delimiter: {
      description: "Characters that trigger tag creation in addition to Enter (default `[',']`).",
      control: false,
      table: { category: "Behavior" },
    },
    validate: {
      description: "Function to validate a candidate tag before adding.",
      control: false,
      table: { category: "Behavior" },
    },
    onValueChange: {
      description: "Called when the tag list changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof TagInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: ["react", "typescript"] },
  // Types a new tag and presses Enter; confirms the badge appears.
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("textbox");
    await userEvent.click(input);
    await userEvent.type(input, "storybook");
    await userEvent.keyboard("{Enter}");
    const badge = await canvas.findByText("storybook");
    await expect(badge).toBeInTheDocument();
  },
};

export const Controlled: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [tags, setTags] = useState(["design", "system"]);
    return (
      <div className="flex flex-col gap-2 max-w-sm">
        <TagInput value={tags} onValueChange={setTags} placeholder="Add tag…" />
        <p className="text-body text-muted-foreground">Tags: {tags.join(", ") || "none"}</p>
      </div>
    );
  },
};

export const WithMax: Story = {
  args: { defaultValue: ["one", "two"], max: 3, placeholder: "Max 3 tags…" },
};

export const WithValidation: Story = {
  args: {
    defaultValue: [],
    placeholder: "Only lowercase letters…",
    validate: (tag) => {
      if (!/^[a-z]+$/.test(tag)) return "Only lowercase letters allowed.";
      return true;
    },
  },
};

export const AllowDuplicates: Story = {
  args: { defaultValue: ["foo"], allowDuplicates: true, placeholder: "Duplicates OK…" },
};

export const Disabled: Story = {
  args: { defaultValue: ["locked"], disabled: true },
};

export const Empty: Story = {
  args: { placeholder: "Type and press Enter or comma…" },
};
