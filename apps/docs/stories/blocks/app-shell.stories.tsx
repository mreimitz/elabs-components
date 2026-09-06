import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import AppShellPage from "@/components/app-shell/app-shell-page";
import { AppTopBar } from "@/components/app-shell/app-top-bar";
import {
  DEMO_ACTIVITY,
  DEMO_RUNS,
  type ActivityEntry,
  type RunRow,
} from "@/components/app-shell/console-overview";

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
          "The default shape this library recommends, and a direct port of the shell the elabs AI Workbench ships: a collapsible navigation rail, a flush full-bleed content column, and a summoned assistant dock on the right. Reach for it for almost any internal app. When a screen needs a second column of records between navigation and content — a mail-style list, a work queue — reach for `Layout/App Shell/Mail`, which is built for that. When the right-hand panel should be permanent furniture rather than something you summon, reach for `Layout/App Shell/Dashboard`, which uses `ContextRail`.",
      },
    },
  },
} satisfies Meta<typeof AppShellPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The believable screen: nav rail, a real operations console in a flush content
 * column, and the assistant dock resting closed the way an app ships it.
 */
export const Default: Story = {
  render: () => <AppShellPage activePath="/" />,
  play: async ({ canvasElement }) => {
    /* The zone census, and the only place in this file that asserts the shell's
     * whole frame is PAINTED.
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
      ['[data-slot="app-shell-content"]', "content pane"],
    ] as const) {
      const el = canvasElement.querySelector(selector);
      await expect(el, `${zone} is missing`).toBeInTheDocument();
      await expect(el, `${zone} is not painted`).toBeVisible();
    }

    /* The content surface is FLUSH — the single defining visual decision of
     * this shell, and the one a copier is most likely to undo by reaching for
     * `variant="inset"` on the provider. Measured on the painted box, because
     * that is what a reader sees: `<main>` starts where the rail ends and runs
     * to the window edge, with no radius and no gutter. Read off a class name
     * instead and the assertion survives a provider-level `variant` that
     * re-rounds the card from an ancestor selector.
     */
    const main = canvasElement.querySelector("main") as HTMLElement;
    const rail = canvasElement.querySelector('[data-slot="sidebar"]') as HTMLElement;
    const mainBox = main.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    await expect(`gap=${Math.round(Math.max(0, mainBox.left - railBox.right))}`).toBe("gap=0");
    const radius = getComputedStyle(main).borderTopLeftRadius;
    await expect(`main radius: ${parseFloat(radius) > 0 ? "rounded" : "square"}`).toBe(
      "main radius: square",
    );

    // And the content pane really holds the console, rather than the frame
    // rendering around an empty slot.
    await expect(
      canvasElement.querySelector('[data-slot="app-shell-content"]'),
    ).not.toBeEmptyDOMElement();

    /* The dock is SUMMONED, so at rest it takes no LAYOUT width. Measured on
     * the SPACER, not on the container: `SideDock` positions its container
     * `fixed` and slides it off the edge, exactly as `Sidebar` does, so the
     * container keeps its own 400px box the whole time and measuring it would
     * assert nothing. The spacer is the flex participant — the element that
     * actually hands the width back to the content column, which is the
     * property that distinguishes a dock from a permanent icon strip.
     *
     * Presence is asserted separately because `SideDock` keeps the container
     * mounted (inert) through the closing transition, so "not in the document"
     * would be wrong.
     */
    const dock = canvasElement.querySelector('[data-slot="side-dock-container"]') as HTMLElement;
    await expect(dock).toBeInTheDocument();
    const dockSpacer = canvasElement.querySelector('[data-slot="side-dock-spacer"]') as HTMLElement;
    await waitFor(async () => {
      await expect(
        `closed dock width=${Math.round(dockSpacer.getBoundingClientRect().width)}`,
      ).toBe("closed dock width=0");
    });

    /* Both toggles expose disclosure STATE, not only a mutating name. Read with
     * `getAttribute`, never `toHaveAttribute("aria-expanded")` alone: "attribute
     * absent" and `aria-expanded="false"` are different states to AT, and only
     * the string comparison tells them apart.
     */
    const bar = within(canvasElement.querySelector('[data-slot="app-top-bar"]') as HTMLElement);
    const navToggle = bar.getByRole("button", { name: "Collapse navigation" });
    const dockToggle = bar.getByRole("button", { name: "Show the assistant" });
    await expect(navToggle.getAttribute("aria-expanded")).toBe("true");
    await expect(dockToggle.getAttribute("aria-expanded")).toBe("false");

    // …and the attribute really TRACKS the zone rather than being a constant
    // that happens to read true here. Clicking twice returns the shell to the
    // state this story's name promises, so the final paint still matches.
    await userEvent.click(navToggle);
    await waitFor(async () => {
      await expect(
        bar.getByRole("button", { name: "Expand navigation" }).getAttribute("aria-expanded"),
      ).toBe("false");
    });
    await userEvent.click(bar.getByRole("button", { name: "Expand navigation" }));
    await waitFor(async () => {
      await expect(
        bar.getByRole("button", { name: "Collapse navigation" }).getAttribute("aria-expanded"),
      ).toBe("true");
    });

    /* The notifications affordance is the working component the three sibling
     * shells render, not an inert `IconButton` + decorative dot. Existence alone
     * is NOT the lock (a dead button exists too): the trigger must open a menu
     * with real entries.
     */
    const bell = bar.getByRole("button", { name: "Open notifications" });
    await expect(bell).toHaveAttribute("aria-haspopup", "menu");
    await userEvent.click(bell);
    // Portalled to <body>, so it is outside `canvasElement` by construction.
    const menu = await screen.findByRole("menu");
    await expect(within(menu).getAllByRole("menuitem").length).toBeGreaterThan(1);
    // Close it again: this story is the shell at rest, and a hanging menu would
    // make the screenshot disagree with the name.
    await userEvent.keyboard("{Escape}");
    await waitFor(async () => {
      await expect(screen.queryByRole("menu")).toBeNull();
    });

    // The Help button is GONE unless a consumer wires it (`onHelp`). It used to
    // render always, take focus, show a pointer cursor and do nothing.
    await expect(bar.queryByRole("button", { name: "Help and documentation" })).toBeNull();
  },
};

/**
 * The library's own brand mark in the rail header — `AppIcon`, not a stock
 * glyph. This is the lock for that: every shell in this family renders the
 * repo's brand component, so a re-brand is a token change and never an edit to
 * four blocks.
 */
export const BrandMark: Story = {
  render: () => <AppShellPage activePath="/" />,
  play: async ({ canvasElement }) => {
    const mark = canvasElement.querySelector('[data-slot="app-icon"]');
    await expect(mark, "the rail header renders no AppIcon").toBeInTheDocument();
    await expect(mark).toBeVisible();
    // It renders the real mark, not an empty wrapper: `AppIcon` composes
    // `BrandLogo`, so an <svg> under it is what proves the glyph arrived.
    await expect(mark!.querySelector("svg")).toBeInTheDocument();
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
 * FRAME — top bar and nav rail mounted, the single `<main>` landmark reachable
 * from the skip link — so a later refactor that quietly drops one fails here
 * rather than in review.
 */
export const Frame: Story = {
  render: () => <AppShellPage activePath="/" emptyContent />,
  play: async ({ canvasElement }) => {
    // `toBeVisible()`, not `toBeInTheDocument()`. These lines are the whole
    // point of the story — "a later refactor that quietly drops a zone fails
    // here" — and as presence checks they did not do it.
    for (const selector of ['[data-slot="app-top-bar"]', 'nav[aria-label="Primary"]']) {
      await expect(canvasElement.querySelector(selector)).toBeVisible();
    }
    /* `emptyContent` hands the screen slot back to the consumer: the shell
     * still paints its own scroll port, and what sits in it is a LABELLED
     * placeholder rather than nothing at all — a canvas rendering literally
     * nothing under the top bar reads as a broken screen. The lock is that the
     * port holds the placeholder and NOTHING of the real screen.
     */
    const port = canvasElement.querySelector('[data-slot="app-shell-content"]') as HTMLElement;
    const placeholder = port.querySelector(
      '[data-slot="app-shell-content-placeholder"]',
    ) as HTMLElement;
    await expect(placeholder).toBeVisible();
    await expect(port.children).toHaveLength(1);
    await expect(port.querySelector('[data-slot="console-overview"]')).toBeNull();
    /* The skip link and the landmark it claims. This resolves the fragment the
     * link actually carries and asserts that the single `<main>` is the element
     * it points at — the relationship is the accessibility property, so a
     * consumer who renames the id on both sides has broken nothing.
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

    /* The dock's `aside` is a SIBLING of `<main>`, never a descendant of it. A
     * complementary landmark nested inside the main landmark is the defect this
     * locks, and it is invisible on screen — only the tree shows it.
     */
    const dockAside = canvasElement.querySelector('[data-slot="side-dock-container"]');
    await expect(dockAside).toBeInTheDocument();
    await expect(main.contains(dockAside)).toBe(false);

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
    // The other branch of the disclosure contract, from a real collapsed render
    // rather than a click. Paired with `Default`'s `"true"`, neither assertion
    // can be satisfied by a constant.
    const bar = within(canvasElement.querySelector('[data-slot="app-top-bar"]') as HTMLElement);
    await expect(
      bar.getByRole("button", { name: "Expand navigation" }).getAttribute("aria-expanded"),
    ).toBe("false");
  },
};

/**
 * The assistant dock summoned. It takes real width from the content column and
 * gives it all back when dismissed — the mechanic that makes it a dock rather
 * than permanent furniture.
 */
export const DockOpen: Story = {
  render: () => <AppShellPage activePath="/runs" defaultDockOpen />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-dock="open"]')).toBeInTheDocument();
    const dock = canvasElement.querySelector('[data-slot="side-dock-container"]') as HTMLElement;
    await expect(dock).toBeVisible();
    /* Real LAYOUT width, measured on the spacer — the flex participant, not the
     * `fixed` container, which keeps its own box in both states (see `Default`).
     * A dock that "opened" without taking any room from the content column
     * would still satisfy a visibility check on the container.
     */
    const dockSpacer = canvasElement.querySelector('[data-slot="side-dock-spacer"]') as HTMLElement;
    await waitFor(async () => {
      await expect(
        `open dock width ${dockSpacer.getBoundingClientRect().width > 200 ? "ok" : "too narrow"}`,
      ).toBe("open dock width ok");
    });
    // It is a real complementary landmark with a real name, not an unnamed box.
    await expect(dock.tagName.toLowerCase()).toBe("aside");
    await expect(dock).toHaveAccessibleName("Assistant");
    // Open means INTERACTIVE. `SideDock` marks the closed container `inert`, so
    // this is the property that separates "painted" from "reachable".
    await expect(dock.hasAttribute("inert")).toBe(false);

    const bar = within(canvasElement.querySelector('[data-slot="app-top-bar"]') as HTMLElement);
    await expect(
      bar.getByRole("button", { name: "Hide the assistant" }).getAttribute("aria-expanded"),
    ).toBe("true");
  },
};

/**
 * Dismissing the dock hands its width back to the content column. This is the
 * whole difference from the `ContextRail` pattern the dashboard uses, so it is
 * measured rather than implied.
 *
 * A SEPARATE story, not the tail of `DockOpen` — and that separation is the
 * point. A play function that ends by closing the dock leaves the story showing
 * a CLOSED dock the moment autoplay finishes, so `DockOpen` screenshots, previews
 * and renders as its own opposite. The assertion is worth keeping; it just may
 * not run inside the story whose name promises the open state. `!dev` keeps this
 * lock out of the sidebar while leaving it in the test run.
 */
export const DockDismissed: Story = {
  tags: ["!dev"],
  render: () => <AppShellPage activePath="/runs" defaultDockOpen />,
  play: async ({ canvasElement }) => {
    const dock = canvasElement.querySelector('[data-slot="side-dock-container"]') as HTMLElement;
    const dockSpacer = canvasElement.querySelector('[data-slot="side-dock-spacer"]') as HTMLElement;
    await waitFor(async () => {
      await expect(
        `open dock width ${dockSpacer.getBoundingClientRect().width > 200 ? "ok" : "too narrow"}`,
      ).toBe("open dock width ok");
    });
    await userEvent.click(within(dock).getByRole("button", { name: /close/i }));
    await waitFor(async () => {
      await expect(
        `dismissed dock width=${Math.round(dockSpacer.getBoundingClientRect().width)}`,
      ).toBe("dismissed dock width=0");
    });
  },
};

/**
 * A phone: the nav rail becomes a drawer and the dock hands its body to an
 * overlay instead of a column, so the content column never has to share a
 * 320px viewport with either.
 */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  render: () => <AppShellPage activePath="/runs" />,
  play: async ({ canvasElement }) => {
    // Measured under this story's own viewport global: `window.innerWidth` is
    // 320, so the shell's zones take their real small-screen branches — the
    // assertions below lock those branches, not a simulated width.
    await expect(window.innerWidth).toBeLessThan(768);
    // The nav rail handed itself to a closed `Sheet`, which is portalled and
    // unmounted while closed: the docked `<nav>` is gone from the canvas.
    await expect(canvasElement.querySelector('nav[aria-label="Primary"]')).toBeNull();
    /* The dock is BELOW its own overlay breakpoint (1100, deliberately above
     * the library's 768px mobile one), so it mounts no column here at all — its
     * body arrives as a `Sheet` when summoned. The toggle stays, because the
     * surface is still reachable; what is gone is the column that would have
     * eaten the viewport.
     */
    await expect(canvasElement.querySelector('[data-slot="side-dock-container"]')).toBeNull();
    const bar = within(canvasElement.querySelector('[data-slot="app-top-bar"]') as HTMLElement);
    await expect(bar.getByRole("button", { name: "Show the assistant" })).toBeVisible();

    // The page NAME survives the phone. The trailing control cluster is
    // fixed-width buttons; without `shrink-0` on it and `flex-1` on the title,
    // 320px of bar went entirely to icons and the title measured 2px wide — a
    // row of chrome naming no page. Measured, not asserted from a class name.
    const title = canvasElement.querySelector('[data-slot="app-top-bar-title"]');
    await expect(title).toBeVisible();
    await expect(title!.getBoundingClientRect().width).toBeGreaterThan(40);

    /* KPI labels degrade by ELLIPSIS, never by a hard mid-word clip. The label
     * was a flex child with the default `min-width: auto` inside a `Card` that
     * clips its overflow, so "Awaiting approval" rendered as "Awaiting approva"
     * — characters simply gone. The repair is `min-w-0 truncate` plus a
     * `title`, so the two things asserted here are its two halves: the text can
     * shorten, and the full text stays available.
     */
    const kpiLabels = canvasElement.querySelectorAll<HTMLElement>(
      'section[aria-label="Key figures"] span[title]',
    );
    await expect(kpiLabels.length).toBeGreaterThan(1);
    for (const label of kpiLabels) {
      await expect(getComputedStyle(label).textOverflow).toBe("ellipsis");
      await expect(label.title).toBe(label.textContent);
    }
  },
};

/**
 * Nothing has arrived yet. Every region renders its own layout-shaped skeleton
 * at the size the real content will occupy, so the screen never collapses and
 * then expands under the reader.
 */
export const Loading: Story = {
  render: () => <AppShellPage activePath="/" loading />,
  play: async ({ canvasElement }) => {
    // The content pane announces its own wait, in its own region — one live
    // region per region rather than one for the screen.
    const status = canvasElement
      .querySelector('[data-slot="app-shell-content"]')
      ?.querySelector('[role="status"]');
    await expect(status).toBeInTheDocument();
    // …and PAINTED. `toHaveTextContent` reads `textContent`, which CSS does not
    // touch, so a text-only assertion passes with the whole loading region set
    // to `display: none`. This is the assertion that asks the browser.
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute("aria-live", "polite");
    // A skeleton that reserves no space is not a layout-shaped skeleton: the
    // real row is meant to land in the box that is already there.
    const boxes = (status as HTMLElement).querySelectorAll('[aria-hidden="true"]');
    await expect(boxes.length).toBeGreaterThan(0);
    await expect((boxes[0] as HTMLElement).getBoundingClientRect().height).toBeGreaterThan(0);
    // ONE loading treatment on the screen. `DataTable` draws skeleton rows only
    // when it has no rows; handed the fixture it instead spins over legible real
    // figures. No fixture run id may be on screen while the page is loading.
    await expect(canvasElement).not.toHaveTextContent("run-4818");
  },
};

/**
 * A first run, or a filter that matched nothing: each region answers for itself
 * with a real empty state — a title, one sentence, and no broken chrome.
 */
export const Empty: Story = {
  render: () => <AppShellPage activePath="/" metrics={[]} runs={[]} activity={[]} />,
  play: async ({ canvas }) => {
    // `waitFor` because `StatePanel` fades in — mid-animation it is genuinely
    // part-transparent, so a bare `toBeVisible()` races the first frame.
    await waitFor(async () => {
      await expect(canvas.getByText("Nothing happened overnight")).toBeVisible();
    });
  },
};

/**
 * Just above the `md` boundary. Every other story in this file sits at 320px or
 * 1200px — both far from 768px, and on opposite sides of it — so a breakpoint
 * slid by one step would fold a zone away for every reader between 768px and
 * 1023px with nothing here noticing.
 *
 * 800px is also the width the OLD four-zone flagship could not serve: nav rail
 * (256px) + list column (280px) + rail strip (48px) left the content pane about
 * 230px, and KPI labels clipped mid-word. Two zones is the repair; this story is
 * what proves the pane keeps its room.
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

    await expect(canvasElement.querySelector('[data-slot="app-top-bar"]')).toBeVisible();
    await expect(canvasElement.querySelector('nav[aria-label="Primary"]')).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="app-shell-content"]')).toBeVisible();

    /* THE ZONE BUDGET. The nav rail stays EXPANDED here — it can afford to, now
     * that nothing else competes for the row — and the pane still has room to
     * render its own words. Measured on the painted box rather than read off a
     * class name.
     */
    const pane = canvasElement.querySelector('[data-slot="app-shell-content"]') as HTMLElement;
    await waitFor(async () => {
      await expect(
        `pane ${Math.round(pane.getBoundingClientRect().width) >= 480 ? "wide enough" : "too narrow"}`,
      ).toBe("pane wide enough");
    });

    /* …and no KPI label is clipped. `scrollWidth > clientWidth` is the DOM's own
     * answer to "does this text fit", which is the property that failed. The
     * grid asks the PANE how wide it is (a container query) rather than the
     * viewport, which is what stops a `sm:` two-column rule firing inside a
     * narrow pane.
     */
    const kpiGrid = canvasElement.querySelector<HTMLElement>(
      'section[aria-label="Key figures"]',
    ) as HTMLElement;
    const kpiTracks = getComputedStyle(kpiGrid).gridTemplateColumns;
    // `none` would mean the element queried is not the grid at all, so the read
    // is asserted against a value that proves it landed.
    await expect(kpiTracks).not.toBe("none");
    const labels = canvasElement.querySelectorAll<HTMLElement>(
      'section[aria-label="Key figures"] span[title]',
    );
    await expect(labels.length).toBeGreaterThan(1);
    for (const label of labels) {
      await expect(
        `${label.title}: ${label.scrollWidth > label.clientWidth ? "clipped" : "fits"}`,
      ).toBe(`${label.title}: fits`);
    }
  },
};

/** Spy for the story below — module scope so the render closure keeps one identity. */
const helpHandler = fn();

/**
 * The top bar in isolation with `onHelp` supplied. The Help control is opt-in
 * on purpose: it renders only when a consumer wires it, so the shipped block
 * can never hand a copier a button that takes focus and does nothing. This
 * story is what keeps the prop from becoming an unexercised API — the other
 * half of the contract `Default` locks by asserting the button's absence.
 */
export const TopBarHelpWired: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <AppTopBar
      activePath="/runs"
      navOpen
      onNavOpenChange={() => {}}
      dockOpen={false}
      onDockOpenChange={() => {}}
      onHelp={helpHandler}
    />
  ),
  play: async ({ canvasElement }) => {
    helpHandler.mockClear();
    const bar = within(canvasElement.querySelector('[data-slot="app-top-bar"]') as HTMLElement);
    const help = bar.getByRole("button", { name: "Help and documentation" });
    // Painted, not merely mounted: the control stands down below `sm`, so a
    // presence check would pass on a phone where nobody can reach it.
    await expect(help).toBeVisible();
    // …and it is WIRED. Rendering the button is the easy half; the defect this
    // replaced rendered fine and did nothing.
    await userEvent.click(help);
    await expect(helpHandler).toHaveBeenCalledTimes(1);
  },
};

/**
 * More than fits, in both scrolling ports at once. Every shell in this family
 * ships scroll ports that a fixture small enough to fit never exercises — and
 * axe's `scrollable-region-focusable` only fires on a region that ACTUALLY
 * overflows, so a shell with no overflowing story has no standing check on its
 * ports at all.
 *
 * The data is stretched, not the copy: 60 runs and 40 activity entries in the
 * console, plus one unbroken 64-character identifier with no break opportunity
 * in it — the string that finds a missing `min-w-0`.
 */
const OVERFLOW_RUNS: RunRow[] = Array.from({ length: 60 }, (_, index) => {
  const seed = DEMO_RUNS[index % DEMO_RUNS.length]!;
  return { ...seed, id: `${seed.id}-${index}`, startedAt: seed.startedAt };
});

const OVERFLOW_ACTIVITY: ActivityEntry[] = Array.from({ length: 40 }, (_, index) => {
  const seed = DEMO_ACTIVITY[index % DEMO_ACTIVITY.length]!;
  return {
    ...seed,
    id: `overflow-${index}`,
    title: `${seed.title} — batch ${index + 1}`,
    description:
      index === 0
        ? "Pinned at artifact reference orders-ingest-europe-west4-reconciliation-sweep-nightly-rollup-batch, which has no break opportunity anywhere in it."
        : `${seed.description ?? "Automatic run"} — recorded ${index + 1} events, with a sentence long enough to wrap onto a second line in this column.`,
  };
});

export const OverflowingContent: Story = {
  render: () => (
    <AppShellPage
      activePath="/"
      defaultDockOpen
      runs={OVERFLOW_RUNS}
      activity={OVERFLOW_ACTIVITY}
    />
  ),
  play: async ({ canvasElement }) => {
    const content = canvasElement.querySelector('[data-slot="app-shell-content"]') as HTMLElement;

    await expect(content, "content pane is missing").toBeInTheDocument();
    // Visible FIRST. A `display: none` element reports
    // `scrollHeight === clientHeight === 0`, so the overflow assertion below
    // would pass vacuously on a zone that had vanished.
    await expect(content, "content pane is not painted").toBeVisible();
    await expect(content.clientHeight).toBeGreaterThan(0);
    /* The PREMISE, measured. The axe rule this story exists to arm only fires
     * on a region that really overflows, so a fixture that quietly shrank back
     * under the fold would leave a green story documenting nothing. Asserted as
     * a gap rather than a boolean, so a failure names how far short it fell.
     */
    await expect(
      `content pane overflows by ${Math.max(0, content.scrollHeight - content.clientHeight)}px`,
    ).not.toBe("content pane overflows by 0px");
    // Nothing spills sideways. 1px of tolerance for a fractional device ratio
    // rounding a layout width up into `scrollWidth`.
    await expect(
      `content pane spill=${Math.max(0, content.scrollWidth - content.clientWidth - 1)}`,
    ).toBe("content pane spill=0");

    /* The content pane has no guaranteed focusable descendant, so it carries the
     * tab stop itself (WCAG 2.1.1). Read as an ATTRIBUTE: the `tabIndex` IDL
     * getter answers -1 for any non-focusable element whether or not anyone set
     * it.
     */
    await expect(content.getAttribute("tabindex")).toBe("0");
    // Inset rung, because the ancestor clips anything drawn outside the box.
    // Asserting only that `focus-ring-inset` is present would still pass with
    // both classes on the element — and then the clipped one is what paints.
    await expect(content.classList.contains("focus-ring-inset")).toBe(true);
    await expect(content.classList.contains("focus-ring")).toBe(false);
    content.focus();
    await expect(document.activeElement).toBe(content);

    // The dock's own port carries the same contract — it is user-resizable, so
    // overflow there is one keyboard gesture away rather than hypothetical.
    const dockBody = canvasElement.querySelector('[data-slot="side-dock-body"]') as HTMLElement;
    await expect(dockBody).toBeVisible();
    await expect(dockBody.getAttribute("tabindex")).toBe("0");
  },
};
