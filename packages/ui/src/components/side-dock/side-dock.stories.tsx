import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import { SideDock } from "./side-dock";

const meta = {
  title: "Layout/SideDock",
  component: SideDock,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A summoned, resizable panel that docks to one edge of the content area — closed by default, opened by something the user does, resizable by pointer and keyboard, and rendered as an overlay `Sheet` below `overlayBreakpoint` (default 1100) instead of a fixed-width column. Unlike `ContextRail` (a persistent rail with a 48px icon collapsed state), `SideDock` has no persistent strip: closed means gone. See `docs/ADR/0035-context-rail-and-side-dock.md` §5.",
      },
    },
  },
} satisfies Meta<typeof SideDock>;
export default meta;
type Story = StoryObj<typeof meta>;

const dockBody = <p className="text-body text-muted-foreground">Dock body content.</p>;

/**
 * Open, right-hand (the default `side`). The play function tabs from the
 * close button to the resize handle, widens it twice with the keyboard
 * (`ArrowLeft` on a right-hand dock), and asserts the CONTAINER's actual
 * rendered width grew — a real layout measurement, not just the `aria-*`
 * bookkeeping the unit tests already cover.
 */
export const Default: Story = {
  render: () => (
    <div className="flex h-[560px] w-full">
      <div className="flex-1 bg-background p-6 text-muted-foreground">Canvas content</div>
      <SideDock title="Assistant" open>
        {dockBody}
      </SideDock>
    </div>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const closeButton = canvas.getByRole("button", { name: "Close" });
    const handle = canvas.getByRole("separator");
    const container = canvasElement.querySelector(
      '[data-slot="side-dock-container"]',
    ) as HTMLElement;

    await userEvent.tab();
    await expect(closeButton).toHaveFocus();
    await userEvent.tab();
    await expect(handle).toHaveFocus();

    const before = container.getBoundingClientRect().width;
    await userEvent.keyboard("{ArrowLeft}");
    await userEvent.keyboard("{ArrowLeft}");

    await waitFor(() => {
      const after = container.getBoundingClientRect().width;
      expect(after).toBeGreaterThan(before);
    });
  },
};

/** `open={false}` (the default) — collapsed, `inert`, off-screen; its body content stays mounted for the closing transition. */
export const Closed: Story = {
  render: () => (
    <div className="flex h-[560px] w-full">
      <div className="flex-1 bg-background p-6 text-muted-foreground">Canvas content</div>
      <SideDock title="Assistant">{dockBody}</SideDock>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-slot="side-dock"]');
    const container = canvasElement.querySelector('[data-slot="side-dock-container"]');
    await expect(root).toHaveAttribute("data-state", "collapsed");
    await expect(container).toHaveAttribute("inert");
  },
};

/** `side="left"` — the handle sits on the trailing edge and the keyboard direction inverts (`ArrowRight` widens). */
export const LeftHanded: Story = {
  render: () => (
    <div className="flex h-[560px] w-full">
      <SideDock title="Assistant" open side="left">
        {dockBody}
      </SideDock>
      <div className="flex-1 bg-background p-6 text-muted-foreground">Canvas content</div>
    </div>
  ),
  play: async ({ canvas }) => {
    const handle = canvas.getByRole("separator");
    await expect(handle).toHaveAttribute("aria-orientation", "vertical");
  },
};

/**
 * Below `overlayBreakpoint` the dock renders as an overlay `Sheet` instead of
 * a column, with no resize handle. A very high `overlayBreakpoint` forces
 * this branch deterministically under a headless run, mirroring
 * `ContextRail`'s own `Narrow` story.
 */
export const Overlay: Story = {
  render: () => (
    <div className="flex h-[560px] w-full">
      <div className="flex-1 bg-background p-6 text-muted-foreground">Canvas content</div>
      <SideDock title="Assistant" open overlayBreakpoint={4000} description="A helper panel.">
        {dockBody}
      </SideDock>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const dialog = await waitFor(() => {
      const el = document.querySelector('[role="dialog"]');
      if (!el) throw new Error("overlay Sheet has not mounted yet");
      return el;
    });
    await expect(dialog).toHaveAccessibleName("Assistant");
    await expect(canvasElement.querySelector('[data-slot="side-dock-resize-handle"]')).toBeNull();
  },
};
