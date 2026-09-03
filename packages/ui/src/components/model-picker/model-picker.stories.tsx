import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppWindow, Bot, Sparkles } from "lucide-react";
import { useState } from "react";
import { ModelPicker } from "./model-picker";
import type { ModelPickerGroup } from "./model-picker-state";

const groups: ModelPickerGroup[] = [
  {
    key: "auto",
    label: "Auto",
    items: [
      {
        id: "auto",
        label: "Choose for me",
        description: "Picks the best target for each question",
        icon: <Sparkles className="size-4 shrink-0" aria-hidden="true" />,
      },
    ],
  },
  {
    key: "apps-northwind",
    label: "Apps · northwind",
    items: [
      {
        id: "app-sales",
        label: "Sales overview",
        description: "Updated 2 days ago",
        // "northwind" appears in no visible label on this row — typing it still
        // finds the row, which is the most-used behaviour of this component.
        keywords: ["northwind", "app-sales"],
        icon: <AppWindow className="size-4 shrink-0" aria-hidden="true" />,
      },
      {
        id: "app-stock",
        label: "Stock levels",
        keywords: ["northwind", "app-stock"],
        icon: <AppWindow className="size-4 shrink-0" aria-hidden="true" />,
        meta: ["not provisioned"],
      },
    ],
  },
  {
    key: "assistants-personal",
    label: "Assistants · personal",
    items: [
      {
        id: "asst-research",
        label: "Research helper",
        keywords: ["personal", "asst-research"],
        icon: <Bot className="size-4 shrink-0" aria-hidden="true" />,
      },
    ],
  },
];

const meta = {
  title: "Core/ModelPicker",
  component: ModelPicker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The INLINE composer pill; the full palette in a dialog is `ModelSelector` " +
          "(`@elabs-ai/components-ai`) — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "A compact pill that opens a grouped, searchable target list anchored under itself — " +
          "sized for a composer footer. The inline sibling of `@elabs-ai/components-ai`'s " +
          "`ModelSelector`, which is the same `Command` internals in a modal `Dialog`.\n\n" +
          "**`Command` lives in a `Popover`, never a `DropdownMenu`.** `DropdownMenuContent` owns " +
          "roving tabindex and its own typeahead; both fight a real `<input>` in its subtree, so " +
          "arrow keys move the menu's focus instead of cmdk's highlight and typing never reaches " +
          "the field. `Popover` claims no keyboard.\n\n" +
          "Search matches `keywords` as well as the label — try typing `northwind`.",
      },
    },
  },
  args: { groups, triggerLabel: "Sales overview", value: "app-sales" },
} satisfies Meta<typeof ModelPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Skeleton rows while the first load is in flight. */
export const Loading: Story = {
  args: { groups: [], status: "loading", triggerLabel: "Loading…", value: undefined },
};

/**
 * A failed refresh over usable stale data: an inline strip ABOVE a list that
 * still works. Collapsing this into the error panel would throw away a list the
 * user could still pick from.
 */
export const StaleWithInlineError: Story = {
  args: { status: "stale", onRetry: () => {} },
};

/** Nothing to show AND the load failed — the panel takes over, with a retry. */
export const ErrorState: Story = {
  args: {
    groups: [],
    status: "error",
    triggerLabel: "Unavailable",
    value: undefined,
    onRetry: () => {},
  },
};

/** Nothing to show, but nothing went wrong — a different message, deliberately. */
export const Empty: Story = {
  args: { groups: [], status: "empty", triggerLabel: "No targets", value: undefined },
};

export const Disabled: Story = { args: { disabled: true } };

/**
 * Programmatic open via `open`/`onOpenChange` — e.g. re-opening the picker when
 * a previously pinned target becomes unavailable, without the consumer having
 * to reach into internal state.
 */
export const Controlled: Story = {
  render: (args) => {
    function ControlledModelPicker() {
      const [open, setOpen] = useState(true);
      return <ModelPicker {...args} open={open} onOpenChange={setOpen} />;
    }
    return <ControlledModelPicker />;
  },
};
