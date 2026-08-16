import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Input } from "../input";
import { Textarea } from "../textarea";
import { FieldRow } from "./field-row";

const meta = {
  title: "Forms/FieldRow",
  component: FieldRow,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Label/description/error/aria-describedby wiring for a single field OUTSIDE a react-hook-form context. See Forms/Form for the RHF-bound equivalent.",
      },
    },
  },
  args: {
    label: "Name",
  },
  argTypes: {
    label: { control: "text", table: { category: "Content" } },
    description: { control: "text", table: { category: "Content" } },
    error: { control: "text", table: { category: "Content" } },
    children: { control: false, table: { category: "Content" } },
  },
} satisfies Meta<typeof FieldRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-72">
      <FieldRow {...args}>
        <Input placeholder="Jane Doe" />
      </FieldRow>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).toHaveAttribute("aria-invalid", "false");
  },
};

export const WithHelp: Story = {
  name: "With help",
  render: (args) => (
    <div className="w-72">
      <FieldRow {...args} description="As it appears on your ID.">
        <Input placeholder="Jane Doe" />
      </FieldRow>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(canvas.getByText("As it appears on your ID.").id).toBe(describedBy);
  },
};

export const WithError: Story = {
  name: "With error",
  render: (args) => (
    <div className="w-72">
      <FieldRow {...args} error="Name is required.">
        <Input placeholder="Jane Doe" />
      </FieldRow>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const alert = canvas.getByRole("alert");
    expect(alert).toHaveTextContent("Name is required.");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
  },
};

export const WithBoth: Story = {
  name: "With help and error",
  render: (args) => (
    <div className="w-72">
      <FieldRow {...args} description="As it appears on your ID." error="Name is required.">
        <Input placeholder="Jane Doe" />
      </FieldRow>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    const ids = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(ids).toHaveLength(2);
    expect(canvas.getByText("As it appears on your ID.").id).toBe(ids[0]);
    expect(canvas.getByRole("alert").id).toBe(ids[1]);
  },
};

/** Composes with a Textarea just as readily as an Input — any single-element control works. */
export const WithTextarea: Story = {
  name: "With a Textarea control",
  render: (args) => (
    <div className="w-72">
      <FieldRow {...args} label="Bio" description="A short introduction.">
        <Textarea placeholder="Tell us about yourself…" />
      </FieldRow>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Bio"));
    expect(canvas.getByRole("textbox")).toHaveFocus();
  },
};
