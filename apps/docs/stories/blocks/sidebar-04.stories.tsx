import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import MailShell from "@/components/sidebar-04/mail-shell";
import { DEMO_MESSAGES, messageHref, type MailMessage } from "@/components/sidebar-04/messages";

/**
 * WCAG contrast ratio between two CSS color strings, computed by rasterizing
 * each through a 1×1 canvas (normalizes any color function — oklch(), rgb(),
 * etc. — to concrete sRGB the way the browser actually paints it) and applying
 * the WCAG 2.x relative-luminance + contrast formulas. Used by the #66 locking
 * test below to assert the REAL rendered ratio, not just the class name.
 */
function cssColorToRgb(color: string): [number, number, number] {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  // A 1×1 getImageData always yields exactly four RGBA bytes; noUncheckedIndexedAccess
  // cannot express that, so read the three channels explicitly.
  const r = data[0] ?? 0;
  const g = data[1] ?? 0;
  const b = data[2] ?? 0;
  return [r / 255, g / 255, b / 255];
}
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function wcagContrast(fg: string, bg: string): number {
  const lf = relativeLuminance(cssColorToRgb(fg));
  const lb = relativeLuminance(cssColorToRgb(bg));
  const [hi, lo] = lf >= lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}
/** Walk up from `el` to the nearest ancestor (inclusive) with a painted background. */
function resolvedBackgroundColor(el: Element): string {
  let node: Element | null = el;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    node = node.parentElement;
  }
  return getComputedStyle(document.body).backgroundColor;
}

/** The two fixture messages the locks below name, resolved once. */
const FIRST = DEMO_MESSAGES[0]!;
const FOURTH = DEMO_MESSAGES[3]!;

const meta = {
  title: "Layout/App Shell/Mail",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A three-zone variation on the classic left-sidebar shell: the same collapsible icon rail, then a searchable message list and a reading pane sharing the floating inset surface. Reach for it when a screen's job is “pick one of many, then read the whole of it” — mail, a review queue, an alert inbox, a document tray. When there is nothing to pick between, `Layout/App Shell/Dashboard` is the smaller shell; when the screen also needs a details rail on the right, `Layout/App Shell/Flagship` carries four zones. Below `md` the two content zones become a drill-down: the list owns the screen until a message is opened, and the top bar grows a back control.",
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
} satisfies Meta<typeof MailShell>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The believable screen: mailboxes and labels on the left, the inbox in the
 * middle, and the open message filling the reading pane.
 */
export const Default: Story = {
  render: () => <MailShell activePath="/inbox" defaultSelectedId={FIRST.id} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* ------------------------------------------------------------------
     * LOCK 1 — the reading pane is a LABELLED landmark, named by the
     * message it is showing.
     *
     * Written to bite, because "is it a landmark" is exactly the assertion
     * that goes vacuous: `getByRole("region")` passes on any <section> with
     * any name at all, so a static `aria-label="Reading pane"` — the thing
     * that makes the landmark useless for moving between messages — would
     * sail through it. Three assertions close that:
     *   (a) the name is EXACTLY the subject, not merely non-empty;
     *   (b) the element the role query found is the pane itself, not some
     *       other region that happens to be named;
     *   (c) the name CHANGES when the selection does — which no fixed label
     *       can satisfy, whatever it says.
     * ------------------------------------------------------------------ */
    const pane = canvasElement.querySelector('[data-slot="mail-reading-pane"]');
    await expect(pane).toBeVisible();
    const region = canvas.getByRole("region", { name: FIRST.subject });
    await expect(region).toBe(pane);
    await expect(region).toHaveAccessibleName(FIRST.subject);

    /* ------------------------------------------------------------------
     * LOCK 2 — the list column's items are REAL LINKS.
     *
     * Also written to bite. "It has an href" passes on `href="#"`, on a
     * `<span role="link">`, and on a row that renders one anchor while the
     * other six are buttons. So: every row node is checked, by TAG rather
     * than by role; the hrefs must match the message route pattern; they
     * must be unique; and the SET of them must equal the fixture's own ids,
     * so a row that silently stops rendering fails here too.
     *
     * REACHABILITY is a fourth, separate property, added after a review
     * mutation (`tabIndex={-1}` on every row) left all of the above green
     * and axe silent: a link nobody can Tab to is not a link. It is checked
     * on two independent channels, because each one alone has a known
     * failure mode:
     *   (a) the DOM ATTRIBUTE — `getAttribute("tabindex")` must be absent.
     *       Read the IDL property instead and you learn nothing: `.tabIndex`
     *       answers -1 on plenty of elements that were never given the
     *       attribute, so the assertion would be about the getter, not the
     *       markup.
     *   (b) a REAL Tab press — from the search input, which is the row
     *       list's immediate predecessor in the focus order (the clear
     *       button renders only for a non-empty query, and this story's
     *       query is empty). Focus must land on the first row. That is the
     *       outcome the attribute is a proxy for, asserted directly.
     * `row.focus()` is deliberately NOT used: programmatic focus succeeds on
     * a `tabindex="-1"` element, so it would pass on the very mutation this
     * exists to catch.
     * ------------------------------------------------------------------ */
    const list = canvasElement.querySelector('[data-slot="mail-list-column"] ul');
    await expect(list).toBeInTheDocument();
    const rows = Array.from((list as HTMLElement).querySelectorAll(":scope > li > *"));
    await expect(rows).toHaveLength(DEMO_MESSAGES.length);
    for (const row of rows) {
      // `tagName`, not `getByRole("link")`: an element with `role="link"` and
      // no href answers the role query and navigates nowhere.
      await expect(row.tagName).toBe("A");
      const href = row.getAttribute("href");
      await expect(href).toMatch(/^\/mail\/[a-z0-9-]+$/);
      // A resolved, different document — `href="#"` and `href=""` both fail.
      await expect((row as HTMLAnchorElement).href).not.toBe(document.location.href);
      // Channel (a): nothing pulled the row out of the sequential focus order.
      await expect(row.getAttribute("tabindex")).toBeNull();
      // …and when focus lands, it is visible. The row sits inside the list's
      // own `overflow-y-auto` scroll port, itself inside `SidebarInset`'s
      // `overflow-hidden`, so a ring drawn OUTSIDE the element's box is clipped
      // away entirely — `focus-ring-inset` is the rung that survives.
      //
      // This one is asserted as a CLASS on purpose, against the usual rule.
      // The two rungs differ only in the CSS they emit, and the thing that goes
      // wrong — a ring painted outside a clipping ancestor — has no box left to
      // measure once it is clipped, so there is no rendered quantity to read
      // back. The assertion is about the CLIPPING, not about a name; if a later
      // reader finds a way to measure the painted ring, prefer that.
      await expect(row).toHaveClass("focus-ring-inset");
    }
    const hrefs = rows.map((row) => row.getAttribute("href"));
    await expect(new Set(hrefs).size).toBe(hrefs.length);
    await expect([...hrefs].sort()).toEqual(DEMO_MESSAGES.map((m) => messageHref(m.id)).sort());

    // Channel (b): the keyboard really gets there. One Tab from the search
    // field lands on the first row — not on whatever comes after the list.
    // `userEvent.click` rather than `search.focus()`: in the headless runner
    // the document itself is not focused, so a bare `.focus()` call leaves
    // `document.activeElement` on `<body>` and the Tab that follows would
    // start from nowhere (measured — the assertion failed against `<body>`).
    const search = canvas.getByPlaceholderText("Search messages…");
    await userEvent.click(search);
    await expect(search).toHaveFocus();
    await userEvent.tab();
    await expect(rows[0]).toHaveFocus();

    /* --- LOCK 3: the drill-down switch, at the runner's desktop width ----
     * `data-slot="mail-shell-panes"` carries ONE attribute that both zones
     * read through `group-data-[reading=…]/mail:` variants. Pinning it to
     * `"closed"` used to leave this file green, which means the switch that
     * decides which zone owns a phone screen was unasserted.
     *
     * All three halves are load-bearing and each catches a different edit:
     * the attribute catches the switch being pinned or inverted; the pane
     * catches the reading zone failing to open; and the LIST catches the bug
     * this shell actually shipped — a specificity contest that hid the middle
     * zone at every width, which every text and attribute assertion in this
     * file passed straight through.
     * ------------------------------------------------------------------ */
    const panes = canvasElement.querySelector('[data-slot="mail-shell-panes"]');
    await expect(panes).toHaveAttribute("data-reading", "open");
    await expect(canvasElement.querySelector('[data-slot="mail-reading-pane"]')).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="mail-list-column"]')).toBeVisible();

    // …and the row that is open says so through a channel that survives
    // greyscale: `aria-current`, not the tint.
    await expect(canvasElement.querySelector(`a[href="${messageHref(FIRST.id)}"]`)).toHaveAttribute(
      "aria-current",
      "page",
    );

    // LOCK 1(c): open a different message and the landmark renames itself.
    await userEvent.click(
      canvasElement.querySelector(`a[href="${messageHref(FOURTH.id)}"]`) as HTMLElement,
    );
    await waitFor(() => expect(pane).toHaveAccessibleName(FOURTH.subject));
    // The selection moved with it, rather than lighting two rows at once.
    await expect(
      canvasElement.querySelectorAll('[data-slot="mail-list-column"] [aria-current]'),
    ).toHaveLength(1);

    /* A6 — the rail toggle exposes the state it toggles. Its whole accessible
     * name is the static "Toggle Sidebar", so without this attribute nothing
     * tells a screen-reader user whether the rail is open, and no axe rule
     * fires. Read as a string: attribute-absent and `"false"` are different
     * states. `Collapsed` locks the other value.
     */
    await expect(
      canvasElement.querySelector('[data-slot="sidebar-trigger"]')?.getAttribute("aria-expanded"),
    ).toBe("true");
  },
};

/**
 * Unread is carried by three channels, not by the dot's hue: the dot, the
 * semibold subject, and a word folded into the row's accessible name. The rail
 * folds its per-mailbox count into a name for the same reason — the visible
 * badge is hidden in the collapsed rail, so the number would otherwise reach
 * nobody there.
 */
export const UnreadChannels: Story = {
  /* A pure REGRESSION LOCK: its `render` is byte-identical to the story named
   * above it, so in the sidebar it was a second entry showing the same screen
   * under a different name. `!dev` keeps it out of the sidebar and the docs
   * page while leaving it in the test run — the assertions below are the whole
   * point of it, and they still run in CI. */
  tags: ["!dev"],
  render: () => <MailShell activePath="/inbox" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const unreadRow = canvasElement.querySelector(
      `a[href="${messageHref(FIRST.id)}"]`,
    ) as HTMLElement;
    const readRow = canvasElement.querySelector(
      `a[href="${messageHref(FOURTH.id)}"]`,
    ) as HTMLElement;
    // The WORD reaches assistive tech — a `data-` attribute would not, and a
    // coloured dot alone would not survive greyscale.
    await expect(unreadRow.textContent).toContain("Unread");
    await expect(readRow.textContent).not.toContain("Unread");
    // The second non-colour channel, measured rather than read off a class:
    // the unread subject is genuinely heavier than the read one. Comparing the
    // two COMPUTED weights (rather than asserting one class string) is what
    // makes this fail on code that only changes the colour.
    const unreadSubject = within(unreadRow).getByText(FIRST.subject);
    const readSubject = within(readRow).getByText(FOURTH.subject);
    await expect(Number.parseInt(getComputedStyle(unreadSubject).fontWeight, 10)).toBeGreaterThan(
      Number.parseInt(getComputedStyle(readSubject).fontWeight, 10),
    );

    // The rail's count is part of the link's NAME, asserted exactly: a regex
    // (`name: /Inbox/`) would pass on the bare label and the count could go
    // missing unnoticed.
    await expect(canvas.getByRole("link", { name: "Inbox, 4 unread" })).toBeVisible();
    // …and the mailbox with no unread mail is named with no count at all.
    await expect(canvas.getByRole("link", { name: "Archive" })).toBeVisible();
  },
};

/**
 * Nothing picked yet — the pane holds its own empty state instead of an empty
 * rectangle, and the landmark falls back to a static name because there is no
 * subject to name it after.
 */
export const NoSelection: Story = {
  /* A pure REGRESSION LOCK: its `render` is byte-identical to the story named
   * above it, so in the sidebar it was a second entry showing the same screen
   * under a different name. `!dev` keeps it out of the sidebar and the docs
   * page while leaving it in the test run — the assertions below are the whole
   * point of it, and they still run in CI. */
  tags: ["!dev"],
  render: () => <MailShell activePath="/inbox" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pane = canvasElement.querySelector('[data-slot="mail-reading-pane"]');
    // Visible with NOTHING selected — which is the `md:flex` half of the pane's
    // class list doing its job, and the only assertion in the file that reaches
    // it. The pane's base class is `hidden`; with `data-reading="closed"` the
    // `group-data-[reading=open]/mail:flex` rule does not match, so `md:flex`
    // is the sole reason this zone is painted. Both are single-class selectors
    // at equal specificity, so the tie is broken by SOURCE ORDER alone — the
    // most fragile arrangement in the block. Deleting `md:flex`, or moving
    // `hidden` after it, reds this line.
    await expect(pane).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="mail-shell-panes"]')).toHaveAttribute(
      "data-reading",
      "closed",
    );
    await expect(pane).toHaveAccessibleName("Reading pane");
    // `waitFor` for `StatePanel`'s own fade-in — see the note in `Empty`.
    await waitFor(async () => expect(canvas.getByText("No message selected")).toBeVisible());
    // No row claims to be the open one.
    await expect(
      canvasElement.querySelectorAll('[data-slot="mail-list-column"] [aria-current]'),
    ).toHaveLength(0);
    // The top bar shows the mailbox as a plain title: one crumb is not a trail.
    await expect(canvasElement.querySelector('[data-slot="mail-top-bar-title"]')).toHaveTextContent(
      "Inbox",
    );
  },
};

/**
 * The frame with an empty content slot — what the shell contributes on its own,
 * before a single message exists.
 */
export const Frame: Story = {
  render: () => <MailShell activePath="/inbox" emptyContent />,
  play: async ({ canvasElement }) => {
    const panes = canvasElement.querySelector('[data-slot="mail-shell-panes"]');
    // Really empty — not "empty apart from a wrapper div".
    await expect(panes).toBeEmptyDOMElement();
    // The chrome is all still there and still says where you are.
    await expect(canvasElement.querySelector('[data-slot="mail-top-bar"]')).toBeVisible();
    await expect(canvasElement.querySelector('nav[aria-label="Mailboxes"]')).toBeInTheDocument();
  },
};

/**
 * Waiting on the first page. Both zones show a layout-shaped skeleton — the same
 * boxes the real rows and the real message will occupy — so nothing jumps when
 * the data lands, and the region announces itself once rather than per box.
 */
export const Loading: Story = {
  render: () => <MailShell activePath="/inbox" defaultSelectedId={FIRST.id} loading />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // One live region per zone, carrying a real sentence. These two are
    // asserted PRESENT rather than visible on purpose: both are `sr-only`,
    // which this runner correctly reports as NOT visible — a visibility
    // assertion here would be demanding that the announcement be painted,
    // which is the opposite of what an `sr-only` line is for.
    await expect(canvas.getByText("Loading messages…")).toBeInTheDocument();
    await expect(canvas.getByText("Loading the message…")).toBeInTheDocument();
    // Skeletons are layout-shaped AND decorative: the boxes live inside the
    // announcing region and are each `aria-hidden`, so AT hears the sentence
    // once instead of once per box. Counted from the region rather than from a
    // class name, so the assertion is about the announced region's contents.
    const listStatus = canvasElement.querySelector(
      '[data-slot="mail-list-column"] [role="status"]',
    ) as HTMLElement;
    const paneStatus = canvasElement.querySelector(
      '[data-slot="mail-reading-pane"] [role="status"]',
    ) as HTMLElement;
    // Asserted present FIRST: without this the next line reports a null-deref
    // rather than the missing live region, which reads like a broken test
    // instead of a real regression.
    await expect(listStatus).toBeInTheDocument();
    await expect(paneStatus).toBeInTheDocument();
    // The REGIONS carry the visibility assertion, because they are the parts
    // that are supposed to be painted. A review mutation put an inline
    // `display: none` on the whole loading region and left this story green:
    // `getByText`, `querySelector`, `toBeInTheDocument` and attribute reads
    // ALL survive `display: none`, so the entire skeleton state could vanish
    // unnoticed. These two lines are what actually ask the browser.
    await expect(listStatus).toBeVisible();
    await expect(paneStatus).toBeVisible();
    await expect(listStatus).toHaveAttribute("aria-live", "polite");
    const boxes = listStatus.querySelectorAll('[aria-hidden="true"]');
    await expect(boxes.length).toBeGreaterThanOrEqual(7);
    // A placeholder that reserves no space is not a layout-shaped skeleton —
    // the real row is supposed to land in the box that is already there (the
    // CLS half of the loading-states rule). Measured, so a collapsed region
    // fails on the geometry as well as on visibility.
    await expect((boxes[0] as HTMLElement).getBoundingClientRect().height).toBeGreaterThan(0);
    // No rows are pretending to exist yet.
    await expect(canvasElement.querySelectorAll('[data-slot="mail-list-column"] li')).toHaveLength(
      0,
    );
  },
};

/**
 * An empty mailbox. The panel says what will appear here rather than inventing
 * an action — there is nothing for the reader to do about an empty inbox.
 */
export const Empty: Story = {
  render: () => <MailShell activePath="/archive" heading="Archive" messages={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // `waitFor`, because `StatePanel` fades itself in — asserted mid-animation
    // the panel is genuinely at `opacity: 0.49` and `toBeVisible()` is right to
    // say no. The wait is for the animation, not for the data.
    await waitFor(async () => expect(canvas.getByText("Nothing here")).toBeVisible());
    await expect(canvasElement.querySelectorAll('[data-slot="mail-list-column"] li')).toHaveLength(
      0,
    );
    // The count in the list header agrees with the list.
    await expect(canvas.getByRole("heading", { name: "Archive" })).toBeVisible();
  },
};

/**
 * A search that matches nothing is a different kind of empty from an empty
 * mailbox, so it gets a different glyph, different words, and — the part that
 * matters — a way OUT that really works.
 */
export const FilteredEmpty: Story = {
  render: () => <MailShell activePath="/inbox" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByPlaceholderText("Search messages…");
    await userEvent.type(search, "zzz-no-such-message-zzz");
    await waitFor(async () =>
      expect(canvas.getByText("Nothing matches that search")).toBeVisible(),
    );

    // The list really is empty behind the panel — a state panel drawn OVER a
    // still-populated list would satisfy the text assertion above on its own.
    await expect(canvasElement.querySelectorAll('[data-slot="mail-list-column"] li')).toHaveLength(
      0,
    );
    // The escape hatch is present and is a real, enabled control. Its name is
    // deliberately NOT "Clear search" — `SearchInput`'s own clear button
    // already owns that name in this same view. PRESSING it belongs to
    // `FilteredEmptyRecovered` below, not here: a story called `FilteredEmpty`
    // that ends by refilling the list documents the full list under the empty
    // name, and every screenshot taken from it shows the wrong screen.
    const escapeHatch = canvas.getByRole("button", { name: "Show every message" });
    await expect(escapeHatch).toBeVisible();
    await expect(escapeHatch).toBeEnabled();
  },
};

/**
 * The way out, taken — the second half of the no-results round trip.
 *
 * Split from `FilteredEmpty` so each story's FINAL PAINT matches its own name.
 * The claim here is the one that matters about an escape hatch: it is not
 * decoration. Pressing it clears the query AND brings every row back.
 */
export const FilteredEmptyRecovered: Story = {
  render: () => <MailShell activePath="/inbox" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByPlaceholderText("Search messages…");
    await userEvent.type(search, "zzz-no-such-message-zzz");
    await waitFor(async () =>
      expect(canvas.getByText("Nothing matches that search")).toBeVisible(),
    );

    await userEvent.click(canvas.getByRole("button", { name: "Show every message" }));
    await waitFor(async () =>
      expect(canvasElement.querySelectorAll('[data-slot="mail-list-column"] li')).toHaveLength(
        DEMO_MESSAGES.length,
      ),
    );
    // The FIELD was cleared too, not just the list. A reset that leaves the
    // query sitting in the box shows a full list under a search that matches
    // nothing — and the next keystroke re-empties it.
    await expect((search as HTMLInputElement).value).toBe("");
    // …and the panel is gone, rather than sitting above a restored list.
    await expect(canvas.queryByText("Nothing matches that search")).toBeNull();
  },
};

/**
 * The collapsed rail: icons only, but nothing becomes unreachable. Compose keeps
 * a name once its word folds away, and each mailbox keeps its unread count —
 * the visible badge is hidden in this state, so the count lives in the link's
 * accessible name instead.
 */
export const Collapsed: Story = {
  render: () => <MailShell activePath="/inbox" defaultSidebarOpen={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelector('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    // The badge really is gone — asserted as NOT VISIBLE, because the node is
    // still in the DOM and a `querySelector` check would pass either way.
    const badge = canvasElement.querySelector('[data-slot="sidebar-menu-badge"]');
    await expect(badge).toBeInTheDocument();
    await expect(badge).not.toBeVisible();
    // …and the same fact still reaches assistive tech through the name.
    await expect(canvas.getByRole("link", { name: "Inbox, 4 unread" })).toBeVisible();
    // The one action a mail client must not hide keeps its name.
    await expect(canvas.getByRole("button", { name: "Compose" })).toBeVisible();
    // A6's closed branch, from a real collapsed render rather than a click.
    await expect(
      canvasElement.querySelector('[data-slot="sidebar-trigger"]')?.getAttribute("aria-expanded"),
    ).toBe("false");
  },
};

/**
 * #66 — chrome ink on chrome ground. Text sitting on the `bg-sidebar` frame must
 * reach for the SIDEBAR ink pair; the canvas pair measures ~2.3:1 there in
 * `light`. Asserted on the ratio the browser actually painted, not on a class
 * name, so a token retune that breaks it fails here too.
 */
export const SidebarInkContrast: Story = {
  /* A pure REGRESSION LOCK: its `render` is byte-identical to the story named
   * above it, so in the sidebar it was a second entry showing the same screen
   * under a different name. `!dev` keeps it out of the sidebar and the docs
   * page while leaving it in the test run — the assertions below are the whole
   * point of it, and they still run in CI. */
  tags: ["!dev"],
  render: () => <MailShell activePath="/inbox" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const account = canvas.getByText("ada@northwind.example");
    const ratio = wcagContrast(getComputedStyle(account).color, resolvedBackgroundColor(account));
    await expect(ratio).toBeGreaterThanOrEqual(4.5);
  },
};

/**
 * `data-density="compact"` on a wrapper — exactly how an app sets it. The rail
 * is deliberately NOT pinned: `Sidebar` spreads `...props` onto its CONTAINER
 * only, so a pin whose value DISAGREES with the document desynchronises the
 * container from the sibling SPACER, which still reads the document density.
 * (Pinning the same value the document already carries is inert — the failure
 * needs a disagreement, not merely an attribute.)
 */
export const CompactDensity: Story = {
  render: () => (
    <div data-density="compact">
      <MailShell activePath="/inbox" defaultSelectedId={FIRST.id} defaultSidebarOpen={false} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const rail = canvasElement.querySelector('[data-slot="sidebar"]');
    await expect(rail).toHaveAttribute("data-state", "collapsed");
    // Under `collapsible=icon` + `variant=inset` the two widths differ by a
    // designed 2px and by nothing else. Measured, not inferred from a class
    // name: pinning `data-density="spacious"` on the rail inside this compact
    // wrapper drives the delta to 5.70px, which is what this window catches.
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
 * Content that does not fit — the state a real inbox reaches within a week and
 * a fixture never does. Every zone gets its worst realistic case at once: a
 * sender name with a title and a job description in it, a subject carrying an
 * unbroken 130-character tracking URL, a preview several lines long, and a body
 * paragraph carrying a 128-character artifact digest with no break opportunity
 * anywhere in it. The list column is the narrowest zone in the shell at a fixed
 * `md:w-80`, so it is where a missing `min-w-0` or a missing wrap rule shows
 * first.
 *
 * The lock is geometric rather than visual: a container that overflows
 * horizontally has `scrollWidth > clientWidth`, and that is true whether the
 * spill is a long word, a long name or a flex child that refused to shrink.
 * Nothing here trims the content to fit — if a zone cannot hold it, the
 * assertion is supposed to say so.
 */
const OVERFLOW_MESSAGES: MailMessage[] = [
  {
    id: "overflow",
    from: {
      name: "Dr. Annabelle Featherstonehaugh-Wolsey, Deputy Director of Platform Reliability",
      email: "annabelle.featherstonehaugh-wolsey@platform-reliability.northwind.example",
    },
    subject:
      "Re: Fwd: incident review follow-up — https://northwind.example/incidents/2026-09-05/postmortem?utm_source=digest&utm_campaign=weekly-reliability-roundup",
    preview:
      "Circling back on the action items from the review: the retry budget change is merged, the alert threshold is still under discussion, and the runbook needs a second pair of eyes before Friday.",
    body: [
      "Circling back on the action items from the review. The retry budget change is merged and deployed to the two smallest regions; the rollout to the rest waits on the alert threshold discussion below.",
      "Reproduction is pinned at artifact digest a94f1c7e8b2d5f60c31ae47b9d02f8635c1e7a49b83d06f2e5c9147ab6d3820f7c4e19b8a05d63f2e8471cb90a5d3e67f24b81c05a9e37d6b2f480ce13a95d7b, which is the last build before the regression.",
      "Everything else from the review is either done or has an owner. The runbook still needs a second pair of eyes before Friday.",
    ].join("\n\n"),
    receivedAt: FIRST.receivedAt,
    unread: true,
    labels: FIRST.labels,
  },
  ...DEMO_MESSAGES.slice(1),
];

export const OverflowingContent: Story = {
  render: () => (
    <MailShell activePath="/inbox" messages={OVERFLOW_MESSAGES} defaultSelectedId="overflow" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const noOverflow = (el: Element, label: string) => {
      const node = el as HTMLElement;
      // 1px of tolerance: a sub-pixel layout width rounds up into `scrollWidth`
      // on a fractional device ratio, which is not a spill.
      return { label, spill: node.scrollWidth - node.clientWidth };
    };

    const zones = [
      ['[data-slot="mail-list-column"]', "list column"],
      ['[data-slot="mail-reading-pane"]', "reading pane"],
      ['[data-slot="mail-reading-pane-body"]', "reading pane body"],
      ['[data-slot="mail-top-bar"]', "top bar"],
    ] as const;
    for (const [selector, label] of zones) {
      const zone = canvasElement.querySelector(selector);
      await expect(zone).toBeInTheDocument();
      // Visible FIRST, and only then measured. A `display: none` element
      // reports `scrollWidth === clientWidth === 0`, so every spill assertion
      // below would pass vacuously on a zone that had vanished — which is
      // exactly how the desktop three-zone regression survived the rest of
      // this file.
      await expect(zone).toBeVisible();
      await expect((zone as HTMLElement).clientWidth).toBeGreaterThan(0);
      const { spill } = noOverflow(zone!, label);
      await expect(`${label} spill=${Math.max(0, Math.round(spill))}`).toBe(`${label} spill=0`);
    }

    // The row itself, not just its column: a row that spills paints over the
    // scrollbar and the column's own border.
    const rows = Array.from(
      canvasElement.querySelectorAll('[data-slot="mail-list-column"] a[href^="/mail/"]'),
    );
    await expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      await expect((row as HTMLElement).clientWidth).toBeGreaterThan(0);
      const { spill } = noOverflow(row, "row");
      await expect(`row spill=${Math.max(0, Math.round(spill))}`).toBe("row spill=0");
    }

    // The preview really is clamped rather than merely narrow. Two lines of
    // `caption` leading, plus a line of slack for the browser's own rounding.
    // Found by its TEXT, not by the `line-clamp-2` class — a class selector
    // would make the mutation that deletes the clamp fail as a missing element
    // rather than as an unclamped one, which proves nothing about geometry.
    const preview = canvas.getByText(OVERFLOW_MESSAGES[0]!.preview);
    const leading = parseFloat(getComputedStyle(preview).lineHeight);
    const previewHeight = preview.getBoundingClientRect().height;
    // Both ends: a clamp assertion alone is satisfied by a preview that is not
    // rendered at all.
    await expect(previewHeight).toBeGreaterThan(leading);
    await expect(previewHeight).toBeLessThanOrEqual(leading * 2 + 1);

    // The reading pane's own two spill risks, asserted separately from the
    // zone above so a failure names which one moved: the subject heading and
    // the prose column that holds the unbreakable hash.
    const subject = canvasElement.querySelector(
      '[data-slot="mail-reading-pane"] h1',
    ) as HTMLElement;
    await expect(subject).toBeInTheDocument();
    await expect(`subject spill=${Math.max(0, Math.round(noOverflow(subject, "s").spill))}`).toBe(
      "subject spill=0",
    );
    const paragraph = canvasElement.querySelector(
      '[data-slot="mail-reading-pane-body"] p',
    ) as HTMLElement;
    await expect(paragraph).toBeInTheDocument();
    await expect(`body spill=${Math.max(0, Math.round(noOverflow(paragraph, "b").spill))}`).toBe(
      "body spill=0",
    );
  },
};

/**
 * The phone branch — the half of this shell that a 1200px test runner has never
 * rendered. Below `md` the two content zones stop being columns and become a
 * drill-down: the list owns the screen until a message is opened, then hands it
 * over and the top bar grows a back control.
 *
 * The viewport really changes here. `md:` and `max-md:` are VIEWPORT media
 * queries, so constraining a wrapper's width would prove nothing — the story
 * would render the desktop branch under a mobile name, and (because a hidden
 * element measures zero) it would pass. Measured inside this play function:
 * `window.innerWidth` is 414 and `matchMedia("(min-width: 48rem)")` is false,
 * against 1200 / true everywhere else in this file. The global is per-story and
 * restores afterwards, so no sibling story inherits it.
 */
export const NarrowDrillDown: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
  render: () => <MailShell activePath="/inbox" />,
  play: async ({ canvasElement }) => {
    // The premise, asserted rather than assumed: if this is still a desktop
    // viewport then everything below is testing the wrong branch.
    await expect(window.matchMedia("(min-width: 48rem)").matches).toBe(false);

    const list = canvasElement.querySelector('[data-slot="mail-list-column"]') as HTMLElement;
    const pane = canvasElement.querySelector('[data-slot="mail-reading-pane"]') as HTMLElement;
    const panes = canvasElement.querySelector('[data-slot="mail-shell-panes"]') as HTMLElement;
    await expect(list).toBeInTheDocument();
    await expect(pane).toBeInTheDocument();

    // Nothing open: the list owns the screen and the pane is not merely
    // off-screen, it is not painted. This is the `hidden` base class with
    // neither `md:flex` nor the group rule matching — the one arrangement no
    // other story in this file can reach.
    await expect(panes).toHaveAttribute("data-reading", "closed");
    await expect(list).toBeVisible();
    await expect(pane).not.toBeVisible();

    // Open one. The switch flips, and the two zones trade places.
    const first = canvasElement.querySelector(
      `a[href="${messageHref(FIRST.id)}"]`,
    ) as HTMLAnchorElement;
    await expect(first).toBeVisible();
    await userEvent.click(first);

    await waitFor(async () => {
      await expect(panes).toHaveAttribute("data-reading", "open");
    });
    // `max-md:group-data-[reading=open]/mail:hidden` — the rule the desktop fix
    // scoped. Below `md` it must still hide the list, or the drill-down is two
    // columns crushed into 414px.
    await expect(list).not.toBeVisible();
    // …and `group-data-[reading=open]/mail:flex` is what paints the pane here.
    // `md:flex` cannot help at this width, so this is the only assertion in the
    // file that holds that rule to account.
    await expect(pane).toBeVisible();

    // The way BACK exists. `md:hidden` on the back control means it is present
    // only on this branch, so a phone user is never stranded in the message.
    const canvas = within(canvasElement);
    const back = canvas.getByRole("button", { name: "Back to the message list" });
    await expect(back).toBeVisible();
    await userEvent.click(back);
    await waitFor(async () => {
      await expect(panes).toHaveAttribute("data-reading", "closed");
    });
    await expect(list).toBeVisible();
    await expect(pane).not.toBeVisible();
  },
};

/**
 * Just above the `md` boundary — the width band this file could not see. Every
 * other story here renders at 1200px or, for the drill-down, at 414px: both far
 * from 768px and on opposite sides of it. So sliding the shell's layout
 * breakpoint one step, `md:` to `lg:`, silently switched every reader between
 * 768px and 1023px to the phone layout — two zones collapsed to one — and the
 * file stayed green.
 *
 * 800px sits inside that band. The claim asserted here is the same one the
 * 1200px stories make: with a message open, all three zones are on screen at
 * once. That is what makes it a breakpoint lock rather than a second desktop
 * story — it is the identical claim, measured on the other side of a line
 * nothing else in the file crosses.
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
  render: () => <MailShell activePath="/inbox" defaultSelectedId={FIRST.id} />,
  play: async ({ canvasElement }) => {
    // The premise, measured. A viewport global that silently stopped applying
    // would leave this re-measuring the 1200px branch under a name that says
    // otherwise, which is precisely the failure the story exists to prevent.
    await expect(window.innerWidth).toBeGreaterThanOrEqual(768);
    await expect(window.innerWidth).toBeLessThan(1024);
    await expect(window.matchMedia("(min-width: 48rem)").matches).toBe(true);
    await expect(window.matchMedia("(min-width: 64rem)").matches).toBe(false);

    // Three zones, all painted, with a message open — the desktop claim.
    const rail = canvasElement.querySelector('[data-slot="sidebar"]');
    const list = canvasElement.querySelector('[data-slot="mail-list-column"]') as HTMLElement;
    const pane = canvasElement.querySelector('[data-slot="mail-reading-pane"]') as HTMLElement;
    await expect(canvasElement.querySelector('[data-slot="mail-shell-panes"]')).toHaveAttribute(
      "data-reading",
      "open",
    );
    await expect(rail).toBeVisible();
    await expect(list).toBeVisible();
    await expect(pane).toBeVisible();
    // Both content zones hold real width — a "visible" column crushed to a
    // hairline is the mobile layout wearing the desktop layout's assertions.
    await expect(list.getBoundingClientRect().width).toBeGreaterThan(120);
    await expect(pane.getBoundingClientRect().width).toBeGreaterThan(120);
    // …and the drill-down's back control is NOT on screen. It is rendered
    // whenever a message is open, but carries `md:hidden`, so it is a second,
    // independent read of which branch is in force: if it is painted here, the
    // phone layout is running at 800px even should the zones happen to look
    // right.
    // Found by attribute rather than by role: `getByRole` skips hidden elements
    // by default, so it would throw here instead of returning the node this
    // assertion is about — and a lock that depends on a query THROWING cannot
    // tell "correctly hidden" apart from "deleted".
    const back = canvasElement.querySelector('[aria-label="Back to the message list"]');
    await expect(back).toBeInTheDocument();
    await expect(back).not.toBeVisible();
  },
};
