import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Combobox } from "./combobox";
const meta = {
  title: "Forms/Combobox",
  component: Combobox,
  tags: ["autodocs"],
  argTypes: {
    options: {
      description: "Array of `{ label, value }` options.",
      control: false,
      table: { category: "Content" },
    },
    value: {
      description: "Controlled selected value.",
      control: "text",
      table: { category: "State" },
    },
    placeholder: {
      description: "Text shown in the trigger when no option is selected.",
      control: "text",
      table: { category: "Content" },
    },
    searchPlaceholder: {
      description: "Placeholder inside the search input.",
      control: "text",
      table: { category: "Content" },
    },
    emptyText: {
      description: "Message shown when the search yields no results.",
      control: "text",
      table: { category: "Content" },
    },
    onValueChange: {
      description: "Called when the selected value changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the trigger button.",
      control: "text",
      table: { category: "Appearance" },
    },
    disabled: {
      description: "Disables the trigger and prevents the popover from opening.",
      control: "boolean",
      table: { category: "State" },
    },
    allowCustomValue: {
      description:
        "When true, typed text not present in options becomes a submittable value (#359).",
      control: "boolean",
      table: { category: "Behavior" },
    },
  },
} satisfies Meta<typeof Combobox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  args: {
    options: [
      { label: "Production", value: "prod" },
      { label: "Staging", value: "staging" },
      { label: "Development", value: "dev" },
    ],
    placeholder: "Select environment…",
  },
  // Opens the popover, confirms options appear, then picks "Staging".
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("combobox");
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const option = await body.findByRole("option", { name: "Staging" });
    await expect(option).toBeInTheDocument();
    await userEvent.click(option);
    await expect(trigger).toHaveTextContent("Staging");
  },
};

const ENVIRONMENTS = [
  { label: "Production", value: "prod" },
  { label: "Staging", value: "staging" },
  { label: "Development", value: "dev" },
];

/** Enabled vs disabled, side by side (#343). */
export const DisabledState: Story = {
  name: "Disabled",
  render: () => (
    <div className="flex items-center gap-4">
      <Combobox
        aria-label="Environment (enabled)"
        options={ENVIRONMENTS}
        placeholder="Select environment…"
      />
      <Combobox
        aria-label="Environment (disabled)"
        options={ENVIRONMENTS}
        placeholder="Select environment…"
        disabled
      />
    </div>
  ),
  // The disabled trigger is a real native `disabled` button — a genuine
  // pointer click can't even land on it (`pointer-events: none`, asserted by
  // the browser itself), so there's nothing to open.
  play: async ({ canvas }) => {
    const [, disabledTrigger] = canvas.getAllByRole("combobox");
    await expect(disabledTrigger).toBeDisabled();
    await expect(canvas.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
  },
};

/**
 * `aria-label` names the control's PURPOSE ("Session switcher"), independent
 * of the selected value's own text (#347).
 */
export const AccessibleName: Story = {
  args: {
    options: ENVIRONMENTS,
    value: "prod",
    "aria-label": "Environment switcher",
  },
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("combobox", { name: "Environment switcher" });
    await expect(trigger).toHaveTextContent("Production");
  },
};

/**
 * `allowCustomValue` accepts free text alongside the suggested options — a
 * value not in `options` is offered via a "Use…" suggestion, still filtered
 * live as the user types (#359).
 */
export const AllowCustomValue: Story = {
  name: "Allow custom value",
  args: {
    options: ENVIRONMENTS,
    allowCustomValue: true,
    placeholder: "Select or type an environment…",
    "aria-label": "Environment (custom value allowed)",
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("combobox");
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const input = await body.findByPlaceholderText("Search…");
    await userEvent.type(input, "Canary");
    const customItem = await body.findByRole("option", { name: /use.*canary/i });
    await expect(customItem).toBeInTheDocument();
    await userEvent.click(customItem);
    await expect(trigger).toHaveTextContent("Canary");
  },
};
