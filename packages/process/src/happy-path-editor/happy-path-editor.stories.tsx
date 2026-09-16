import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { HappyPath } from "../core/reference-model";
import { HappyPathEditor, type HappyPathEditorProps } from "./happy-path-editor";

const orderPath: HappyPath = {
  id: "order",
  label: "Order to cash",
  steps: [{ activity: "Register" }, { activity: "Approve" }, { activity: "Pay" }],
};
const available = ["Register", "Check credit", "Approve", "Pay", "Escalate"];

/** Owns the path the way an app would, so every edit is visible on the canvas. */
function Stateful({ value: initial, onChange, ...props }: HappyPathEditorProps) {
  const [value, setValue] = useState(initial);
  return (
    <HappyPathEditor
      {...props}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

const meta = {
  title: "Process/HappyPathEditor",
  component: HappyPathEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Edits the reference model token replay checks a log against. Steps are `FlowNode`s " +
          "on a `CanvasShell`; the `FlowButtonEdge` between two steps inserts one, the tail " +
          "placeholder appends one, and each step toggles `optional` and `repeatable`. Every " +
          "edit fires `onChange` with a complete `HappyPath` — the editor holds no copy.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[48rem] w-full bg-background">
        <Story />
      </div>
    ),
  ],
  args: { value: orderPath, onChange: fn(), availableActivities: available },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof HappyPathEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Insert on an edge, then mark the new step repeatable. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const insert = await canvas.findByRole(
      "button",
      { name: "Insert a step between Register and Approve" },
      { timeout: 5000 },
    );
    await userEvent.click(insert);
    await expect(args.onChange).toHaveBeenLastCalledWith({
      ...orderPath,
      steps: [
        { activity: "Register" },
        { activity: "Check credit" },
        { activity: "Approve" },
        { activity: "Pay" },
      ],
    });

    const repeatable = await canvas.findByRole("switch", { name: "Repeatable — Check credit" });
    await userEvent.click(repeatable);
    await waitFor(() => expect(repeatable).toBeChecked());
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        steps: [
          { activity: "Register" },
          { activity: "Check credit", repeatable: true },
          { activity: "Approve" },
          { activity: "Pay" },
        ],
      }),
    );
  },
};

/** Free-text activity names when the app has no activity list to offer. */
export const FreeText: Story = {
  args: { availableActivities: undefined },
};

/** A new path: only the placeholder that adds the first step. */
export const Empty: Story = {
  args: { value: { id: "new", label: "New path", steps: [] } },
  play: async ({ canvasElement, args }) => {
    const add = await within(canvasElement).findByRole(
      "button",
      { name: "Add step" },
      { timeout: 5000 },
    );
    await userEvent.click(add);
    await expect(args.onChange).toHaveBeenLastCalledWith({
      id: "new",
      label: "New path",
      steps: [{ activity: "Register" }],
    });
  },
};
