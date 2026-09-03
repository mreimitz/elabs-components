import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { cn } from "../../lib/cn";
import { splitPaneVariants } from "../split-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";
const meta = {
  title: "Layout/Resizable",
  component: ResizablePanelGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Panes the user can drag to resize — fixed two-pane layouts with per-pane surface " +
          "tones are `Layout/SplitPanel`, see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "The `react-resizable-panels` primitive set (`ResizablePanelGroup`/`ResizablePanel`/ " +
          "`ResizableHandle`): n panes, percentage sizing, persisted layout. Apply " +
          "`splitPaneVariants({ tone })` (exported from `Layout/SplitPanel`) to a `ResizablePanel` " +
          "for the same `plain`/`muted`/`card` ground-offset tiering — see the `Tiered` story.",
      },
    },
  },
} satisfies Meta<typeof ResizablePanelGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <ResizablePanelGroup direction="horizontal" className="h-48 max-w-xl rounded-lg border">
      <ResizablePanel defaultSize={40} className="flex items-center justify-center p-4 text-body">
        List
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        defaultSize={60}
        className="flex items-center justify-center p-4 text-body text-muted-foreground"
      >
        Detail
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

/**
 * The same `plain`/`muted`/`card` ground-offset tiering `SplitPanel` gives its
 * `startTone`/`endTone`, composed onto draggable panels via the exported
 * `splitPaneVariants` — so a user-resizable layout doesn't need a hand-rolled second
 * copy of the tone classes. The play test drags the handle and asserts the panel's
 * relative size (`data-panel-size`, react-resizable-panels' `flexGrow`-derived
 * attribute) actually changed, not an exact pixel width — a headless drag is flaky
 * against pixel deltas — and that both tone classes survive the resize.
 */
export const Tiered: Story = {
  render: () => (
    <ResizablePanelGroup direction="horizontal" className="h-48 max-w-xl rounded-lg border">
      <ResizablePanel
        defaultSize={40}
        className={cn(
          splitPaneVariants({ tone: "muted" }),
          "flex items-center justify-center p-4 text-body",
        )}
      >
        List
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        defaultSize={60}
        className={cn(
          splitPaneVariants({ tone: "card" }),
          "flex items-center justify-center p-4 text-body text-muted-foreground",
        )}
      >
        Detail
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
  play: async ({ canvasElement }) => {
    const panels = canvasElement.querySelectorAll<HTMLElement>("[data-panel]");
    const [startPanel, endPanel] = Array.from(panels);
    await expect(startPanel).toBeDefined();
    await expect(endPanel).toBeDefined();
    const sizeBefore = startPanel!.getAttribute("data-panel-size");

    // Tones apply before the drag.
    await expect(startPanel!.className).toMatch(/bg-surface-muted/);
    await expect(endPanel!.className).toMatch(/bg-card/);
    await expect(endPanel!.className).toMatch(/shadow-sm/);

    // `ResizablePanel` sets `style="overflow: hidden"` inline (react-resizable-panels);
    // an inline style always wins the cascade over `splitPaneVariants`' `overflow-auto`
    // class, so the resolved overflow stays `hidden` here — the class isn't fighting
    // anything visually, it's simply inert on this element. Locked so a future
    // react-resizable-panels upgrade that drops the inline style doesn't silently
    // flip scroll behaviour unnoticed.
    await expect(getComputedStyle(startPanel!).overflow).toBe("hidden");

    const handle = canvasElement.querySelector<HTMLElement>('[role="separator"]');
    await expect(handle).not.toBeNull();
    const rect = handle!.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    await userEvent.pointer([
      { keys: "[MouseLeft>]", target: handle!, coords: { clientX: rect.left + 1, clientY: y } },
      { coords: { clientX: rect.left + 80, clientY: y } },
      { keys: "[/MouseLeft]" },
    ]);

    // The relative size changed — never assert an exact pixel width (flaky headless).
    const sizeAfter = startPanel!.getAttribute("data-panel-size");
    await expect(sizeAfter).not.toBe(sizeBefore);

    // Tones still apply after the drag.
    await expect(startPanel!.className).toMatch(/bg-surface-muted/);
    await expect(endPanel!.className).toMatch(/bg-card/);
    await expect(endPanel!.className).toMatch(/shadow-sm/);
  },
};
