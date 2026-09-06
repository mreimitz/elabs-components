import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import DashboardShell from "@/components/sidebar-02/dashboard-shell";
import { DEMO_ACTIVITY, type ActivityEntry } from "@/components/sidebar-02/storefront-overview";

const meta = {
  title: "Layout/App Shell/Dashboard",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The classic left-sidebar dashboard: one collapsible nav rail beside a floating inset content surface. Reach for it when the whole product fits in one navigation tree and the screen is a briefing — figures, a trend, and what changed. When a screen needs a second column of records between the nav and the content (a mail-style list, a queue), reach for `Layout/App Shell/Flagship` instead; it carries four zones and a details rail.",
      },
    },
  },
  // The top bar's <ThemeSwitcher /> reads the @elabs-ai/components-tokens React
  // context, so the screen needs a real provider — the global preview decorator
  // only writes the `data-theme` attribute. It mounts DEEPER than the preview's
  // own theme boundary, so a `STORYBOOK_THEME=<slug>` sweep still wins.
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof DashboardShell>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The believable screen: the store’s own navigation on the left, and the three
 * answers a morning check-in needs — the day’s figures, the revenue trend, and
 * what happened since the last look.
 */
export const Default: Story = {
  render: () => <DashboardShell activePath="/" />,
  play: async ({ canvasElement }) => {
    // The three content regions the screen exists to hold.
    await expect(canvasElement.querySelector('section[aria-label="Key figures"]')).toBeVisible();
    await expect(
      canvasElement.querySelector('[data-slot="storefront-overview-revenue"]'),
    ).toBeVisible();
    await expect(
      canvasElement.querySelector('[data-slot="storefront-overview-activity"]'),
    ).toBeVisible();
    // R1 active state: the current route is lit, an unrelated one is not.
    await expect(canvasElement.querySelector('a[href="/"]')).toHaveAttribute("data-active", "true");
    await expect(canvasElement.querySelector('a[href="/orders"]')).toHaveAttribute(
      "data-active",
      "false",
    );
    // The collapsed-rail mirror is the OTHER half of `Collapsed`'s lock: with
    // the rail expanded it must be off screen, so exactly one copy of a
    // sub-route anchor is ever presented. Asserted here rather than there
    // because a one-sided visibility check passes on code that never hides it.
    await expect(
      // The collapsed mirror is a top-level `sidebar-menu-button`; the expanded
      // sub-menu copy is a `sidebar-menu-sub-button`. Both are the library's own
      // slots, so the block needs no marker attribute of its own.
      canvasElement.querySelector('a[data-slot="sidebar-menu-button"][href="/orders/open"]'),
    ).not.toBeVisible();
    // The chart headline is DERIVED from the series, not a caption. Asserted as
    // the exact sentence the shipped fixture produces (latest 18,420 against a
    // 15,730 mean for the six days before it = +17%), so a headline that stops
    // reading the data — the constant string the card used to carry — fails
    // here. `RevenueDip` is the other half: a different series, a different
    // sentence.
    await expect(
      canvasElement.querySelector('[data-slot="storefront-overview-revenue"] h2'),
    ).toHaveTextContent("Revenue is running 17% ahead of the rest of the week");
    // The group divider is the EXPANDED half of `CollapsedGroups`' lock. The
    // node is in the DOM in both states, so asserting only the collapsed side
    // passes on code that never hides it.
    const expandedDividers = canvasElement.querySelectorAll(
      'nav[aria-label="Primary"] [data-slot="sidebar-separator"]',
    );
    await expect(expandedDividers).toHaveLength(1);
    for (const divider of expandedDividers) await expect(divider).not.toBeVisible();

    /* A6 — the rail toggle exposes the state it toggles. Its whole accessible
     * name is the static "Toggle Sidebar", so before this attribute existed
     * NOTHING told a screen-reader user whether the rail was open, and no axe
     * rule fires (a <button> has no REQUIRED expanded state). Read as a string
     * with `getAttribute`: absent and `"false"` are different states, and
     * `toHaveAttribute("aria-expanded")` alone cannot tell them apart.
     * `Collapsed` locks the other value, `Narrow` the mobile branch.
     */
    await expect(
      canvasElement.querySelector('[data-slot="sidebar-trigger"]')?.getAttribute("aria-expanded"),
    ).toBe("true");
  },
};

/**
 * The same screen on a week that went the other way. Its only job is to prove
 * the revenue headline reads the series: a falling week must say so, in its own
 * words, rather than repeating whatever `Default` says.
 */
export const RevenueDip: Story = {
  render: () => (
    <DashboardShell
      activePath="/"
      revenue={[
        { date: new Date("2026-08-30"), value: 20_000 },
        { date: new Date("2026-08-31"), value: 20_000 },
        { date: new Date("2026-09-01"), value: 20_000 },
        { date: new Date("2026-09-02"), value: 20_000 },
        { date: new Date("2026-09-03"), value: 20_000 },
        { date: new Date("2026-09-04"), value: 20_000 },
        { date: new Date("2026-09-05"), value: 15_000 },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    // Latest 15,000 against a 20,000 mean = −25%, and the wording flips with the
    // sign. Both the number and the direction word come from the data.
    await expect(
      canvasElement.querySelector('[data-slot="storefront-overview-revenue"] h2'),
    ).toHaveTextContent("Revenue is running 25% behind the rest of the week");
  },
};

/**
 * A nested route lights its PARENT nav entry, and the root entry stays dark —
 * the guard in `isPathActive` that stops `/` matching every route.
 */
export const NestedRoute: Story = {
  render: () => <DashboardShell activePath="/orders/open" />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('a[href="/orders"]')).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(canvasElement.querySelector('a[href="/"]')).toHaveAttribute(
      "data-active",
      "false",
    );
    // Depth 2, so the trail earns its row — one crumb would be a page title
    // wearing a separator.
    await expect(canvasElement.querySelector('nav[aria-label="breadcrumb"]')).toBeInTheDocument();
  },
};

/**
 * Chrome only: the frame with an empty content slot. The lock is the shell’s
 * standards — a skip link, one `<main id="main-content">` focus target, the
 * named primary nav and the command trigger — so a later refactor that quietly
 * drops one fails here rather than in review.
 */
export const Frame: Story = {
  render: () => <DashboardShell activePath="/" emptyContent />,
  play: async ({ canvasElement }) => {
    // `toBeVisible()`, not `toBeInTheDocument()`. These three lines carry the
    // whole promise of the story — "a later refactor that quietly drops one
    // fails here" — and as presence checks they did not: hiding
    // `nav[aria-label="Primary"]` outright left THIS story passing. An element
    // hidden by a CSS class still matches `querySelector`.
    for (const selector of [
      '[data-slot="dashboard-top-bar"]',
      'nav[aria-label="Primary"]',
      '[data-slot="sidebar"]',
    ]) {
      await expect(canvasElement.querySelector(selector)).toBeVisible();
    }
    // The command palette opener lives in the bar at every width.
    await expect(canvasElement.querySelector('[data-slot="command-trigger"]')).toBeVisible();
    // The skip link points at the one main landmark, and that landmark is a
    // real focus target. `toHaveAttribute` reads the ATTRIBUTE — the tabIndex
    // IDL getter answers -1 for a plain <main> whether or not it is set.
    const skip = canvasElement.querySelector('[data-slot="skip-link"]');
    await expect(skip).toBeInTheDocument();
    await expect(skip).toHaveAttribute("href", "#main-content");
    await expect(canvasElement.querySelectorAll("main")).toHaveLength(1);
    const main = canvasElement.querySelector("main#main-content");
    await expect(main).toBeInTheDocument();
    await expect(main).toHaveAttribute("tabindex", "-1");
    // `emptyContent` hands the screen slot back to the consumer: the shell
    // still paints its own scroll port, but nothing is inside it.
    await expect(
      canvasElement.querySelector('[data-slot="dashboard-shell-content"]'),
    ).toBeEmptyDOMElement();
  },
};

/**
 * The icon rail: labels clipped away, accessible names and sub-routes intact.
 */
export const Collapsed: Story = {
  render: () => <DashboardShell activePath="/" defaultSidebarOpen={false} />,
  play: async ({ canvasElement }) => {
    // Assert the rail is ACTUALLY collapsed first — `data-collapsible` is only
    // written while collapsed, so it is a real discriminator rather than an
    // attribute that reads the same in both states.
    const rail = canvasElement.querySelector('[data-slot="sidebar"]');
    await expect(rail).toHaveAttribute("data-state", "collapsed");
    await expect(rail).toHaveAttribute("data-collapsible", "icon");
    // Still fully navigable by name — a collapsed rail must not become a
    // column of unnamed icons.
    await expect(canvasElement.querySelector('a[href="/"]')).toHaveAccessibleName("Overview");
    await expect(canvasElement.querySelector('a[href="/orders"]')).toHaveAccessibleName("Orders");
    await expect(canvasElement.querySelector('a[href="/analytics"]')).toHaveAccessibleName(
      "Analytics",
    );
    // …including a sub-route, which the collapsed-rail mirror keeps one click
    // away. Targeted by its own slot: the expanded sub-menu anchor shares the
    // href and wins `querySelector` by DOM order.
    const mirror = canvasElement.querySelector(
      'a[data-slot="sidebar-menu-button"][href="/orders/open"]',
    );
    await expect(mirror).toBeVisible();
    await expect(mirror).toHaveAccessibleName("Open");
    // A6's closed branch, from a real collapsed render rather than a click.
    await expect(
      canvasElement.querySelector('[data-slot="sidebar-trigger"]')?.getAttribute("aria-expanded"),
    ).toBe("false");
  },
};

/**
 * A phone: the rail hands itself to a drawer, the content surface takes the
 * whole width, and the page name survives beside the control cluster.
 */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  render: () => <DashboardShell activePath="/" />,
  play: async ({ canvasElement }) => {
    // Measured under this story's own viewport global: `window.innerWidth` is
    // 320, so the shell takes its real small-screen branch.
    // The rail handed itself to a closed `Sheet`, which is portalled and
    // unmounted while closed: the docked rail is gone from the canvas.
    await expect(canvasElement.querySelector('nav[aria-label="Primary"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-slot="sidebar"]')).toBeNull();
    // …but the control that opens it is still there.
    await expect(canvasElement.querySelector('[data-slot="sidebar-trigger"]')).toBeVisible();
    // The page NAME survives the phone — the bar never becomes a row of icons
    // naming nothing.
    const title = canvasElement.querySelector('[data-slot="dashboard-top-bar-title"]');
    await expect(title).toBeVisible();
    // What stands down at this width is the pure convenience: appearance. What
    // does not is search — the one control a phone user still needs to get
    // anywhere. Asserted as rendered visibility rather than a class name, so a
    // breakpoint edit that silently reverses the pair fails here.
    await expect(canvasElement.querySelector('[data-slot="command-trigger"]')).toBeVisible();
    // `ThemeSwitcher` declares no `data-slot`, so it is addressed by the one
    // stable thing it does declare — its control's accessible name, which both
    // of its modes prefix with "Theme".
    await expect(canvasElement.querySelector('[aria-label^="Theme"]')).not.toBeVisible();

    /* A6 on the MOBILE branch, which is the one that discriminates. Below the
     * breakpoint the trigger flips `openMobile`, while the desktop `open` stays
     * true underneath — so a trigger that reported `open` would announce
     * "expanded" here, with the drawer shut and the rail not even mounted (the
     * two assertions at the top of this play). The state it reports has to be
     * read the same way the click writes it.
     */
    const trigger = canvasElement.querySelector('[data-slot="sidebar-trigger"]') as HTMLElement;
    await expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // …and "true" is genuinely reachable here, not just the desktop value being
    // suppressed. Opened, then closed again, so the story's final paint is the
    // phone at rest that its name promises.
    await userEvent.click(trigger);
    await waitFor(async () => {
      await expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
    await userEvent.keyboard("{Escape}");
    await waitFor(async () => {
      await expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
  },
};

/**
 * Nothing has arrived yet. Every region renders its own layout-shaped skeleton
 * at the size the real content will occupy, announced once per region.
 */
export const Loading: Story = {
  render: () => <DashboardShell activePath="/" loading />,
  play: async ({ canvasElement }) => {
    const activityStatus = canvasElement
      .querySelector('[data-slot="storefront-overview-activity"]')
      ?.querySelector('[role="status"]');
    await expect(activityStatus).toBeInTheDocument();
    // …and PAINTED. `toHaveTextContent` reads `textContent`, which CSS does not
    // touch, so the line below stayed green with the whole loading region set
    // to `display: none` — the skeleton state could vanish entirely and this
    // story would not notice.
    await expect(activityStatus).toBeVisible();
    await expect(activityStatus).toHaveAttribute("aria-live", "polite");
    // A placeholder that reserves no space is not a layout-shaped skeleton.
    const activityBoxes = (activityStatus as HTMLElement).querySelectorAll('[aria-hidden="true"]');
    await expect(activityBoxes.length).toBeGreaterThan(0);
    await expect((activityBoxes[0] as HTMLElement).getBoundingClientRect().height).toBeGreaterThan(
      0,
    );
    await expect(activityStatus).toHaveTextContent("Loading activity…");
    // ONE loading treatment on the screen: no real figure may be legible while
    // the rest of the page is a skeleton. Asserted as "the revenue region
    // contains no DIGIT at all" rather than as one absent fixture string — a
    // single-string check passes on a card whose heading states a percentage
    // the card is not showing, which is exactly what it used to do.
    const revenueRegion = canvasElement.querySelector('[data-slot="storefront-overview-revenue"]');
    await expect(revenueRegion).toBeInTheDocument();
    await expect(revenueRegion?.textContent ?? "").not.toMatch(/\d/);
    // …and the activity feed states no settled fact either.
    await expect(canvasElement).not.toHaveTextContent("Meridian Goods refund approved");
  },
};

/**
 * A first day, or a filter that matched nothing: each region answers for itself
 * with a real empty state — a glyph, a title, one sentence and one way onward.
 */
export const Empty: Story = {
  render: () => <DashboardShell activePath="/" metrics={[]} revenue={[]} activity={[]} />,
  play: async ({ canvas, canvasElement }) => {
    // `waitFor`, because `StatePanel` enters on `animate-in fade-in`: for the
    // first frames of its entrance the panel really is at opacity 0, so a
    // synchronous `toBeVisible()` races the animation and fails on correct
    // code. Asserting `toBeInTheDocument()` instead would dodge the race by
    // giving up the property worth locking — `getByText` already throws when
    // the node is absent, so that assertion can never fail on its own.
    await waitFor(() => expect(canvas.getByText("No activity yet")).toBeVisible());
    // An empty state that only reports absence leaves the reader on a dead end
    // — the anatomy includes exactly one way onward.
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="storefront-overview-activity"] a[href="/orders"]'),
      ).toBeVisible(),
    );
    // A metric row with no tiles renders no landmark at all: an empty region
    // announces a section that has nothing to say.
    await expect(canvasElement.querySelector('section[aria-label="Key figures"]')).toBeNull();
    // The outline must not skip a level. `StatePanel`'s title is a hard-coded
    // <h3>, and `ChartCard` renders its own title through a `CardTitle` that is
    // a <div> unless the block hands it a heading element — so the empty screen
    // is exactly where an h1 -> h3 jump appears. axe's `heading-order` catches
    // it in the a11y pass; this asserts the shape directly, so a regression
    // names its cause instead of pointing at a CSS selector.
    const levels = Array.from(canvasElement.querySelectorAll("h1, h2, h3, h4, h5, h6")).map(
      (heading) => Number(heading.tagName.slice(1)),
    );
    await expect(levels).toEqual([1, 2, 3, 2, 3]);
  },
};

/**
 * Compact density. The rail simply renders narrower — the point of the lock is
 * that its width SPACER and its fixed container still agree, because nothing in
 * the block pins a density of its own.
 */
export const CompactDensity: Story = {
  render: () => (
    // `data-density` on a wrapper, i.e. exactly how an app sets it: the
    // attribute overrides `--spacing` for the whole subtree.
    <div data-density="compact">
      <DashboardShell activePath="/" defaultSidebarOpen={false} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const rail = canvasElement.querySelector('[data-slot="sidebar"]');
    await expect(rail).toHaveAttribute("data-state", "collapsed");
    // `Sidebar` spreads `...props` onto its CONTAINER only, so a
    // `data-density` pinned on the component desynchronises the container from
    // the sibling SPACER that still reads the document density. Under
    // `collapsible=icon` + `variant=inset` the two widths differ by a designed
    // 2px and by nothing else; a pin turns that into ~4px. Measured, not
    // inferred from a class name.
    const gap = canvasElement.querySelector('[data-slot="sidebar-gap"]');
    const container = canvasElement.querySelector('[data-slot="sidebar-container"]');
    await expect(gap).toBeInTheDocument();
    await expect(container).toBeInTheDocument();
    const delta =
      (container as HTMLElement).getBoundingClientRect().width -
      (gap as HTMLElement).getBoundingClientRect().width;
    await expect(delta).toBeGreaterThanOrEqual(1.5);
    await expect(delta).toBeLessThanOrEqual(2.5);
  },
};

/**
 * The collapsed rail keeps the structure the expanded one teaches: a divider
 * stands where each group label used to be.
 */
export const CollapsedGroups: Story = {
  /* A pure REGRESSION LOCK: its `render` is byte-identical to the story named
   * above it, so in the sidebar it was a second entry showing the same screen
   * under a different name. `!dev` keeps it out of the sidebar and the docs
   * page while leaving it in the test run — the assertions below are the whole
   * point of it, and they still run in CI. */
  tags: ["!dev"],
  render: () => <DashboardShell activePath="/" defaultSidebarOpen={false} />,
  play: async ({ canvasElement }) => {
    const nav = canvasElement.querySelector('nav[aria-label="Primary"]');
    // NAV_GROUPS has two groups ("Store", "Insight"), so exactly one divider
    // stands between them — asserted as VISIBLE, since the same node is in the
    // DOM (and hidden) whenever the rail is expanded.
    const dividers = Array.from(nav?.querySelectorAll('[data-slot="sidebar-separator"]') ?? []);
    await expect(dividers).toHaveLength(1);
    for (const divider of dividers) await expect(divider).toBeVisible();
  },
};

/**
 * More than fits. Every shell in this family ships a scroll port that a fixture
 * small enough to fit never exercises — and axe's `scrollable-region-focusable`
 * only fires on a region that ACTUALLY overflows, so a shell with no overflowing
 * story has no standing check on its ports at all. That is what this story is
 * for: it is the enforcement for the whole "a scrollable region must be
 * keyboard-operable" class, and it keeps working for ports added later.
 *
 * The feed is stretched rather than the copy: 40 entries, each carrying a
 * description long enough to wrap, plus one unbroken 96-character digest with no
 * break opportunity in it — the string that finds a missing `min-w-0` or a
 * missing wrap rule.
 */
const OVERFLOW_ACTIVITY: ActivityEntry[] = Array.from({ length: 40 }, (_, index) => {
  const seed = DEMO_ACTIVITY[index % DEMO_ACTIVITY.length]!;
  return {
    ...seed,
    id: `overflow-${index}`,
    title: `${seed.title} — batch ${index + 1}`,
    description:
      index === 0
        ? "Reconciliation artifact a94f1c7e8b2d5f60c31ae47b9d02f8635c1e7a49b83d06f2e5c9147ab6d3820f is the last build before the discrepancy, and it has no break opportunity anywhere in it."
        : `${seed.description ?? "Automatic reconciliation run"} — recorded ${index + 1} events, all of which need a sentence long enough to wrap onto a second line in this column.`,
  };
});

export const OverflowingContent: Story = {
  render: () => <DashboardShell activePath="/" activity={OVERFLOW_ACTIVITY} />,
  play: async ({ canvasElement }) => {
    const port = canvasElement.querySelector(
      '[data-slot="dashboard-shell-content"]',
    ) as HTMLElement;
    await expect(port).toBeVisible();

    /* The PREMISE, measured. Everything below — and the axe rule this story
     * exists to arm — is meaningless unless the port really overflows. A
     * fixture that quietly shrinks back under the fold would leave a green
     * story documenting nothing, which is the failure mode this whole file has
     * been bitten by. Asserted as a gap, not as a boolean, so the message names
     * how far short it fell.
     */
    await expect(port.clientHeight).toBeGreaterThan(0);
    await expect(
      `content overflows by ${Math.max(0, port.scrollHeight - port.clientHeight)}px`,
    ).not.toBe("content overflows by 0px");

    // …and it is reachable with a keyboard. The port has focusable descendants
    // today, so axe would stay quiet either way — the explicit lock is what
    // survives a refactor that leaves the region without one.
    await expect(port.getAttribute("tabindex")).toBe("0");
    await expect(port.classList.contains("focus-ring-inset")).toBe(true);
    await expect(port.classList.contains("focus-ring")).toBe(false);
    port.focus();
    await expect(document.activeElement).toBe(port);

    // Vertically it scrolls; horizontally nothing may spill. 1px of tolerance
    // for a fractional device ratio rounding a layout width up.
    await expect(`spill=${Math.max(0, port.scrollWidth - port.clientWidth - 1)}`).toBe("spill=0");
  },
};
