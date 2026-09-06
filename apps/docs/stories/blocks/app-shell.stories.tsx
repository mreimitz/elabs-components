import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import AppShellPage from "@/components/app-shell/app-shell-page";
import { AppTopBar } from "@/components/app-shell/app-top-bar";
import { DEMO_PIPELINES, type PipelineSummary } from "@/components/app-shell/app-list-column";
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

    /* A6 — both zone toggles expose disclosure STATE, not only a mutating
     * name. Read with `getAttribute`, never `toHaveAttribute("aria-expanded")`
     * alone: "attribute absent" and `aria-expanded="false"` are different
     * states to AT, and only the string comparison tells them apart.
     *
     * The state-carrying names stay — they are good copy — so each toggle is
     * resolved by the name it wears in THIS story's state: the nav zone is
     * open (so "Collapse navigation") and the details rail is closed (so
     * "Show the details rail").
     */
    const bar = within(canvasElement.querySelector('[data-slot="app-top-bar"]') as HTMLElement);
    const navToggle = bar.getByRole("button", { name: "Collapse navigation" });
    const railToggle = bar.getByRole("button", { name: "Show the details rail" });
    await expect(navToggle.getAttribute("aria-expanded")).toBe("true");
    await expect(railToggle.getAttribute("aria-expanded")).toBe("false");

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

    /* 1g — the notifications affordance is the working component the three
     * sibling shells render, not the inert `IconButton` + decorative dot this
     * replaced. Existence alone is NOT the lock (the dead button existed too):
     * the trigger must open a menu with real entries.
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
    /* `emptyContent` hands the screen slot back to the consumer: the shell
     * still paints its own scroll port, and what sits in it is a LABELLED
     * placeholder rather than nothing at all — a canvas rendering literally
     * nothing under the top bar reads as a broken screen, which is what this
     * story used to document. The lock is that the port holds the placeholder
     * and NOTHING of the real screen: `ConsoleOverview`'s KPI row is the first
     * thing an accidental `emptyContent` regression would put back.
     */
    const port = canvasElement.querySelector('[data-slot="app-shell-content"]') as HTMLElement;
    const placeholder = port.querySelector(
      '[data-slot="app-shell-content-placeholder"]',
    ) as HTMLElement;
    await expect(placeholder).toBeVisible();
    await expect(port.children).toHaveLength(1);
    await expect(port.querySelector('[data-slot="console-overview"]')).toBeNull();
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
    // A6's other branch, from a real collapsed render rather than a click: the
    // toggle reports the zone it actually summons. Paired with `Default`'s
    // `"true"`, neither assertion can be satisfied by a constant.
    const bar = within(canvasElement.querySelector('[data-slot="app-top-bar"]') as HTMLElement);
    await expect(
      bar.getByRole("button", { name: "Expand navigation" }).getAttribute("aria-expanded"),
    ).toBe("false");
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
    // A6 for the details-rail toggle, from the open render. `Default` locks the
    // closed one.
    const bar = within(canvasElement.querySelector('[data-slot="app-top-bar"]') as HTMLElement);
    await expect(
      bar.getByRole("button", { name: "Hide the details rail" }).getAttribute("aria-expanded"),
    ).toBe("true");
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
    /* The details rail is NOT MOUNTED at this width, and neither is its
     * toggle. `ContextRail` keeps a 48px icon strip at every width by contract
     * (ADR 0035 §3) — right for a two-zone screen, wrong as the fourth zone of
     * four on a 320px phone, where it was a dark strip over 14% of the viewport
     * with its own icon column clipped at the edge. The SHELL declines to mount
     * it; the primitive is unchanged.
     */
    await expect(canvasElement.querySelector('[data-slot="context-rail"]')).toBeNull();
    // Absent, not disabled: a toggle for a zone that is not there takes focus,
    // shows a pointer cursor and does nothing.
    const railBar = within(canvasElement.querySelector('[data-slot="app-top-bar"]') as HTMLElement);
    await expect(railBar.queryByRole("button", { name: "Show the details rail" })).toBeNull();
    await expect(railBar.queryByRole("button", { name: "Hide the details rail" })).toBeNull();
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

    /* KPI labels degrade by ELLIPSIS, never by a hard mid-word clip. The label
     * was a flex child with the default `min-width: auto` inside a `Card` that
     * clips its overflow, so "Awaiting approval" rendered as "Awaiting approva"
     * — characters simply gone, with no ellipsis and no way to recover the full
     * string. The repair is `min-w-0 truncate` plus a `title`, so the two things
     * asserted here are the two halves of it: the text can shorten, and the full
     * text stays available. The `textOverflow` check below only confirms the
     * `truncate` utility itself is applied — `text-overflow: ellipsis` is part
     * of that class and computes identically with or without `min-w-0`, so it
     * does NOT distinguish the two. The genuine `min-w-0` discriminator is
     * `JustAboveTheBreakpoint`'s `scrollWidth > clientWidth` loop below, which
     * measures whether the label's box actually fits its text. */
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

    /* THE ZONE BUDGET — the reason this story exists, and what it used to
     * document instead. At 800px the shell handed the nav rail 256px, the list
     * column 280px and the details rail a 48px strip, leaving the content pane
     * about 230px: KPI labels clipped MID-WORD with characters lost, the Failed
     * card's icon was cut in half by the card edge, and the top bar's search ran
     * under the rail. Every assertion below is one half of that repair,
     * MEASURED on the painted box rather than read off a class name.
     */
    const nav = canvasElement.querySelector('nav[aria-label="Primary"]') as HTMLElement;
    const pane = canvasElement.querySelector('[data-slot="app-shell-content"]') as HTMLElement;
    // 1. The details rail stands down below `lg`, toggle included.
    await expect(canvasElement.querySelector('[data-slot="context-rail"]')).toBeNull();
    const bar = within(canvasElement.querySelector('[data-slot="app-top-bar"]') as HTMLElement);
    await expect(bar.queryByRole("button", { name: "Show the details rail" })).toBeNull();
    /* 2. The nav rail FOLDS rather than disappearing — still painted, still
     *    named, just narrow. A collapse that removed it would satisfy a width
     *    assertion and lose the navigation, so both halves are asserted.
     *    `waitFor`, because the fold is a width TRANSITION: read synchronously,
     *    the gap element still measures its expanded 256px and this assertion
     *    passes or fails on animation timing rather than on layout. */
    const railGap = canvasElement.querySelector('[data-slot="sidebar"]') as HTMLElement;
    await waitFor(async () => {
      await expect(railGap.getAttribute("data-state")).toBe("collapsed");
      await expect(
        `nav rail ${Math.round(railGap.getBoundingClientRect().width) <= 64 ? "folded" : "still expanded"}`,
      ).toBe("nav rail folded");
    });
    await expect(nav).toBeVisible();
    await expect(
      bar.getByRole("button", { name: "Expand navigation" }).getAttribute("aria-expanded"),
    ).toBe("false");
    // 3. What the two buy: a content pane wide enough to render its own words.
    //    It used to collapse to ~230px here.
    await waitFor(async () => {
      await expect(
        `pane ${Math.round(pane.getBoundingClientRect().width) >= 400 ? "wide enough" : "too narrow"}`,
      ).toBe("pane wide enough");
    });
    // 4. …and no KPI label is clipped. `scrollWidth > clientWidth` is the DOM's
    //    own answer to "does this text fit", which is the property that failed —
    //    and it is now satisfied by fitting, not by an ellipsis: the grid asks
    //    the PANE how wide it is (a container query), so at this width it is one
    //    column of full-width tiles.
    //    The grid asks the PANE how wide it is (a container query) rather than
    //    the viewport: at a 456px pane it is ONE column of full-width tiles.
    //    Read off the viewport instead, 800px satisfies `sm:` and the same pane
    //    is cut into two ~220px tiles — which is how a 230px pane came to hold
    //    four of them side by side.
    const kpiGrid = canvasElement.querySelector<HTMLElement>(
      'section[aria-label="Key figures"]',
    ) as HTMLElement;
    const kpiTracks = getComputedStyle(kpiGrid).gridTemplateColumns;
    // `none` would mean the element queried is not the grid at all, so the
    // track count is asserted against a value that proves the read landed.
    await expect(kpiTracks).not.toBe("none");
    await expect(`KPI tracks: ${kpiTracks.split(" ").length}`).toBe("KPI tracks: 1");
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
      contextOpen={false}
      onContextOpenChange={() => {}}
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
 * More than fits, in both scrolling zones at once. Every shell in this family
 * ships scroll ports that a fixture small enough to fit never exercises — and
 * axe's `scrollable-region-focusable` only fires on a region that ACTUALLY
 * overflows, so a shell with no overflowing story has no standing check on its
 * ports at all. This story is the enforcement for that whole class, and it keeps
 * working for ports added later.
 *
 * The data is stretched, not the copy: 36 pipelines in the list column, 60 runs
 * and 40 activity entries in the console, plus one unbroken 96-character digest
 * with no break opportunity in it — the string that finds a missing `min-w-0`.
 */
const OVERFLOW_PIPELINES: PipelineSummary[] = Array.from({ length: 36 }, (_, index) => {
  const seed = DEMO_PIPELINES[index % DEMO_PIPELINES.length]!;
  return {
    ...seed,
    id: `${seed.id}-${index}`,
    name:
      index === 0
        ? "Orders ingest — europe-west4 reconciliation sweep"
        : `${seed.name} ${index + 1}`,
    runCount: seed.runCount + index,
  };
});

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
        ? "Pinned at artifact digest a94f1c7e8b2d5f60c31ae47b9d02f8635c1e7a49b83d06f2e5c9147ab6d3820f, which has no break opportunity anywhere in it."
        : `${seed.description ?? "Automatic run"} — recorded ${index + 1} events, with a sentence long enough to wrap onto a second line in this column.`,
  };
});

export const OverflowingContent: Story = {
  render: () => (
    <AppShellPage
      activePath="/"
      pipelines={OVERFLOW_PIPELINES}
      runs={OVERFLOW_RUNS}
      activity={OVERFLOW_ACTIVITY}
    />
  ),
  play: async ({ canvasElement }) => {
    const content = canvasElement.querySelector('[data-slot="app-shell-content"]') as HTMLElement;
    const list = canvasElement.querySelector(
      '[data-slot="app-list-column"] ul[class*="overflow-y-auto"]',
    ) as HTMLElement;

    for (const [port, label] of [
      [content, "content pane"],
      [list, "list column"],
    ] as const) {
      await expect(port, `${label} is missing`).toBeInTheDocument();
      // Visible FIRST. A `display: none` element reports
      // `scrollHeight === clientHeight === 0`, so the overflow assertion below
      // would pass vacuously on a zone that had vanished.
      await expect(port, `${label} is not painted`).toBeVisible();
      await expect(port.clientHeight).toBeGreaterThan(0);
      /* The PREMISE, measured. The axe rule this story exists to arm only fires
       * on a region that really overflows, so a fixture that quietly shrank back
       * under the fold would leave a green story documenting nothing. Asserted
       * as a gap rather than a boolean, so a failure names how far short it fell.
       */
      await expect(
        `${label} overflows by ${Math.max(0, port.scrollHeight - port.clientHeight)}px`,
      ).not.toBe(`${label} overflows by 0px`);
      // Nothing spills sideways. 1px of tolerance for a fractional device ratio
      // rounding a layout width up into `scrollWidth`.
      await expect(`${label} spill=${Math.max(0, port.scrollWidth - port.clientWidth - 1)}`).toBe(
        `${label} spill=0`,
      );
    }

    /* The content pane is the port with no guaranteed focusable descendant, so
     * it carries the tab stop itself (WCAG 2.1.1). Read as an ATTRIBUTE: the
     * `tabIndex` IDL getter answers -1 for any non-focusable element whether or
     * not anyone set it. The list column deliberately carries NO tab stop —
     * every row in it is a focusable button, so axe's rule does not apply and an
     * extra stop would only add a keystroke.
     */
    await expect(content.getAttribute("tabindex")).toBe("0");
    await expect(list.getAttribute("tabindex")).toBeNull();
    // Inset rung, because `SidebarInset` clips anything drawn outside the box.
    // Asserting only that `focus-ring-inset` is present would still pass with
    // both classes on the element — and then the clipped one is what paints.
    await expect(content.classList.contains("focus-ring-inset")).toBe(true);
    await expect(content.classList.contains("focus-ring")).toBe(false);
    content.focus();
    await expect(document.activeElement).toBe(content);
    // The list column really does hold its own focusable rows — the reason it
    // needs no stop of its own. Without this the assertion above degenerates
    // into "the attribute is absent", which is also true of a broken port.
    await expect(list.querySelectorAll("button").length).toBeGreaterThan(1);
  },
};
