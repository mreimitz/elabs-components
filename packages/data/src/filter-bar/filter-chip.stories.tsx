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
          'count ("excluded 1,204"). Composes `@elabs-ai/components-ui`\'s `FilterChip` — the ' +
          "whole chip is a single button whose accessible name is " +
          '"Remove filter: <label>" (WCAG 2.5.3), so the count folded into `label` reaches ' +
          "the accessible name too, not only the visible text.",
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
    await expect(canvas.getByText("Status: Failed · excluded 1,204")).toBeInTheDocument();
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
    await expect(canvas.getByText("Status: Failed · 1,204")).toBeInTheDocument();
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

export const WithCountHighDecoration: Story = {
  name: "With count — high decoration",
  globals: { decoration: "10" },
  args: { count: 1204, countLabel: "excluded" },
  play: WithCount.play,
};
