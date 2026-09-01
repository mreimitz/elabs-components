import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Input } from "../input";
import { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError } from "./field";

const meta = {
  title: "Forms/Field",
  component: FieldRoot,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A compound field anatomy — `FieldRoot` + `FieldLabel`/`FieldControl`/`FieldDescription`/`FieldError` — for callers who need to COMPOSE a field layout `FieldRow` (Forms/FieldRow) can't express: more than one control in one row, or a description placed before the control. Every part reads shared context (`FieldRoot` owns id generation and `aria-describedby` composition), so they can be arranged in any order/layout. `FieldRow` remains the convenience wrapper for the common single-control case and is unaffected (#43).",
      },
    },
  },
} satisfies Meta<typeof FieldRoot>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-72">
      <FieldRoot>
        <FieldLabel>Name</FieldLabel>
        <FieldControl>
          <Input placeholder="Jane Doe" />
        </FieldControl>
      </FieldRoot>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(canvas.getByText("Name")).toHaveAttribute("for", input.id);
  },
};

export const WithDescriptionAndError: Story = {
  name: "With description and error",
  render: () => (
    <div className="w-72">
      <FieldRoot invalid required>
        <FieldLabel>API key</FieldLabel>
        <FieldControl>
          <Input placeholder="sk-…" />
        </FieldControl>
        <FieldDescription>Found in your account settings.</FieldDescription>
        <FieldError>Enter a valid API key.</FieldError>
      </FieldRoot>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    const describedBy = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(describedBy).toHaveLength(2);
    expect(canvas.getByText("Found in your account settings.").id).toBe(describedBy[0]);
    const alert = canvas.getByRole("alert");
    expect(alert).toHaveTextContent("Enter a valid API key.");
    expect(alert.id).toBe(describedBy[1]);
  },
};

/**
 * #43's first motivating case: `FieldRow`'s `children: ReactElement` can only
 * ever wrap ONE control, so a first/last-name row (or a control plus an
 * inline unit suffix) can't be expressed. Here two `FieldControl`s share one
 * `FieldRoot` — each gets its own independent `id` (given explicitly, the
 * same way any two form controls would need distinct ids) while both read
 * the SAME `invalid`/`aria-describedby` wiring from context. `FieldLabel`'s
 * `htmlFor` can only point to ONE control (the first), so each `Input` also
 * carries its own `aria-label` — a shared visual label plus a placeholder is
 * not enough of an accessible name for the second control (axe:
 * `label-title-only`).
 */
export const TwoControlsInOneRow: Story = {
  name: "Two controls in one row",
  render: () => (
    <div className="w-96">
      <FieldRoot invalid>
        <FieldLabel>Name</FieldLabel>
        <div className="flex gap-2">
          <FieldControl>
            <Input id="first-name" aria-label="First name" placeholder="First name" />
          </FieldControl>
          <FieldControl>
            <Input id="last-name" aria-label="Last name" placeholder="Last name" />
          </FieldControl>
        </div>
        <FieldError>Both first and last name are required.</FieldError>
      </FieldRoot>
    </div>
  ),
  play: async ({ canvas }) => {
    const first = canvas.getByPlaceholderText("First name");
    const last = canvas.getByPlaceholderText("Last name");
    expect(first.id).toBe("first-name");
    expect(last.id).toBe("last-name");
    expect(first.id).not.toBe(last.id);

    const alert = canvas.getByRole("alert");
    expect(first).toHaveAttribute("aria-invalid", "true");
    expect(last).toHaveAttribute("aria-invalid", "true");
    expect(first.getAttribute("aria-describedby")).toBe(alert.id);
    expect(last.getAttribute("aria-describedby")).toBe(alert.id);
  },
};

/**
 * #43's second motivating case: `FieldRow` always renders description AFTER
 * the control. Here `FieldDescription` is placed BEFORE `FieldControl` in
 * JSX — the visible order follows the JSX order, but `aria-describedby`
 * wiring is unaffected either way (`FieldRoot` composes it from context, not
 * DOM position).
 */
export const DescriptionBeforeControl: Story = {
  name: "Description between label and control",
  render: () => (
    <div className="w-72">
      <FieldRoot>
        <FieldLabel>Bio</FieldLabel>
        <FieldDescription>Shown on your public profile.</FieldDescription>
        <FieldControl>
          <Input placeholder="Tell us about yourself…" />
        </FieldControl>
      </FieldRoot>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    const description = canvas.getByText("Shown on your public profile.");
    expect(input.getAttribute("aria-describedby")).toBe(description.id);
    // The description renders before the control in the DOM, matching JSX order.
    expect(
      description.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  },
};
