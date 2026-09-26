import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
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

/**
 * An address list: space and semicolon add too, everything is lower-cased, a tag that
 * is not an e-mail gets a flag and the `destructive` badge, and the field commits on blur.
 */
export const Addresses: Story = {
  args: {
    "aria-label": "Email addresses",
    addOnBlur: true,
    defaultValue: ["ada@acme.example", "not-an-address"],
    delimiter: [",", " ", ";"],
    inputMode: "email",
    normalize: (tag) => tag.toLowerCase(),
    placeholder: "name@company.com, another@company.com",
    renderTag: (tag) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tag) ? (
        <span className="max-w-48 truncate">{tag}</span>
      ) : (
        <>
          <AlertCircle aria-hidden="true" className="size-3.5" />
          <span className="max-w-48 truncate">{tag}</span>
          <span className="sr-only">, not an email address</span>
        </>
      ),
    tagVariant: (tag) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tag)
        ? { variant: "secondary" }
        : { variant: "destructive", appearance: "tint" },
  },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("textbox", { name: "Email addresses" });
    await userEvent.type(input, "Grace@Acme.example ");
    await expect(await canvas.findByText("grace@acme.example")).toBeInTheDocument();
    await userEvent.type(input, "linus@acme.example");
    await userEvent.tab();
    await expect(await canvas.findByText("linus@acme.example")).toBeInTheDocument();
  },
};
