import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Transfer } from "./transfer";
import type { TransferItem } from "./transfer";

const PEOPLE: TransferItem[] = [
  { value: "alice", label: "Alice Okafor" },
  { value: "bob", label: "Bob Chen" },
  { value: "carol", label: "Carol Singh" },
  { value: "david", label: "David Müller" },
  { value: "eve", label: "Eve Nakamura" },
  { value: "frank", label: "Frank Johansson" },
  { value: "grace", label: "Grace Andersen" },
  { value: "hana", label: "Hana Petrov" },
];

const PERMISSIONS: TransferItem[] = [
  { value: "read", label: "Read" },
  { value: "write", label: "Write" },
  { value: "delete", label: "Delete", disabled: true },
  { value: "admin", label: "Admin", disabled: true },
  { value: "export", label: "Export" },
  { value: "import", label: "Import" },
];

const meta = {
  title: "Forms/Transfer",
  component: Transfer,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    dataSource: PEOPLE,
    defaultTargetKeys: ["carol", "eve"],
    titles: ["Available", "Selected"],
  },
  argTypes: {
    dataSource: {
      description: "Full item list `{ value, label, disabled? }[]`.",
      control: false,
      table: { category: "Content" },
    },
    targetKeys: {
      description: "Controlled list of values in the right (target) panel.",
      control: false,
      table: { category: "State" },
    },
    defaultTargetKeys: {
      description: "Uncontrolled initial target keys.",
      control: false,
      table: { category: "State" },
    },
    showSearch: {
      description: "Show per-panel search inputs.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    titles: {
      description: "Panel title labels `[sourceTitle, targetTitle]`.",
      control: false,
      table: { category: "Content" },
    },
    renderItem: {
      description: "Custom row renderer for each item.",
      control: false,
      table: { category: "Content" },
    },
    onChange: {
      description: "Called when the target key list changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Transfer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default uncontrolled transfer with pre-selected items. */
export const Default: Story = {
  // Checks "Alice Okafor" in the source panel, then moves her to the target.
  // Transfer's whole purpose is that Alice APPEARS in the target list after the
  // move — so the "no longer present" assertion must be scoped to the SOURCE
  // panel (a `role="region"` labelled by its title), not the whole canvas.
  play: async ({ canvas, userEvent }) => {
    const sourcePanel = within(canvas.getByRole("region", { name: /available/i }));
    const aliceCheckbox = sourcePanel.getByRole("checkbox", { name: /alice okafor/i });
    await userEvent.click(aliceCheckbox);
    await expect(aliceCheckbox).toBeChecked();
    const moveRightBtn = canvas.getByRole("button", { name: /move selected right/i });
    await expect(moveRightBtn).not.toBeDisabled();
    await userEvent.click(moveRightBtn);
    // Alice should no longer be in the SOURCE panel...
    await expect(sourcePanel.queryByRole("checkbox", { name: /alice okafor/i })).toBeNull();
    // ...but should now appear in the TARGET panel.
    const targetPanel = within(canvas.getByRole("region", { name: /selected/i }));
    await expect(targetPanel.getByRole("checkbox", { name: /alice okafor/i })).toBeInTheDocument();
  },
};

/** With per-panel search inputs. */
export const WithSearch: Story = {
  args: {
    showSearch: true,
    dataSource: PEOPLE,
    defaultTargetKeys: ["alice", "bob"],
  },
};

/** Controlled — parent owns the target key list. */
export const Controlled: Story = {
  render: () => {
    function ControlledExample() {
      const [targetKeys, setTargetKeys] = useState(["read", "export"]);
      return (
        <div className="flex flex-col gap-4">
          <Transfer
            dataSource={PERMISSIONS}
            targetKeys={targetKeys}
            onChange={setTargetKeys}
            titles={["Available permissions", "Granted permissions"]}
          />
          <p className="text-body text-muted-foreground">
            Granted: {targetKeys.join(", ") || "(none)"}
          </p>
        </div>
      );
    }
    return <ControlledExample />;
  },
};

/** Some items are disabled and cannot be moved. */
export const DisabledItems: Story = {
  args: {
    dataSource: PERMISSIONS,
    defaultTargetKeys: ["read"],
    titles: ["Available permissions", "Granted permissions"],
  },
};

/** Empty dataSource — both panels show the empty state. */
export const Empty: Story = {
  args: {
    dataSource: [],
    defaultTargetKeys: [],
  },
};

/** Custom panel titles. */
export const CustomTitles: Story = {
  args: {
    titles: ["Team members", "Reviewers"],
    dataSource: PEOPLE,
    defaultTargetKeys: ["grace", "hana"],
  },
};
