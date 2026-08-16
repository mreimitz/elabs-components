import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Button } from "../button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "Core/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  argTypes: {
    defaultValue: {
      description: "Uncontrolled: the tab value active on first render.",
      control: "text",
      table: { category: "State" },
    },
    value: {
      description: "Controlled active tab value.",
      control: "text",
      table: { category: "State" },
    },
    onValueChange: {
      description: "Callback fired when the active tab changes.",
      control: false,
      table: { category: "Behavior" },
    },
    orientation: {
      description: "Layout orientation of the tab list.",
      control: { type: "radio" },
      options: ["horizontal", "vertical"],
      table: { category: "Appearance" },
    },
    activationMode: {
      description: "`automatic` activates on focus; `manual` requires an explicit click/Enter.",
      control: { type: "radio" },
      options: ["automatic", "manual"],
      table: { category: "Behavior" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-80">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-body text-muted-foreground">
        Overview panel.
      </TabsContent>
      <TabsContent value="activity" className="text-body text-muted-foreground">
        Activity panel.
      </TabsContent>
      <TabsContent value="settings" className="text-body text-muted-foreground">
        Settings panel.
      </TabsContent>
    </Tabs>
  ),
  // Selecting a tab reveals its panel and marks the trigger aria-selected — the
  // panel content is unmounted until its tab is active, so this proves the
  // switch actually happened.
  play: async ({ canvas, userEvent }) => {
    const activity = canvas.getByRole("tab", { name: "Activity" });
    await userEvent.click(activity);
    await expect(activity).toHaveAttribute("aria-selected", "true");
    // The panel mounts on switch and fades in (gated entrance) — wait for it to settle.
    const panel = await canvas.findByText("Activity panel.");
    await waitFor(() => expect(panel).toBeVisible());
  },
};

const OVERFLOW_TABS = Array.from({ length: 8 }, (_, i) => `tab-${i + 1}`);

/**
 * An 8-tab strip inside a 320px-wide container (phone-width) — narrower than
 * the strip's natural width, so it must scroll rather than clip. Confirms
 * every tab is reachable by keyboard: repeated `ArrowRight` walks focus/
 * selection all the way to the last tab, and the newly-active tab scrolls
 * itself into the container's visible bounds (real layout — this assertion
 * only means anything in a real browser, which is how `test-storybook` /
 * `run-story-tests` execute it).
 */
export const OverflowScrollable: Story = {
  render: () => (
    <div className="w-[320px]">
      <Tabs defaultValue="tab-1">
        <TabsList>
          {OVERFLOW_TABS.map((value, i) => (
            <TabsTrigger key={value} value={value}>
              Tab {i + 1}
            </TabsTrigger>
          ))}
        </TabsList>
        {OVERFLOW_TABS.map((value, i) => (
          <TabsContent key={value} value={value} className="text-body text-muted-foreground">
            Panel {i + 1}.
          </TabsContent>
        ))}
      </Tabs>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const tablist = canvas.getByRole("tablist");
    // The strip is wider than its 320px container — it must scroll, not clip.
    await expect(tablist.scrollWidth).toBeGreaterThan(tablist.clientWidth);

    const first = canvas.getByRole("tab", { name: "Tab 1" });
    // `justify-center-safe` (not `justify-center`) — the initially-active
    // first tab must be fully within the visible scroll area on mount, not
    // stranded off the left edge by a naive center-alignment of the
    // overflowing strip.
    await waitFor(() => {
      const firstRect = first.getBoundingClientRect();
      const containerRect = tablist.getBoundingClientRect();
      expect(firstRect.left).toBeGreaterThanOrEqual(containerRect.left - 1);
      expect(firstRect.right).toBeLessThanOrEqual(containerRect.right + 1);
    });

    first.focus();
    await expect(first).toHaveFocus();

    for (let i = 0; i < OVERFLOW_TABS.length - 1; i++) {
      await userEvent.keyboard("{ArrowRight}");
    }

    const last = canvas.getByRole("tab", { name: "Tab 8" });
    await waitFor(() => expect(last).toHaveFocus());
    await expect(last).toHaveAttribute("aria-selected", "true");

    // Real-layout assertion: the newly-active tab scrolled itself into the
    // scroll container's visible bounds (a ±1px tolerance for rounding).
    await waitFor(
      () => {
        const triggerRect = last.getBoundingClientRect();
        const containerRect = tablist.getBoundingClientRect();
        expect(triggerRect.left).toBeGreaterThanOrEqual(containerRect.left - 1);
        expect(triggerRect.right).toBeLessThanOrEqual(containerRect.right + 1);
      },
      { timeout: 3000 },
    );
  },
};

/**
 * Regression guard: a strip that FITS its container renders exactly as
 * before — `justify-center-safe` behaves identically to `justify-center`
 * when there's nothing to overflow, so no scrollbar appears — AND mounting it
 * moves NOTHING.
 *
 * The tabs sit below a tall spacer inside a scroll region, out of view. The
 * first cut of #344 called `Element.scrollIntoView()` on mount, which walks
 * every scrollable ancestor: it scrolled this region (and the page) to reveal
 * the tabs nobody had asked for. Asserting "no scrollbar" alone did not catch
 * that — asserting the scroll POSITION does.
 */
export const WideViewportFits: Story = {
  render: () => (
    <div data-testid="scroll-region" className="h-[220px] w-[640px] overflow-y-auto">
      <p className="h-[600px] text-body text-muted-foreground">
        This scroll region starts at the top, and must stay there. The tabs below are deliberately
        out of view on mount.
      </p>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="text-body text-muted-foreground">
          Overview panel.
        </TabsContent>
        <TabsContent value="activity" className="text-body text-muted-foreground">
          Activity panel.
        </TabsContent>
        <TabsContent value="settings" className="text-body text-muted-foreground">
          Settings panel.
        </TabsContent>
      </Tabs>
    </div>
  ),
  play: async ({ canvas }) => {
    const tablist = canvas.getByRole("tablist");
    await waitFor(() => expect(tablist.scrollWidth).toBeLessThanOrEqual(tablist.clientWidth + 1));

    // A smooth scroll is asynchronous — wait long enough for a stray one to
    // land before asserting it never happened.
    const region = canvas.getByTestId("scroll-region");
    await new Promise((resolve) => setTimeout(resolve, 400));
    await expect(region.scrollTop).toBe(0);
    await expect(window.scrollY).toBe(0);
  },
};

/**
 * The scroll-on-activation behaviour proved WITHOUT the browser's own
 * focus-scrolling doing the work: a button beside the strip sets the value
 * programmatically, so the newly-active tab is never focused and nothing but
 * `TabsTrigger`'s own effect can bring it into view.
 *
 * The strip starts at scroll 0 (mount is not an activation), then moves — and
 * only the strip moves.
 */
export const ProgrammaticActivation: Story = {
  render: function ProgrammaticActivationStory() {
    const [value, setValue] = useState("tab-1");
    return (
      <div className="w-[320px]">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mb-2"
          onClick={() => setValue("tab-8")}
        >
          Jump to Tab 8
        </Button>
        <Tabs value={value} onValueChange={setValue}>
          <TabsList>
            {OVERFLOW_TABS.map((tab, i) => (
              <TabsTrigger key={tab} value={tab}>
                Tab {i + 1}
              </TabsTrigger>
            ))}
          </TabsList>
          {OVERFLOW_TABS.map((tab, i) => (
            <TabsContent key={tab} value={tab} className="text-body text-muted-foreground">
              Panel {i + 1}.
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const tablist = canvas.getByRole("tablist");
    // Mount is a state, not an activation: the strip never scrolled itself.
    await new Promise((resolve) => setTimeout(resolve, 400));
    await expect(tablist.scrollLeft).toBe(0);

    await userEvent.click(canvas.getByRole("button", { name: "Jump to Tab 8" }));

    const last = canvas.getByRole("tab", { name: "Tab 8" });
    await expect(last).toHaveAttribute("aria-selected", "true");
    // The activated tab scrolled itself into the STRIP's visible bounds…
    await waitFor(
      () => {
        const triggerRect = last.getBoundingClientRect();
        const stripRect = tablist.getBoundingClientRect();
        expect(triggerRect.left).toBeGreaterThanOrEqual(stripRect.left - 1);
        expect(triggerRect.right).toBeLessThanOrEqual(stripRect.right + 1);
      },
      { timeout: 3000 },
    );
    await expect(tablist.scrollLeft).toBeGreaterThan(0);
    // …and only the strip: the page itself never moved.
    await expect(window.scrollY).toBe(0);
  },
};
