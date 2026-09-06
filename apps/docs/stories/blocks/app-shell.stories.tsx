import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import AppShellPage from "@/components/app-shell/app-shell-page";

const meta = {
  title: "Layout/App Shell/Flagship",
  tags: ["autodocs"],
  // The top bar's <ThemeSwitcher /> reads the @elabs-ai/components-tokens React
  // context, so the screen needs a real provider — the global preview decorator
  // only writes the `data-theme` attribute. In a consuming app this sits at the
  // root. It mounts DEEPER than the preview's own theme boundary, so a
  // `STORYBOOK_THEME=<slug>` sweep still wins (child effects flush first).
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The four-zone flagship shell: a collapsible nav rail, a records column, the content pane and a details rail that rests collapsed. Reach for it when a screen needs a second column of records between navigation and content — a mail-style list, a work queue, a review pipeline. When the whole product fits in one navigation tree and the screen is a briefing rather than a queue, reach for `Layout/App Shell/Dashboard` instead.",
      },
    },
  },
} satisfies Meta<typeof AppShellPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The believable screen: four zones, a real operations console in the content
 * pane, the details rail resting collapsed the way an app ships it.
 */
export const Default: Story = {
  render: () => <AppShellPage activePath="/" />,
  play: async ({ canvasElement }) => {
    /* The zone census, and the only place in this file that asserts the
     * flagship's whole frame is PAINTED. It had no play function at all, which
     * meant the block every consumer copies had its headline story assert
     * nothing whatsoever.
     *
     * `toBeVisible()` on every zone, never `toBeInTheDocument()`: an element
     * hidden by a CSS class still matches `querySelector` and still resolves
     * through `getByRole`, so a presence assertion survives the whole zone
     * being switched off. That is not hypothetical here — the sibling mail
     * shell shipped with its middle zone computing `display: none` past a file
     * full of presence assertions.
     */
    for (const [selector, zone] of [
      ['[data-slot="app-top-bar"]', "top bar"],
      ['nav[aria-label="Primary"]', "nav rail"],
      ['[data-slot="app-list-column"]', "list column"],
      ['[data-slot="context-rail"]', "context rail"],
      ['[data-slot="app-shell-content"]', "content pane"],
    ] as const) {
      const el = canvasElement.querySelector(selector);
      await expect(el, `${zone} is missing`).toBeInTheDocument();
      await expect(el, `${zone} is not painted`).toBeVisible();
    }
    // A zone can also be present, painted, and squeezed to nothing — the
    // failure mode the phone story already measures on the title. The list
    // column is the zone with a fixed width to lose.
    const list = canvasElement.querySelector('[data-slot="app-list-column"]') as HTMLElement;
    await expect(list.getBoundingClientRect().width).toBeGreaterThan(120);
    // And the content pane really holds the console, rather than the frame
    // rendering around an empty slot.
    await expect(
      canvasElement.querySelector('[data-slot="app-shell-content"]'),
    ).not.toBeEmptyDOMElement();
  },
};

/** A nested route lights its parent nav entry; an unrelated one stays dark. */
export const ActivePathMatching: Story = {
  render: () => <AppShellPage activePath="/runs/42" />,
  play: async ({ canvasElement }) => {
    const runs = canvasElement.querySelector('a[href="/runs"]') as HTMLElement;
    const overview = canvasElement.querySelector('a[href="/"]') as HTMLElement;
    // Painted first. `data-active` on an entry nobody can see is a lit lamp in
    // a closed room, and the attribute reads identically either way.
    await expect(runs).toBeVisible();
    await expect(overview).toBeVisible();
    // A nested route keeps its parent lit; an unrelated one does not.
    await expect(runs).toHaveAttribute("data-active", "true");
    await expect(overview).toHaveAttribute("data-active", "false");
    // Depth 2, so the trail earns its row — one crumb would be a page title
    // wearing a separator.
    await expect(canvasElement.querySelector('nav[aria-label="breadcrumb"]')).toBeVisible();
  },
};

/**
 * Chrome only: every zone present, the content slot empty. The lock is the
 * FRAME — top bar, nav rail, list column and context rail all mounted — so a
 * later refactor that quietly drops a zone fails here rather than in review.
 */
export const Frame: Story = {
  render: () => <AppShellPage activePath="/" emptyContent />,
  play: async ({ canvasElement }) => {
    // `toBeVisible()`, not `toBeInTheDocument()`. These four lines are the
    // whole point of the story — "a later refactor that quietly drops a zone
    // fails here" — and as presence checks they did not do it: hiding the
    // entire list zone left this file `8 passed (8)`.
    for (const selector of [
      '[data-slot="app-top-bar"]',
      'nav[aria-label="Primary"]',
      '[data-slot="app-list-column"]',
      '[data-slot="context-rail"]',
    ]) {
      await expect(canvasElement.querySelector(selector)).toBeVisible();
    }
    // `emptyContent` hands the screen slot back to the consumer: the shell
    // still paints its own scroll port, but nothing is inside it.
    await expect(
      canvasElement.querySelector('[data-slot="app-shell-content"]'),
    ).toBeEmptyDOMElement();
    /* The skip link and the landmark it claims. The dashboard shell has locked
     * this since it was written; the flagship — the block every consumer copies
     * — did not, so deleting BOTH `<SkipLink />` and `id="main-content"` left
     * this whole file green.
     *
     * Modelled on `sidebar-02`'s `Frame`, with one deliberate difference. The
     * sibling hard-codes `"#main-content"` on the link and `"main#main-content"`
     * on the landmark, which locks a STRING in two places; this resolves the
     * fragment the link actually carries and asserts that the single `<main>`
     * is the element it points at. The relationship is the accessibility
     * property — a consumer who renames the id on both sides has broken
     * nothing, and should not have to edit a test to say so.
     */
    const skip = canvasElement.querySelector('[data-slot="skip-link"]');
    await expect(skip).toBeInTheDocument();
    // No visibility assertion: a skip link is `sr-only` until focused, which
    // this runner correctly reports as not visible.
    const target = (skip?.getAttribute("href") ?? "").replace(/^#/, "");
    await expect(target).not.toBe("");
    // Exactly one main landmark. Two would make "skip to main content"
    // ambiguous; zero would make it a dead link.
    await expect(canvasElement.querySelectorAll("main")).toHaveLength(1);
    const main = canvasElement.querySelector("main") as HTMLElement;
    await expect(main.id).toBe(target);
    // …and focus can actually land there. `toHaveAttribute`, not the `tabIndex`
    // IDL getter, which answers -1 for a plain <main> either way.
    await expect(main).toHaveAttribute("tabindex", "-1");

    // Depth 1 — the bar shows a page name, not a one-item trail.
    await expect(canvasElement.querySelector('nav[aria-label="breadcrumb"]')).toBeNull();
  },
};

/** The icon rail: labels gone, tooltips and accessible names intact. */
export const Collapsed: Story = {
  render: () => <AppShellPage activePath="/" defaultNavOpen={false} />,
  play: async ({ canvasElement }) => {
    // Assert the rail is ACTUALLY collapsed first — without this the two name
    // assertions below pass in the expanded state too and lock nothing.
    await expect(canvasElement.querySelector('[data-nav="collapsed"]')).toBeInTheDocument();
    // The rail is still fully navigable by name — the collapsed state must not
    // become a column of unnamed icons.
    await expect(canvasElement.querySelector('a[href="/runs"]')).toHaveAccessibleName("Runs");
    // …including the sub-route, which the collapsed-rail mirror keeps reachable.
    // Two anchors carry this href — the sub-menu entry (hidden under
    // `collapsible=icon`) and the mirror — and `querySelector` returns the
    // HIDDEN one, whose accessible name is empty because it is `display:none`.
    // So the lock targets the mirror by its own slot, and asserts the pair
    // really does swap: exactly one copy is on screen at a time.
    const mirror = canvasElement.querySelector(
      'a[data-slot="sidebar-menu-button"][href="/runs/active"]',
    );
    await expect(mirror).toBeVisible();
    await expect(mirror).toHaveAccessibleName("Active");
    await expect(canvasElement.querySelector('[data-slot="sidebar-menu-sub"]')).not.toBeVisible();
  },
};

/** The right-hand rail open on its first section. */
export const ContextRailOpen: Story = {
  render: () => <AppShellPage activePath="/runs" defaultContextOpen />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-context="expanded"]')).toBeInTheDocument();
    // `toBeVisible`, NOT `toHaveTextContent`. The heading STAYS IN THE DOM when
    // the rail is closed (`ContextRail` only hides it with
    // `group-data-[collapsible=icon]:hidden`), and `toHaveTextContent` reads
    // `textContent`, which CSS does not touch — so the text assertion passed
    // just as happily with the rail shut and locked nothing. Visibility is the
    // property that actually differs between the two states. The text is still
    // worth pinning, so it is asserted separately rather than instead.
    const heading = canvasElement.querySelector('[data-slot="context-rail-heading"]');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveTextContent("Details");
    // Positive control for `Narrow`'s discriminator: docked, the rail's root
    // nests INSIDE a `Sidebar`. The overlay branch mounts none, which is what
    // that story asserts — so the two locks only mean something together.
    await expect(
      canvasElement.querySelector('[data-slot="context-rail"]')?.closest('[data-slot="sidebar"]'),
    ).not.toBeNull();
  },
};

/**
 * A phone: every zone that cannot be a column stands down. The nav rail becomes
 * a drawer, the list column yields its width entirely, and the details rail is
 * a 48px strip whose body opens as a slide-over.
 */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  render: () => <AppShellPage activePath="/runs" />,
  play: async ({ canvasElement }) => {
    // Measured under this story's own viewport global: `window.innerWidth` is
    // 320, so the shell's zones take their real small-screen branches — the
    // assertions below lock those branches, not a simulated width.
    const rail = canvasElement.querySelector('[data-slot="context-rail"]');
    await expect(rail).toBeInTheDocument();
    // The rail's overlay branch mounts NO `Sidebar` — the docked branch nests
    // its root inside one, so this is what tells the two apart.
    await expect(rail?.closest('[data-slot="sidebar"]')).toBeNull();
    // The nav rail handed itself to a closed `Sheet`, which is portalled and
    // unmounted while closed: the docked `<nav>` is gone from the canvas.
    await expect(canvasElement.querySelector('nav[aria-label="Primary"]')).toBeNull();
    // The optional third zone is present but takes no width at this size.
    await expect(canvasElement.querySelector('[data-slot="app-list-column"]')).not.toBeVisible();
    // The page NAME survives the phone. The trailing control cluster is five
    // fixed-width buttons; without `shrink-0` on it and `flex-1` on the title,
    // 320px of bar went entirely to icons and the title measured 2px wide — a
    // row of chrome naming no page. Measured, not asserted from a class name.
    const title = canvasElement.querySelector('[data-slot="app-top-bar-title"]');
    await expect(title).toBeVisible();
    await expect(title!.getBoundingClientRect().width).toBeGreaterThan(40);
  },
};

/**
 * Nothing has arrived yet. Every zone renders its own layout-shaped skeleton at
 * the size the real content will occupy, so the screen never collapses and then
 * expands under the reader.
 */
export const Loading: Story = {
  render: () => <AppShellPage activePath="/" loading />,
  play: async ({ canvasElement }) => {
    const listStatus = canvasElement
      .querySelector('[data-slot="app-list-column"]')
      ?.querySelector('[role="status"]');
    await expect(listStatus).toBeInTheDocument();
    // …and PAINTED. `toHaveTextContent` reads `textContent`, which CSS does not
    // touch, so the line below passed with the whole loading region set to
    // `display: none` — the entire skeleton state could vanish and this story
    // stayed green. This is the assertion that asks the browser.
    await expect(listStatus).toBeVisible();
    await expect(listStatus).toHaveAttribute("aria-live", "polite");
    // A skeleton that reserves no space is not a layout-shaped skeleton: the
    // real row is meant to land in the box that is already there.
    const listBoxes = (listStatus as HTMLElement).querySelectorAll('[aria-hidden="true"]');
    await expect(listBoxes.length).toBeGreaterThan(0);
    await expect((listBoxes[0] as HTMLElement).getBoundingClientRect().height).toBeGreaterThan(0);
    // The content pane announces its own wait, in its own region — one live
    // region per zone rather than one for the screen.
    const activityStatus = canvasElement
      .querySelector('[data-slot="app-shell-content"]')
      ?.querySelector('[role="status"]');
    await expect(activityStatus).toBeInTheDocument();
    await expect(activityStatus).toBeVisible();
    // Announced once per region, not once per skeleton box.
    await expect(listStatus).toHaveTextContent("Loading pipelines…");
    // ONE loading treatment on the screen. `DataTable` draws skeleton rows only
    // when it has no rows; handed the fixture it instead spins over legible real
    // figures, so the same screen showed blank skeletons in two regions and
    // readable data in a third. No fixture run id may be on screen while the
    // page is loading.
    await expect(canvasElement).not.toHaveTextContent("run-4818");
  },
};

/**
 * A first run, or a filter that matched nothing: each list answers for itself
 * with a real empty state — a title, one sentence, and no broken chrome.
 */
export const Empty: Story = {
  render: () => <AppShellPage activePath="/" pipelines={[]} metrics={[]} runs={[]} activity={[]} />,
  play: async ({ canvas }) => {
    // `waitFor` because `StatePanel` fades in — mid-animation it is genuinely
    // part-transparent, so a bare `toBeVisible()` races the first frame.
    // Visible rather than merely present: an empty state nobody can see is the
    // "broken chunk of UI for `[]`" this story exists to forbid.
    await waitFor(async () => {
      await expect(canvas.getByText("No pipelines yet")).toBeVisible();
    });
    await waitFor(async () => {
      await expect(canvas.getByText("Nothing happened overnight")).toBeVisible();
    });
  },
};

/**
 * Just above the `md` boundary. The flagship's list zone is painted by a single
 * `md:flex` (its base class is `hidden`), and until now every story in this file
 * sat at 320px or 1200px — both far from 768px, and on opposite sides of it. So
 * sliding that one breakpoint to `lg:` would have folded the list zone away for
 * every reader between 768px and 1023px with nothing here noticing.
 *
 * 800px is inside the window the slide would break, and close enough to the
 * boundary that a breakpoint moved by one step lands on the wrong side of it.
 */
export const JustAboveTheBreakpoint: Story = {
  parameters: {
    viewport: {
      options: {
        justAboveMd: { name: "Just above md (800px)", styles: { width: "800px", height: "900px" } },
      },
    },
  },
  globals: { viewport: { value: "justAboveMd", isRotated: false } },
  render: () => <AppShellPage activePath="/" />,
  play: async ({ canvasElement }) => {
    // The premise, measured. If the viewport global silently stopped applying,
    // every assertion below would be re-measuring the 1200px branch under a
    // name that says otherwise — so the width is asserted, not assumed.
    await expect(window.innerWidth).toBeGreaterThanOrEqual(768);
    await expect(window.innerWidth).toBeLessThan(1024);
    await expect(window.matchMedia("(min-width: 48rem)").matches).toBe(true);
    await expect(window.matchMedia("(min-width: 64rem)").matches).toBe(false);

    // The desktop claim, at the width nothing else in this file covers: the
    // list zone is painted and has real width here, exactly as it does at
    // 1200px.
    const list = canvasElement.querySelector('[data-slot="app-list-column"]') as HTMLElement;
    await expect(list).toBeVisible();
    await expect(list.getBoundingClientRect().width).toBeGreaterThan(120);
    await expect(canvasElement.querySelector('[data-slot="app-top-bar"]')).toBeVisible();
    await expect(canvasElement.querySelector('nav[aria-label="Primary"]')).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="app-shell-content"]')).toBeVisible();
  },
};
