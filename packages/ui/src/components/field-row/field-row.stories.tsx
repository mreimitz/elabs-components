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

// A small local email-shape check — deliberately NOT `event.target.checkValidity()`.
// Verified against real `<input type="email">` constraint validation (#26
// fix-round-1 finding 2): the native HTML5 email format does NOT require a
// dot in the domain, so `checkValidity()` treats "jane@invalid" as VALID —
// it would not reproduce the contradiction this demo exists to guard
// against. A `local-part@domain.tld` regex is the smallest check that
// actually agrees with "looks like a real email", so it can't clear the
// error for "@", "jane@" or "jane@invalid" the way the old
// `value.includes("@")` predicate did.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Stands a plain `useState`-controlled value in for "any runtime" (a bespoke
 * reducer, Formik's `meta.error`, TanStack Form's `field.state.meta.errors`,
 * …) — `FieldRow` only ever reads the `label`/`description`/`error` props it
 * is handed, so the same shape works for all of them. No `FormProvider`/RHF
 * context exists anywhere in this component's tree.
 */
function EmailField({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const error = EMAIL_RE.test(value) ? undefined : "Enter a valid email address.";

  return (
    <div className="w-72">
      <FieldRow label="Email" description="We'll only use this to send receipts." error={error}>
        <Input type="email" value={value} onChange={(event) => setValue(event.target.value)} />
      </FieldRow>
    </div>
  );
}

/**
 * Issue #26's fourth ask: a worked example of `FieldRow` driven by a form
 * runtime that is NOT react-hook-form — this is the story the docs and PR
 * point readers at as "starts already invalid so the `aria-invalid`/
 * `role="alert"` wiring is visible without interaction". Its play function
 * therefore only ASSERTS the error state; it never resolves it, so the
 * canvas a reader inspects (both in the story view and on the autodocs page,
 * where Storybook runs `play` on mount the same way) stays on the
 * documented error state. See "Driven by external state — validity
 * transitions" below for the invalid→valid interaction instead (#26
 * fix-round-1 finding 1 — the previous version of this story cleared its own
 * error inside `play`, so the state the docs claimed to show never actually
 * survived a render).
 */
export const RuntimeAgnostic: Story = {
  name: "Driven by external state (no react-hook-form)",
  render: () => <EmailField initialValue="not-an-email" />,
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const alert = canvas.getByRole("alert");
    expect(alert).toHaveTextContent("Enter a valid email address.");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(alert.id);
  },
};

/**
 * The invalid→valid half of the lifecycle, kept in its own story so the
 * documented error example above (`RuntimeAgnostic`) never settles into the
 * success state on render (#26 fix-round-1 finding 1). Also locks finding
 * 2: "jane@invalid" has an `@` but no valid domain and must NOT clear the
 * error — `value.includes("@")` used to accept it.
 */
export const RuntimeAgnosticValidation: Story = {
  name: "Driven by external state — validity transitions",
  render: () => <EmailField initialValue="not-an-email" />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");

    await userEvent.clear(input);
    await userEvent.type(input, "jane@invalid");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(canvas.getByRole("alert")).toHaveTextContent("Enter a valid email address.");

    await userEvent.clear(input);
    await userEvent.type(input, "jane@example.com");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(canvas.queryByRole("alert")).toBeNull();
  },
};
