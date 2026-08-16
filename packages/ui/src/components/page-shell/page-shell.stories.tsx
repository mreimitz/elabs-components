import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { expect, waitFor } from "storybook/test";
import { PageShell } from "./page-shell";
import { SectionHeader } from "../section-header";
import { Button } from "../button";
import { StatusBadge } from "../status-badge";
import { ResultCount, ViewToolbar } from "../view-toolbar";

const meta = {
  title: "Layout/PageShell",
  component: PageShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PageShell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <PageShell header={<SectionHeader title="Settings" description="Manage your workspace." />}>
      <div className="rounded-xl border bg-card p-6 text-body text-muted-foreground">Content</div>
    </PageShell>
  ),
};

/**
 * `headerVariant="toolbar"` places a real `<ViewToolbar>` in `PageShell`'s
 * header slot and pins it in POSITION (never a fixed height — see
 * `Docs/View Toolbar Contract` R7) while the body scrolls beneath it. The
 * outer `h-[420px] overflow-y-auto` div stands in for the `SidebarInset`
 * scroll region `PageShell` is normally embedded in — `PageShell` itself
 * never owns a scroll container (#367).
 */
export const ToolbarSticky: Story = {
  render: function ToolbarStickyStory() {
    return (
      <div data-testid="scroll-region" className="h-[420px] overflow-y-auto">
        <PageShell
          headerVariant="toolbar"
          header={
            <ViewToolbar
              info="Every pipeline run in this workspace from the last 30 days, newest first."
              actions={
                <Button size="sm">
                  <Plus aria-hidden="true" />
                  New
                </Button>
              }
            >
              <StatusBadge status="running" size="sm" />
              <ResultCount count={24} total={128}>
                runs
              </ResultCount>
            </ViewToolbar>
          }
        >
          <div className="flex flex-col gap-3">
            {Array.from({ length: 40 }, (_, i) => (
              <div
                key={i}
                data-testid={i === 20 ? "marker-row" : undefined}
                className="rounded-lg border bg-card p-4 text-body"
              >
                Row {i + 1}
              </div>
            ))}
          </div>
        </PageShell>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const scrollRegion = canvasElement.querySelector<HTMLElement>('[data-testid="scroll-region"]');
    const header = canvasElement.querySelector<HTMLElement>(
      '[data-slot="page-shell-toolbar-header"]',
    );
    const marker = canvasElement.querySelector<HTMLElement>('[data-testid="marker-row"]');

    await expect(scrollRegion).not.toBeNull();
    await expect(header).not.toBeNull();
    await expect(marker).not.toBeNull();

    await expect(getComputedStyle(header!).position).toBe("sticky");

    // Scroll past PageShell's own top padding first, so the header is already
    // in its "stuck" (top: 0) state before the two measurements below — at
    // scrollTop 0 the header still sits at its natural, un-stuck flow
    // position (offset by the page padding), which is not what "pinned" means.
    scrollRegion!.scrollTop = 100;
    const headerTopStuck = header!.getBoundingClientRect().top;
    const markerTopFirstScroll = marker!.getBoundingClientRect().top;

    // Scroll the body further beneath the already-pinned header.
    scrollRegion!.scrollTop = 600;

    // The body actually moved underneath the header.
    await waitFor(() => {
      expect(marker!.getBoundingClientRect().top).toBeLessThan(markerTopFirstScroll);
    });

    // The header stayed pinned: its position is unchanged across the further scroll.
    const headerTopAfterScroll = header!.getBoundingClientRect().top;
    await expect(Math.abs(headerTopAfterScroll - headerTopStuck)).toBeLessThanOrEqual(1);
  },
};
