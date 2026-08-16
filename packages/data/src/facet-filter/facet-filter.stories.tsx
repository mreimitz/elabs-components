import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import {
  Button,
  DatePicker,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@elabs/components-ui";
import { FacetFilter } from "./facet-filter";

const options = [
  { label: "Healthy", value: "healthy" },
  { label: "Degraded", value: "degraded" },
  { label: "Down", value: "down" },
];

const meta = {
  title: "Data/FacetFilter",
  component: FacetFilter,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Multi-select faceted filter rendered as a dropdown of toggles. Controlled — it emits " +
          "the next selection and never holds its own state, so the app (or a DataTable " +
          "`columnFilters` slice) stays the single source of truth.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FacetFilter>;
export default meta;
type Story = StoryObj<typeof meta>;

function Controlled({ initial = [] as string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  return (
    <FacetFilter
      title="Status"
      options={options}
      selected={selected}
      onSelectedChange={setSelected}
    />
  );
}

export const Default: Story = {
  args: { title: "Status", options, selected: [], onSelectedChange: () => {} },
  render: () => <Controlled />,
};

/** With a selection the trigger carries a count badge and the menu gains "Clear filters". */
export const WithSelection: Story = {
  args: { title: "Status", options, selected: ["degraded"], onSelectedChange: () => {} },
  render: () => <Controlled initial={["degraded", "down"]} />,
};

/**
 * #346 — the filter row a `FacetFilter` actually lives in. Its trigger used to
 * take `Button size="sm"` (`h-8`) while every sibling control lands on `h-9`
 * (`Select`'s default rung, `Input`'s hardcoded height, `DatePicker` and a plain
 * `Button` via `Button`'s own default), so the row's top and bottom edges didn't
 * line up. The trigger now inherits that same default.
 *
 * The play function is the acceptance test: it MEASURES every control's rendered
 * box in a real browser (`getBoundingClientRect`) and asserts one height and one
 * top edge across all five. A class-list assertion would only restate the source.
 */
export const ToolbarAlignment: Story = {
  args: { title: "Status", options, selected: [], onSelectedChange: () => {} },
  parameters: {
    docs: {
      description: {
        story:
          "FacetFilter beside Select, DatePicker, Input and Button — all five controls resolve " +
          "to the same height and baseline (#346).",
      },
    },
  },
  render: () => (
    <div data-testid="filter-row" className="flex flex-wrap items-center gap-2">
      <Controlled initial={["degraded"]} />
      <Select defaultValue="prod">
        <SelectTrigger className="w-36" aria-label="Environment">
          <SelectValue placeholder="Environment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="prod">Production</SelectItem>
          <SelectItem value="staging">Staging</SelectItem>
        </SelectContent>
      </Select>
      <DatePicker placeholder="Pick a date" />
      <Input className="w-40" aria-label="Search services" placeholder="e.g. billing…" />
      <Button variant="outline">Reset</Button>
    </div>
  ),
  play: async ({ canvas }) => {
    const row = canvas.getByTestId("filter-row");
    // Direct children only: the row's five controls, in DOM order.
    const controls = Array.from(row.children) as HTMLElement[];
    await expect(controls).toHaveLength(5);

    await waitFor(() => {
      const boxes = controls.map((el) => el.getBoundingClientRect());
      // A real layout pass must have happened before the comparison means anything.
      expect(boxes[0]!.height).toBeGreaterThan(0);
      for (const box of boxes) {
        // Sub-pixel rounding tolerance; anything larger is a genuine mismatch
        // (the h-8/h-9 delta this story locks was a full 4px).
        expect(Math.abs(box.height - boxes[0]!.height)).toBeLessThan(0.5);
        expect(Math.abs(box.top - boxes[0]!.top)).toBeLessThan(0.5);
      }
    });
  },
};
