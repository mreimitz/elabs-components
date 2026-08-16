import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { VirtualSelect } from "./virtual-select";
import type { VirtualSelectOption } from "./virtual-select";

// ---------------------------------------------------------------------------
// Shared option sets
// ---------------------------------------------------------------------------

const SMALL_OPTIONS: VirtualSelectOption[] = [
  { label: "Design", value: "design" },
  { label: "Engineering", value: "engineering" },
  { label: "Product", value: "product" },
  { label: "Marketing", value: "marketing" },
  { label: "Sales", value: "sales" },
  { label: "Finance", value: "finance" },
  { label: "Legal", value: "legal" },
  { label: "HR", value: "hr" },
  { label: "Operations", value: "operations" },
  { label: "Support", value: "support" },
  { label: "Analytics", value: "analytics" },
  { label: "Infrastructure", value: "infrastructure" },
  { label: "Security", value: "security" },
  { label: "Data Science", value: "data-science" },
  { label: "Research", value: "research" },
  { label: "QA", value: "qa" },
  { label: "DevRel", value: "devrel" },
  { label: "Growth", value: "growth" },
  { label: "Platform", value: "platform" },
  { label: "Core Services", value: "core-services" },
];

/** Generate 10,000 options — the perf acceptance story. */
const LARGE_OPTIONS: VirtualSelectOption[] = Array.from({ length: 10_000 }, (_, i) => ({
  label: `Option ${i + 1} — ${["Alpha", "Beta", "Gamma", "Delta", "Epsilon"][i % 5]} Group`,
  value: `opt-${i + 1}`,
}));

const OPTIONS_WITH_DISABLED: VirtualSelectOption[] = SMALL_OPTIONS.map((o, i) => ({
  ...o,
  disabled: i === 2 || i === 7, // "Product" and "HR" are disabled
}));

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Forms/VirtualSelect",
  component: VirtualSelect,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A combobox backed by `@tanstack/react-virtual` that renders only the visible window of options. Handles 10,000+ items without DOM bloat. Single or multiple selection; keyboard-navigable via `aria-activedescendant` while focus stays on the search input.",
      },
    },
  },
  argTypes: {
    options: {
      description:
        "Full option list `{ label, value, disabled? }[]`. Only visible rows are in the DOM.",
      control: false,
      table: { category: "Content" },
    },
    multiple: {
      description: "Allow selecting multiple values.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    value: {
      description: "Controlled value — `string` (single) or `string[]` (multiple).",
      control: false,
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial value.",
      control: false,
      table: { category: "State" },
    },
    placeholder: {
      description: "Trigger placeholder when nothing is selected.",
      control: "text",
      table: { category: "Content" },
    },
    searchPlaceholder: {
      description: "Search-input placeholder.",
      control: "text",
      table: { category: "Content" },
    },
    emptyText: {
      description: "Message shown when no options match the query.",
      control: "text",
      table: { category: "Content" },
    },
    estimateOptionHeight: {
      description: "Estimated row height in px used by the virtualizer (default 32).",
      control: "number",
      table: { category: "Behavior" },
    },
    maxListHeight: {
      description: "CSS max-height for the scrollable listbox (default `18rem`).",
      control: "text",
      table: { category: "Appearance" },
    },
    onValueChange: {
      description: "Called when the selection changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the trigger button.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof VirtualSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Basic single-select with ~20 options. */
export const Default: Story = {
  args: {
    options: SMALL_OPTIONS,
    placeholder: "Select a department…",
  },
  // Regression lock: the virtualizer must measure once the Popover mounts the
  // listbox, so opening the trigger renders options (not an empty listbox).
  // Guards the state-backed-scroll-element fix; jsdom unit tests can't open the
  // Radix portal, so this runs in the browser via test-storybook.
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("combobox"));
    const options = await within(document.body).findAllByRole("option");
    await expect(options.length).toBeGreaterThan(0);
  },
};

/**
 * 10,000 generated options — the performance acceptance story.
 * Acceptance criterion: the list opens instantly, scrolling is smooth (no jank),
 * and the trigger + search filter still respond in < 16 ms.
 * (Smooth scroll is not measurable in jsdom; verify visually in the browser.)
 */
export const LargeDataset: Story = {
  args: {
    options: LARGE_OPTIONS,
    placeholder: "Select from 10,000 options…",
    searchPlaceholder: "Filter 10,000 options…",
  },
};

/** Multiple selection — controlled with chips and overflow badge. */
export const Multiple: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState<string[]>(["design", "engineering"]);
    return (
      <VirtualSelect
        options={SMALL_OPTIONS}
        multiple
        value={value}
        onValueChange={(v) => setValue(v as string[])}
        placeholder="Select departments…"
      />
    );
  },
};

/** Single-select with a pre-selected value via `defaultValue`. */
export const Preselected: Story = {
  args: {
    options: SMALL_OPTIONS,
    defaultValue: "product",
    placeholder: "Select a department…",
  },
};

/** Two options are disabled; they can be seen but not selected or focused. */
export const DisabledOptions: Story = {
  args: {
    options: OPTIONS_WITH_DISABLED,
    placeholder: "Select a department…",
  },
};

/**
 * Filtering to an empty result — the empty state renders `emptyText`.
 * Type something like "zzz" in the search box to trigger it.
 */
export const Empty: Story = {
  args: {
    options: SMALL_OPTIONS,
    placeholder: "Select a department…",
    emptyText: "No departments match your search.",
  },
};
