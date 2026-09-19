import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import {
  DashboardProvider,
  DashboardSheet,
  type DashboardSpec,
} from "@elabs-ai/components-charts/dashboard";
import { chatTileKind } from "@/components/dashboard-tile-chat/dashboard-tile-chat";

/**
 * Renders the SHIPPED registry block (`@/components/…` maps to `registry/blocks`), a
 * `DashboardTileKind` for the sheet's `chat` tile. See `.claude/rules/registry.md`.
 */
const SPEC: DashboardSpec = {
  version: 1,
  id: "chat-tile-demo",
  grid: { mode: "fit", columns: 8, rows: 8, gap: 8 },
  tiles: [
    { id: "chat-1", kind: "chat", title: "Ask", layout: { x: 0, y: 0, w: 8, h: 8 }, content: {} },
  ],
};

function ChatTileDemo() {
  return (
    <div className="h-[420px] w-full min-w-[420px]">
      <DashboardProvider spec={SPEC} tiles={[chatTileKind]}>
        <DashboardSheet renderAll />
      </DashboardProvider>
    </div>
  );
}

const meta = {
  title: "Dashboard/Recipes/Tile — Chat",
  component: ChatTileDemo,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof ChatTileDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * View mode: `interactions.active` is `true` and the composer accepts input. Edit mode:
 * `interactions.active` is `false` (`dashboard-tile.tsx`'s `EDIT_INTERACTIONS`) and the
 * composer goes fully inert.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = (await canvas.findByPlaceholderText(
      "Ask about this sheet…",
    )) as HTMLTextAreaElement;
    // "composer enabled while the sheet is in view mode"
    await expect(field).toBeEnabled();
    await expect(field.disabled).toBe(false);
  },
};

export const InteractionsInactive: Story = {
  render: () => (
    // min-w must clear the `sm` (640px) container-query threshold — below it the sheet
    // force-drops `mode="edit"` to view (dashboard-panels.stories.tsx), which would flip
    // `interactions.active` back to `true` and defeat this story.
    <div className="h-[420px] w-full min-w-[680px]">
      <DashboardProvider spec={SPEC} tiles={[chatTileKind]} mode="edit">
        <DashboardSheet renderAll />
      </DashboardProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // findBy* (not getBy*): the sheet's edit-mode tile layer mounts one measurement pass
    // after first paint (a container-query `ResizeObserver` read), so the composer is not
    // in the DOM synchronously on mount.
    const field = (await canvas.findByPlaceholderText(
      "Chat is inactive on this sheet",
    )) as HTMLTextAreaElement;
    // "composer disabled while the sheet is in edit mode (interactions.active === false)"
    await expect(field.disabled).toBe(true);
  },
};
