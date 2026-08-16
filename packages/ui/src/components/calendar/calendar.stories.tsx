import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Calendar } from "./calendar";
const meta = {
  title: "Forms/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  argTypes: {
    mode: {
      description: "Selection mode: single date, multiple dates, or a range.",
      control: { type: "select" },
      options: ["single", "multiple", "range"],
      table: { category: "Behavior" },
    },
    showOutsideDays: {
      description: "Show days from adjacent months in the current month grid.",
      control: "boolean",
      table: { category: "Appearance" },
    },
    numberOfMonths: {
      description: "Number of months to display side by side.",
      control: "number",
      table: { category: "Appearance" },
    },
    disabled: {
      description: "Disables specific dates (Matcher or boolean).",
      control: false,
      table: { category: "State" },
    },
    selected: {
      description: "Controlled selected date(s).",
      control: false,
      table: { category: "State" },
    },
    onSelect: {
      description: "Called when the user picks a date.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Calendar>;
export default meta;
type Story = StoryObj<typeof meta>;
// Pinned rather than `new Date()` (#430): the selected day's cell paints
// `--primary-foreground` on `--primary` (light), a real, accepted AA
// miss (4.31:1 vs a 4.5:1 floor — #180, `INK_EXEMPT` in
// `packages/tokens/src/themes-contrast.test.ts`). axe-core's `color-contrast`
// rule reports single-CHARACTER text as `incomplete`/`shortTextContent`
// instead of scoring it, so with `new Date()` this story was red on days
// 10-31 of the month and silently green on days 1-9 — a verification result
// keyed to the wall clock, not to the code. The pinned day MUST stay in the
// 10-31 range: a single-digit pin would make the suite green forever, but
// only by routing the cell into that same unscoreable-text path, which hides
// the miss rather than fixing or honestly exempting it (see `Test to add` in
// #430 and `scripts/a11y-baseline.json`, which now carries this story's
// entry). `defaultMonth` is pinned alongside it so the displayed month is
// never a function of "now" either.
//
// The `today` cell (react-day-picker's `today` modifier) still tracks the
// real wall clock and is NOT pinned — only the `selected` cell is. That is
// safe for this lock: the `today` plate (`bg-accent`/`text-accent-foreground`)
// is a different, contrast-clean token pair (confirmed by probing it directly
// with axe, `runOnly: ["color-contrast"]`, on a two-digit "today" — zero
// violations), so it cannot flip this story's axe outcome on any date.
const FIXED_MONTH = new Date(2026, 7, 1); // 2026-08-01
const FIXED_SELECTED = new Date(2026, 7, 17); // 2026-08-17 — two digits, on purpose

export const Default: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [date, setDate] = useState<Date | undefined>(FIXED_SELECTED);
    return (
      <Calendar
        mode="single"
        defaultMonth={FIXED_MONTH}
        selected={date}
        onSelect={setDate}
        className="rounded-md border"
      />
    );
  },
  // Confirms the calendar grid renders and a day cell is present.
  play: async ({ canvas }) => {
    const grid = canvas.getByRole("grid");
    await expect(grid).toBeInTheDocument();
    const dayCells = canvas.getAllByRole("gridcell");
    await expect(dayCells.length).toBeGreaterThan(0);
  },
};
