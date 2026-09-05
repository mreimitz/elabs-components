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

/**
 * `scroll="content"` makes `PageShell` itself the scroll port, for embedding
 * inside a `SidebarInset` whose height is already bounded — the app chrome
 * outside it (the top bar here) never moves.
 */
export const ScrollContent: Story = {
  render: function ScrollContentStory() {
    return (
      <div className="flex h-[420px] flex-col border border-border">
        <div
          data-testid="app-topbar"
          className="shrink-0 border-b border-border bg-sidebar px-4 py-2 text-body"
        >
          App chrome outside PageShell
        </div>
        <PageShell scroll="content" data-testid="scroll-content-shell">
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
    const shell = canvasElement.querySelector<HTMLElement>('[data-testid="scroll-content-shell"]');
    const marker = canvasElement.querySelector<HTMLElement>('[data-testid="marker-row"]');
    const topbar = canvasElement.querySelector<HTMLElement>('[data-testid="app-topbar"]');

    await expect(shell).not.toBeNull();
    await expect(marker).not.toBeNull();
    await expect(topbar).not.toBeNull();

    await expect(getComputedStyle(shell!).overflowY).toBe("auto");

    // scroll="content" makes this element the scroll port, so it defaults to
    // keyboard-operable (WCAG 2.1.1, axe `scrollable-region-focusable`).
    await expect(shell!.tabIndex).toBe(0);

    const topbarTopBefore = topbar!.getBoundingClientRect().top;
    const markerTopBefore = marker!.getBoundingClientRect().top;

    shell!.scrollTop = 300;

    await waitFor(() => {
      expect(marker!.getBoundingClientRect().top).toBeLessThan(markerTopBefore);
    });

    // The chrome outside PageShell never moved — PageShell owns its own scroll.
    await expect(topbar!.getBoundingClientRect().top).toBe(topbarTopBefore);
  },
};

/**
 * `scroll="fill"` fills its parent and scrolls nothing itself — a child (here
 * an inner list) owns the overflow instead.
 */
export const ScrollFill: Story = {
  render: function ScrollFillStory() {
    return (
      <div className="h-[320px] border border-border">
        <PageShell
          scroll="fill"
          data-testid="scroll-fill-shell"
          contentClassName="flex h-full min-h-0 flex-col"
        >
          <div
            data-testid="inner-scroll"
            // The inner list is the scroll port here (`scroll="fill"` means
            // PageShell itself owns none of it), so THIS element needs the
            // keyboard-operable fix (WCAG 2.1.1, axe
            // `scrollable-region-focusable`) — same precedent as `DialogBody`.
            tabIndex={0}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border bg-card p-2 focus-ring"
          >
            {Array.from({ length: 40 }, (_, i) => (
              <div
                key={i}
                data-testid={i === 20 ? "marker-row" : undefined}
                className="rounded-md bg-surface-muted p-2 text-body"
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
    const shell = canvasElement.querySelector<HTMLElement>('[data-testid="scroll-fill-shell"]');
    const inner = canvasElement.querySelector<HTMLElement>('[data-testid="inner-scroll"]');
    const marker = canvasElement.querySelector<HTMLElement>('[data-testid="marker-row"]');

    await expect(shell).not.toBeNull();
    await expect(inner).not.toBeNull();
    await expect(marker).not.toBeNull();

    // PageShell itself does not scroll — the inner list owns the overflow.
    await expect(getComputedStyle(shell!).overflow).toBe("hidden");
    await expect(getComputedStyle(inner!).overflowY).toBe("auto");

    const markerTopBefore = marker!.getBoundingClientRect().top;
    inner!.scrollTop = 300;
    await waitFor(() => {
      expect(marker!.getBoundingClientRect().top).toBeLessThan(markerTopBefore);
    });
  },
};

/**
 * `headerGutter` reserves a fixed-height header row so a page title lands at
 * the same vertical coordinate on every route that turns it on.
 */
export const WithHeaderGutter: Story = {
  render: () => (
    <PageShell headerGutter header={<h1 className="text-title font-medium">Pipeline runs</h1>}>
      <div className="rounded-xl border bg-card p-6 text-body text-muted-foreground">Content</div>
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    const gutter = canvasElement.querySelector<HTMLElement>('[data-slot="page-shell-header"]');
    await expect(gutter).not.toBeNull();
    await expect(getComputedStyle(gutter!).minHeight).toBe("48px");
  },
};

/**
 * The reserved row renders even on a route with no header at all — an empty
 * band, not a missing one — which is what keeps titles aligned across routes
 * that do and don't have one (ADR 0035).
 */
export const WithHeaderGutterNoHeader: Story = {
  render: () => (
    <PageShell headerGutter>
      <div className="rounded-xl border bg-card p-6 text-body text-muted-foreground">
        This route has no header, but the reserved row above still holds its space.
      </div>
    </PageShell>
  ),
  play: async ({ canvasElement }) => {
    const gutter = canvasElement.querySelector<HTMLElement>('[data-slot="page-shell-header"]');
    await expect(gutter).not.toBeNull();
    await expect(gutter!.textContent).toBe("");
    await expect(getComputedStyle(gutter!).minHeight).toBe("48px");
  },
};
