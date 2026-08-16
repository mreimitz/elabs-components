import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Checkbox } from "./checkbox";
import { Label } from "../label";
const meta = {
  title: "Forms/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    checked: {
      description: 'Controlled checked state. Use `"indeterminate"` for mixed state.',
      control: { type: "select" },
      options: [true, false, "indeterminate"],
      table: { category: "State" },
    },
    defaultChecked: {
      description: "Uncontrolled initial checked state.",
      control: "boolean",
      table: { category: "State" },
    },
    disabled: {
      description: "Disables the checkbox.",
      control: "boolean",
      table: { category: "State" },
    },
    required: {
      description: "Marks the checkbox as required in a form context.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    onCheckedChange: {
      description: "Called when the checked state changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" defaultChecked />
      <Label htmlFor="terms">Accept terms</Label>
    </div>
  ),
  // Starts checked (defaultChecked); clicking toggles the reflected aria-checked state.
  play: async ({ canvas, userEvent }) => {
    const box = canvas.getByRole("checkbox");
    await expect(box).toHaveAttribute("aria-checked", "true");
    await userEvent.click(box);
    await expect(box).toHaveAttribute("aria-checked", "false");
  },
};

const CHILDREN = ["Alpha", "Beta", "Gamma"];

/**
 * A real tri-state "select all" group (#348) — the master shows
 * `indeterminate` (a dash, visually distinct from `checked`'s tick) when
 * some-but-not-all children are checked, `checked` when all are, and
 * `unchecked` when none are.
 */
function TriStateGroup() {
  const [checkedIds, setCheckedIds] = useState<string[]>([CHILDREN[0]!]);
  const allChecked = checkedIds.length === CHILDREN.length;
  const someChecked = checkedIds.length > 0 && !allChecked;
  const masterState = allChecked ? true : someChecked ? "indeterminate" : false;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id="select-all"
          checked={masterState}
          onCheckedChange={(next) => setCheckedIds(next ? [...CHILDREN] : [])}
        />
        <Label htmlFor="select-all">Select all</Label>
      </div>
      <div className="ms-6 flex flex-col gap-2">
        {CHILDREN.map((child) => (
          <div key={child} className="flex items-center gap-2">
            <Checkbox
              id={child}
              checked={checkedIds.includes(child)}
              onCheckedChange={(next) =>
                setCheckedIds((prev) =>
                  next ? [...prev, child] : prev.filter((id) => id !== child),
                )
              }
            />
            <Label htmlFor={child}>{child}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}

export const TriState: Story = {
  render: () => <TriStateGroup />,
  // One child is pre-checked, so the master starts indeterminate. Checking
  // the remaining children flips it to fully checked.
  play: async ({ canvas, userEvent }) => {
    const master = canvas.getByRole("checkbox", { name: "Select all" });
    await expect(master).toHaveAttribute("aria-checked", "mixed");
    await expect(master).toBeVisible();

    await userEvent.click(canvas.getByRole("checkbox", { name: "Beta" }));
    await userEvent.click(canvas.getByRole("checkbox", { name: "Gamma" }));
    await expect(master).toHaveAttribute("aria-checked", "true");
  },
};
