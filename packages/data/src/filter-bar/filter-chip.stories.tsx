import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FilterChip } from "./filter-chip";

const meta = {
  title: "Data/FilterBar/FilterChip",
  component: FilterChip,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The removable active-filter chip for `FilterBar`, with an optional secondary " +
          'count ("excluded 1,204"), passed to the base `trailing` slot (#284) rather than ' +
          "folded into `label` — a long label truncates on its own, the count never loses " +
          "characters to the ellipsis. Composes `@elabs-ai/components-ui`'s `FilterChip` — the " +
          'whole chip is a single button whose accessible name is "Remove filter: <label> · ' +
          '<trailing>" (WCAG 2.5.3), so the count still reaches the accessible name, not only ' +
          "the visible text.",
      },
    },
  },
  args: {
    label: "Status: Failed",
    onRemove: fn(),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FilterChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole("button", { name: "Remove filter: Status: Failed" });
    await userEvent.click(chip);
    await expect(args.onRemove).toHaveBeenCalledTimes(1);
  },
};

/** A count with a caller-supplied label — "excluded 1,204", locale-formatted. */
export const WithCount: Story = {
  args: { count: 1204, countLabel: "excluded" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Label and count are separate elements (#284) — the count is never
    // folded into the truncatable label string.
    await expect(canvas.getByText("Status: Failed")).toBeInTheDocument();
    await expect(canvas.getByText("excluded 1,204")).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Remove filter: Status: Failed · excluded 1,204" }),
    ).toBeInTheDocument();
  },
};

/** A bare count with no `countLabel` — just the formatted number. */
export const BareCount: Story = {
  args: { count: 1204 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Status: Failed")).toBeInTheDocument();
    await expect(canvas.getByText("1,204")).toBeInTheDocument();
  },
};

/** Several chips in a run — removing one never touches its siblings. */
function MultipleChipsDemo() {
  const [chips, setChips] = useState([
    { id: "status", label: "Status: Failed", count: 1204, countLabel: "excluded" },
    { id: "region", label: "Region: EU" },
  ]);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <FilterChip
          key={chip.id}
          label={chip.label}
          count={chip.count}
          countLabel={chip.countLabel}
          onRemove={() => setChips((prev) => prev.filter((c) => c.id !== chip.id))}
        />
      ))}
    </div>
  );
}

export const MultipleChips: Story = {
  render: () => <MultipleChipsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const statusChip = canvas.getByRole("button", {
      name: "Remove filter: Status: Failed · excluded 1,204",
    });
    const regionChip = canvas.getByRole("button", { name: "Remove filter: Region: EU" });
    await userEvent.click(statusChip);
    await expect(statusChip).not.toBeInTheDocument();
    await expect(regionChip).toBeInTheDocument();
  },
};

/**
 * A label long enough to overflow a 280px container (#284). The label
 * truncates with an ellipsis; the count stays fully visible — CSS
 * `text-overflow: ellipsis` can only reach the label's own span, never the
 * count's sibling element.
 */
export const LongLabelWithCount: Story = {
  args: {
    label: "Status: Awaiting downstream reconciliation review",
    count: 1204,
    countLabel: "excluded",
  },
  decorators: [
    (Story) => (
      <div className="w-[280px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const count = await canvas.findByText("excluded 1,204");
    await expect(count).toBeInTheDocument();

    const truncating = canvasElement.querySelector('[class*="truncate"]');
    await expect(truncating).not.toBeNull();
    // The count must never be a descendant of the truncating label span.
    await expect(truncating?.contains(count)).toBe(false);

    await expect(
      canvas.getByRole("button", {
        name: "Remove filter: Status: Awaiting downstream reconciliation review · excluded 1,204",
      }),
    ).toBeInTheDocument();
  },
};

export const WithCountHighDecoration: Story = {
  name: "With count — high decoration",
  globals: { decoration: "10" },
  args: { count: 1204, countLabel: "excluded" },
  play: WithCount.play,
};
