import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  ThemeFamilySwitch,
  type ThemeFamilySwitchFamily,
  type ThemeFamilySwitchMode,
  type ThemeFamilySwitchProps,
} from "./theme-family-switch";

/** Sample chips painted from tokens; a real host passes each family's resolved colours. */
const families: ThemeFamilySwitchFamily[] = [
  {
    id: "default",
    label: "Default",
    swatch: { background: "var(--background)", primary: "var(--primary)" },
  },
  {
    id: "ocean",
    label: "Ocean",
    swatch: { background: "var(--muted)", primary: "var(--chart-1)" },
  },
  {
    id: "graphite",
    label: "Graphite",
    swatch: { background: "var(--card)", primary: "var(--chart-2)" },
  },
  {
    id: "qlik",
    label: "Qlik",
    swatch: { background: "var(--background)", primary: "var(--chart-3)" },
  },
  { id: "heap", label: "Heap", swatch: { background: "var(--muted)", primary: "var(--chart-4)" } },
];

function Controlled(props: Partial<ThemeFamilySwitchProps>) {
  const [value, setValue] = useState(props.value ?? "default");
  const [mode, setMode] = useState<ThemeFamilySwitchMode>(props.mode ?? "light");
  return (
    <ThemeFamilySwitch
      families={families}
      {...props}
      value={value}
      onChange={(id) => {
        setValue(id);
        props.onChange?.(id);
      }}
      mode={mode}
      onModeChange={(next) => {
        setMode(next);
        props.onModeChange?.(next);
      }}
    />
  );
}

const meta = {
  title: "Marketing/ThemeFamilySwitch",
  component: ThemeFamilySwitch,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { families, value: "default", onChange: fn(), mode: "light", onModeChange: fn() },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ThemeFamilySwitch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: "sm" } };

export const Large: Story = { args: { size: "lg" } };

/** Without `onModeChange` the switch shows the family row only. */
export const FamiliesOnly: Story = {
  args: { onModeChange: undefined, mode: undefined },
  render: (args) => <ThemeFamilySwitch {...args} />,
};

/** Tab enters the row on the selected chip, arrows move focus without applying, Enter applies. */
export const KeyboardInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const current = canvas.getByRole("radio", { name: "Default" });
    await expect(current).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    const ocean = canvas.getByRole("radio", { name: "Ocean" });
    await expect(ocean).toHaveFocus();
    await expect(args.onChange).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await expect(args.onChange).toHaveBeenCalledWith("ocean");
    await expect(ocean).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{ArrowRight}{ }");
    await expect(args.onChange).toHaveBeenLastCalledWith("graphite");
  },
};
