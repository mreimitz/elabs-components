import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useState } from "react";
import { KeyboardShortcuts, type ShortcutGroup } from "./keyboard-shortcuts";

const groups: ShortcutGroup[] = [
  {
    id: "navigation",
    label: "Navigation",
    defaultOpen: true,
    items: [
      { action: "Open command palette", keys: ["⌘", "K"] },
      { action: "Go to file", keys: ["⌘", "P"] },
      { action: "Go to line", keys: ["⌘", "G"] },
    ],
  },
  {
    id: "general",
    label: "General",
    items: [
      { action: "Close tab", keys: ["⌘", "W"] },
      { action: "Save", keys: ["⌘", "S"] },
      { action: "New window", keys: ["⌘", "⇧", "N"] },
    ],
  },
  {
    id: "editing",
    label: "Editing",
    items: [
      { action: "Duplicate line", keys: ["⌘", "⇧", "D"] },
      { action: "Comment line", keys: ["⌘", "/"] },
    ],
  },
];

const meta = {
  title: "Disclosure/KeyboardShortcuts",
  component: KeyboardShortcuts,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A grouped, searchable presentation of a shortcut set. Renders content only — " +
          "the app supplies the Dialog/Sheet shell, so the same component works in a modal, " +
          "a settings page or a sidebar. Group counts are always derived from `items.length` " +
          "(or the number of matching items while filtering), never passed in.",
      },
    },
  },
  argTypes: {
    groups: {
      description:
        "Shortcut groups (`ShortcutGroup[]`). Each group's displayed count is derived from `items.length`.",
      control: false,
      table: { category: "Content" },
    },
    searchable: {
      description: "Show the built-in search field.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    query: {
      description: "Controlled search query, if the app owns it.",
      control: "text",
      table: { category: "State" },
    },
    onQueryChange: {
      description: "Callback fired when the search query changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
  args: {
    groups,
  },
} satisfies Meta<typeof KeyboardShortcuts>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    groups,
  },
  render: (args) => (
    <div className="w-96">
      <KeyboardShortcuts {...args} />
    </div>
  ),
};

/** Typing a query hides non-matching groups and re-derives the visible group's count. */
export const Filtered: Story = {
  args: {
    groups,
  },
  render: (args) => (
    <div className="w-96">
      <KeyboardShortcuts {...args} query="close" />
    </div>
  ),
  play: async ({ canvas }) => {
    // Only "General" contains a "Close tab" action — the other two groups hide entirely.
    await expect(canvas.getByText("General")).toBeInTheDocument();
    await expect(canvas.queryByText("Navigation")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Editing")).not.toBeInTheDocument();
    // The visible group's badge reflects the single matching item, not its total (3).
    await expect(canvas.getByText("1")).toBeInTheDocument();
    await expect(canvas.getByText("Close tab")).toBeInTheDocument();
  },
};

/** A query that matches nothing renders a designed empty message, not a blank area. */
export const NoMatches: Story = {
  args: {
    groups,
  },
  render: (args) => (
    <div className="w-96">
      <KeyboardShortcuts {...args} query="xyz-nonexistent" />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No shortcuts found")).toBeInTheDocument();
  },
};

/** Uncontrolled search — the app doesn't own the query; the component manages it internally. */
export const Uncontrolled: Story = {
  args: {
    groups,
  },
  render: (args) => (
    <div className="w-96">
      <KeyboardShortcuts {...args} />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText("Search shortcuts");
    await userEvent.type(input, "save");
    await expect(canvas.getByText("General")).toBeInTheDocument();
    await expect(canvas.queryByText("Navigation")).not.toBeInTheDocument();
  },
};

/** The app owns the query — e.g. it lives alongside a `Dialog` header search field. */
export const ControlledQuery: Story = {
  render: () => {
    function Demo() {
      const [query, setQuery] = useState("");
      return (
        <div className="w-96">
          <KeyboardShortcuts groups={groups} query={query} onQueryChange={setQuery} />
        </div>
      );
    }
    return <Demo />;
  },
};

/** No search field — just the grouped, collapsible list. */
export const NotSearchable: Story = {
  args: {
    groups,
    searchable: false,
  },
  render: (args) => (
    <div className="w-96">
      <KeyboardShortcuts {...args} />
    </div>
  ),
};
