import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta = {
  title: "Core/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: {
    interactive: {
      description:
        "Opt-in hover-lift for clickable cards (motion-tokened, respects reduced-motion).",
      control: "boolean",
      table: { category: "Behavior" },
    },
    detail: {
      description: "Optional detail-panel content (ReactNode). Undefined = plain card.",
      control: false,
      table: { category: "Content" },
    },
    detailPlacement: {
      description: "Which edge the detail panel sits on.",
      control: { type: "radio" },
      options: ["side", "bottom"],
      table: { category: "Appearance" },
    },
    detailReveal: {
      description: "`fixed` — always visible; `hover` — revealed on hover and focus-within.",
      control: { type: "radio" },
      options: ["fixed", "hover"],
      table: { category: "Behavior" },
    },
    detailSize: {
      description:
        'CSS length for the detail track (e.g. `"16rem"`). Defaults to 16rem (side) / auto (bottom).',
      control: "text",
      table: { category: "Appearance" },
    },
    detailLabel: {
      description: 'Accessible label for the detail region (aria-label). Default: "Details".',
      control: "text",
      table: { category: "Appearance" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Monthly active users</CardTitle>
        <CardDescription>Across all workspaces</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-display font-semibold">24,512</div>
      </CardContent>
      <CardFooter>
        <span className="text-body text-muted-foreground">+12.4% vs last month</span>
      </CardFooter>
    </Card>
  ),
};

/** Opt-in hover-lift for clickable cards (gated by the motion system). */
export const Interactive: Story = {
  render: () => (
    <Card interactive className="max-w-sm" tabIndex={0} role="button">
      <CardHeader>
        <CardTitle>Production pipeline</CardTitle>
        <CardDescription>Hover or focus — lifts over the gated duration</CardDescription>
      </CardHeader>
      <CardContent>
        <span className="text-body text-muted-foreground">Last run 4m ago · 1.2M rows</span>
      </CardContent>
    </Card>
  ),
  play: async ({ canvas }) => {
    const card = canvas.getByRole("button");
    const cs = getComputedStyle(card);
    // The lift uses Tailwind v4's standalone `translate` property — the
    // transition MUST list `translate` (not the `transform` shorthand) or it
    // snaps instead of gliding. Guards against the v4 transform-split gotcha.
    await expect(cs.transitionProperty).toContain("translate");
    await expect(parseFloat(cs.transitionDuration)).toBeGreaterThanOrEqual(0.2); // gated --t-base
  },
};

// ---------------------------------------------------------------------------
// Detail panel stories (#118 DP-01)
// Each story is wrapped in a sized parent so the grid layout has a defined
// height/width to work with (side panels need a concrete height).
// ---------------------------------------------------------------------------

/** Side panel always visible (default detailReveal). */
export const DetailSideFixed: Story = {
  render: () => (
    <div className="h-64 w-[480px]">
      <Card
        className="h-full"
        detail={
          <div className="flex flex-col gap-2">
            <p className="text-meta font-semibold text-muted-foreground uppercase tracking-wide">
              Metadata
            </p>
            <ul className="text-body text-foreground space-y-1">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Owner</span>
                <span>analytics-team</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>2 days ago</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Rows</span>
                <span>1.2M</span>
              </li>
            </ul>
          </div>
        }
        detailPlacement="side"
        detailReveal="fixed"
      >
        <CardHeader>
          <CardTitle>Sales pipeline</CardTitle>
          <CardDescription>Q2 2026 opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-display font-semibold">$4.7M</div>
        </CardContent>
      </Card>
    </div>
  ),
};

/** Side panel revealed on hover / keyboard focus-within (outer card size stays constant). */
export const DetailSideHover: Story = {
  render: () => (
    <div className="h-64 w-[480px]">
      <Card
        className="h-full"
        detail={
          <div className="flex flex-col gap-2">
            <p className="text-meta font-semibold text-muted-foreground uppercase tracking-wide">
              Quick actions
            </p>
            <ul className="text-body space-y-1">
              <li>
                <button className="text-foreground hover:underline focus-ring rounded-sm px-1">
                  View report
                </button>
              </li>
              <li>
                <button className="text-foreground hover:underline focus-ring rounded-sm px-1">
                  Export CSV
                </button>
              </li>
              <li>
                <button className="text-foreground hover:underline focus-ring rounded-sm px-1">
                  Share
                </button>
              </li>
            </ul>
          </div>
        }
        detailPlacement="side"
        detailReveal="hover"
      >
        <CardHeader>
          <CardTitle>Revenue report</CardTitle>
          <CardDescription>Hover or tab into the card to reveal actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-display font-semibold">$182K</div>
        </CardContent>
      </Card>
    </div>
  ),
};

/** Bottom panel always visible. */
export const DetailBottomFixed: Story = {
  render: () => (
    <div className="h-80 w-96">
      <Card
        className="h-full"
        detail={
          <div className="flex items-center gap-4">
            <span className="text-body text-muted-foreground">Last synced 5 min ago</span>
            <span className="ms-auto rounded-full bg-surface px-2 py-0.5 text-meta border border-border text-foreground">
              Live
            </span>
          </div>
        }
        detailPlacement="bottom"
        detailReveal="fixed"
        detailSize="3.5rem"
      >
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Across all regions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-display font-semibold">8,340</div>
        </CardContent>
      </Card>
    </div>
  ),
};

/** Bottom panel revealed on hover / keyboard focus-within. */
export const DetailBottomHover: Story = {
  render: () => (
    <div className="h-80 w-96">
      <Card
        className="h-full"
        detail={
          <div className="flex items-center gap-3">
            <button className="text-body text-foreground hover:underline focus-ring rounded-sm px-1">
              Drill down
            </button>
            <button className="text-body text-foreground hover:underline focus-ring rounded-sm px-1">
              Download
            </button>
          </div>
        }
        detailPlacement="bottom"
        detailReveal="hover"
        detailSize="3rem"
      >
        <CardHeader>
          <CardTitle>Ingest volume</CardTitle>
          <CardDescription>Hover to reveal bottom actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-display font-semibold">94 GB/hr</div>
        </CardContent>
      </Card>
    </div>
  ),
};

/** Proves `interactive` (hover-lift) and `detail` panel coexist without conflict. */
export const InteractiveWithDetail: Story = {
  render: () => (
    <div className="h-64 w-[480px]">
      <Card
        className="h-full"
        interactive
        tabIndex={0}
        role="button"
        detail={
          <div className="flex flex-col gap-2">
            <p className="text-meta font-semibold text-muted-foreground uppercase tracking-wide">
              Details
            </p>
            <ul className="text-body space-y-1">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="text-foreground">Healthy</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">SLA</span>
                <span className="text-foreground">99.9%</span>
              </li>
            </ul>
          </div>
        }
        detailPlacement="side"
        detailReveal="fixed"
      >
        <CardHeader>
          <CardTitle>Data pipeline</CardTitle>
          <CardDescription>Interactive card with a fixed side panel</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-body text-muted-foreground">
            Hover to lift · detail always visible
          </span>
        </CardContent>
      </Card>
    </div>
  ),
  play: async ({ canvas }) => {
    const card = canvas.getByRole("button");
    // Both interactive lift AND detail panel are rendered — card is in the DOM.
    await expect(card).toBeInTheDocument();
    const cs = getComputedStyle(card);
    await expect(cs.transitionProperty).toContain("translate");
  },
};

/**
 * `CardTitle` defaults to a `<div>` (unchanged) but accepts `as` to render a
 * real heading (`h1`-`h6`) so a page built from cards contributes to the
 * document outline (#328). Visual is identical across every tag — only the
 * underlying element and its accessible heading level change.
 */
export const HeadingLevels: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Default — a plain div (no change)</CardTitle>
          <CardDescription>Not reachable via heading navigation</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">as=&quot;h2&quot; — a real heading</CardTitle>
          <CardDescription>Reachable via AT heading navigation at level 2</CardDescription>
        </CardHeader>
      </Card>
    </div>
  ),
  play: async ({ canvas }) => {
    // Default stays a div — no accessible heading for that title.
    await expect(
      canvas.queryByRole("heading", { name: /Default — a plain div/ }),
    ).not.toBeInTheDocument();
    // `as="h2"` produces a real, level-2 heading.
    const heading = canvas.getByRole("heading", { level: 2, name: /a real heading/ });
    await expect(heading.tagName).toBe("H2");
  },
};

/**
 * `CardDescription` gains an opt-in `measure` prop that caps genuine prose to
 * a readable line length (`max-w-prose`, ~65ch) instead of running edge to
 * edge in a wide card (#339). Off by default — short subtitle-style
 * descriptions stay full width.
 */
export const DescriptionMeasure: Story = {
  render: () => (
    <div className="flex w-[1000px] flex-col gap-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Uncapped (default)</CardTitle>
          <CardDescription>
            This paragraph runs the full width of a very wide card, which makes it materially harder
            to read once a line gets long enough — there is no natural place for the eye to return
            to the start of the next line, so reading speed and comprehension both suffer on wide
            viewports.
          </CardDescription>
        </CardHeader>
      </Card>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Capped via `measure`</CardTitle>
          <CardDescription measure>
            This paragraph is capped to a readable prose measure even inside a very wide card, so
            each line stays short enough to read comfortably and the eye can find the start of the
            next line without losing its place.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  ),
  play: async ({ canvas }) => {
    const capped = canvas.getByText(/capped to a readable prose measure/);
    await expect(capped).toHaveClass("max-w-prose");
    const uncapped = canvas.getByText(/runs the full width/);
    await expect(uncapped).not.toHaveClass("max-w-prose");
  },
};

/**
 * Keyboard path: tab into a side+hover card and assert the detail's focusable
 * control is reachable. The `focus-within` CSS selector reveals the panel; DOM
 * assertions confirm the control is present and accessible (layout is opaque to
 * jsdom so we verify focusability, not visual appearance).
 */
export const DetailHoverKeyboardReveal: Story = {
  render: () => (
    <div className="h-64 w-[480px]">
      {/* Sentinel button before the card so Tab lands inside the card next */}
      <button className="sr-only" data-testid="before-sentinel">
        Before card
      </button>
      <Card
        className="h-full"
        detail={
          <div className="flex flex-col gap-2 pt-1">
            <button
              data-testid="detail-action"
              className="text-body text-foreground hover:underline focus-ring rounded-sm px-1 text-start"
            >
              Open details
            </button>
          </div>
        }
        detailPlacement="side"
        detailReveal="hover"
      >
        <CardHeader>
          <CardTitle>Keyboard reveal demo</CardTitle>
          <CardDescription>Tab into the card — focus-within opens the panel</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-body text-muted-foreground">Press Tab to navigate in</span>
        </CardContent>
      </Card>
    </div>
  ),
  play: async ({ canvas }) => {
    // The detail button stays in the DOM even when the panel is visually collapsed
    // (overflow-hidden clips it; display:none is NOT used so AT reaches it).
    const detailBtn = canvas.getByTestId("detail-action");
    await expect(detailBtn).toBeInTheDocument();

    // Drive the keyboard path: focus the sentinel, then Tab to move into the card.
    const sentinel = canvas.getByTestId("before-sentinel");
    sentinel.focus();

    // Tab through focusable elements inside the card until we reach the detail button.
    const user = userEvent.setup({ delay: null });
    // Tab once to enter the card area (the first tabbable element inside).
    await user.tab();

    // The detail button is always in the DOM (clipped, not removed), so focus can
    // reach it via Tab — assert it is focusable and present.
    await expect(detailBtn).toBeInTheDocument();
    // Tab until we land on the detail button (at most a few extra tabs).
    let attempts = 0;
    while (document.activeElement !== detailBtn && attempts < 6) {
      await user.tab();
      attempts++;
    }
    await expect(document.activeElement).toBe(detailBtn);
  },
};
