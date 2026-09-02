import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { WorkspacePicker } from "./workspace-picker";
import type { Workspace } from "./workspace-picker-state";

const workspaces: Workspace[] = [
  {
    id: "ws-brand-ui",
    name: "elabs-components",
    path: "~/dev/elabs-components",
    lastOpenedAt: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: "ws-brainless",
    name: "brainless",
    path: "~/dev/oss/brainless",
    lastOpenedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
  },
  {
    id: "ws-monorepo",
    name: "platform-monorepo",
    // Long, user-supplied content — truncates instead of overflowing.
    path: "~/workspaces/clients/northwind/services/platform-monorepo/packages/api-gateway",
    lastOpenedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
  },
];

const meta = {
  title: "Core/WorkspacePicker",
  component: WorkspacePicker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A recent-workspace switcher, built as a `ModelPicker` PRESET rather than a new " +
          "picker (issue #111) — see `docs/decisions/2026-09-01-brainless-adoption-architecture.md` " +
          "§ 7. Maps `Workspace[]` onto `ModelPicker`'s grouped rows, formats `lastOpenedAt` with " +
          "`Intl.RelativeTimeFormat`, marks the current workspace in text, and renders a free-text " +
          "path entry into `ModelPicker`'s `footer` slot.\n\n" +
          "No `Sidebar` dependency, unlike `TeamSwitcher` — this works anywhere a picker is needed.",
      },
    },
  },
  args: { workspaces, currentId: "ws-brand-ui", onSelect: fn(), onSubmitPath: fn() },
} satisfies Meta<typeof WorkspacePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * The current workspace is marked in the row's TEXT (a "Current" badge, not
 * only `ModelPicker`'s check glyph) — open the popover to see it, and confirm
 * it survives a greyscale render.
 */
export const CurrentWorkspaceMarkedInText: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox"));
    const body = within(canvasElement.ownerDocument.body);
    const currentRow = await body.findByRole("option", { name: /elabs-components/i });
    // The marker is part of the row's ACCESSIBLE NAME, not only a visual glyph.
    await expect(currentRow).toHaveAccessibleName(/current/i);
    const otherRow = body.getByRole("option", { name: /brainless/i });
    await expect(otherRow).not.toHaveAccessibleName(/current/i);
  },
};

/** No workspace chosen yet — the trigger falls back to a designed placeholder. */
export const NoCurrentWorkspace: Story = {
  args: { currentId: undefined },
};

/**
 * Nothing to show — `ModelPicker`'s own designed empty panel (reused, not
 * reimplemented) plus the free-text path entry, which always renders in the
 * footer regardless of body state and is this state's one action.
 *
 * No `play` function on purpose: opening the popover here renders
 * `ModelPicker`'s `CommandList` (`role="listbox"`, from cmdk) with zero
 * `option`/`group` children, which is a real, pre-existing
 * `aria-required-children` axe violation in `ModelPicker` itself — out of
 * this component's ownership to fix (reported separately). The empty-state
 * behavior (message + the free-text entry as its one action) is covered
 * instead by `workspace-picker.test.tsx`, which does not run axe.
 */
export const Empty: Story = {
  args: { workspaces: [], currentId: undefined },
};

/** A very long, deeply nested path truncates instead of overflowing the row. */
export const LongPath: Story = {
  args: {
    workspaces: [
      {
        id: "ws-deep",
        name: "api-gateway",
        path: "~/workspaces/clients/northwind/services/platform-monorepo/packages/api-gateway/src/routes/internal",
      },
    ],
    currentId: "ws-deep",
  },
};

export const Disabled: Story = { args: { disabled: true } };

/**
 * The free-text path entry validates non-empty and reports the raw string —
 * this component performs no filesystem access of any kind (D5). Also proves
 * Enter submits the path instead of being hijacked by cmdk's own list
 * navigation (both bind a keydown handler on the same `Command` root).
 */
export const SubmitFreeTextPath: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("combobox"));
    const body = within(canvasElement.ownerDocument.body);
    const input = body.getByPlaceholderText(/path/i);
    const submit = body.getByRole("button", { name: /open/i });

    // Nothing typed yet — validated as empty, no call.
    await userEvent.click(submit);
    await expect(args.onSubmitPath).not.toHaveBeenCalled();

    await userEvent.type(input, "~/dev/new-project{Enter}");
    await expect(args.onSubmitPath).toHaveBeenCalledWith("~/dev/new-project");
    // Enter submitted the path — it did not move cmdk's list highlight/select.
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};
