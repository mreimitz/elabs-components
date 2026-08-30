import { useState } from "react";
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
          "Label/description/error/aria-describedby wiring for a single field OUTSIDE a react-hook-form context. See Forms/Form for the RHF-bound equivalent.\n\n**Runtime-agnostic (#26).** `FieldRow` never imports `react-hook-form` — it renders entirely from plain `label`/`description`/`error` props, so it works just as readily with a `useState`-controlled field, Formik, Final Form, TanStack Form or a bespoke reducer. See the “Driven by external state” story below for a worked, non-RHF example (including the error state). Reach for the RHF-bound `Form`/`FormField` family (Forms/Form) instead once the field already lives inside a `react-hook-form` `<FormProvider>` — `FieldRow` covers the gap outside it, it does not replace that family.",
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

/**
 * Issue #26's fourth ask: a worked example of `FieldRow` driven by a form
 * runtime that is NOT react-hook-form. `EmailField` stands a plain
 * `useState`-controlled value in for "any runtime" (a bespoke reducer,
 * Formik's `meta.error`, TanStack Form's `field.state.meta.errors`, …) —
 * `FieldRow` only ever reads the `label`/`description`/`error` props it is
 * handed, so the same shape works for all of them. No `FormProvider`/RHF
 * context exists anywhere in this story's tree. It starts already invalid so
 * the `aria-invalid`/`role="alert"` wiring is visible immediately, not only
 * on the happy path, then the play function clears the error to show both
 * ends of the lifecycle.
 */
export const RuntimeAgnostic: Story = {
  name: "Driven by external state (no react-hook-form)",
  render: () => {
    function EmailField() {
      const [value, setValue] = useState("not-an-email");
      const error = value.includes("@") ? undefined : "Enter a valid email address.";

      return (
        <FieldRow label="Email" description="We'll only use this to send receipts." error={error}>
          <Input type="email" value={value} onChange={(event) => setValue(event.target.value)} />
        </FieldRow>
      );
    }
    return (
      <div className="w-72">
        <EmailField />
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const alert = canvas.getByRole("alert");
    expect(alert).toHaveTextContent("Enter a valid email address.");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(alert.id);

    await userEvent.clear(input);
    await userEvent.type(input, "jane@example.com");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(canvas.queryByRole("alert")).toBeNull();
  },
};
