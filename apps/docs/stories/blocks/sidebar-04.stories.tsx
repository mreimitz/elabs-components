import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import MailShell from "@/components/sidebar-04/mail-shell";
import { DEMO_MESSAGES, messageHref } from "@/components/sidebar-04/messages";

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
    }
    const hrefs = rows.map((row) => row.getAttribute("href"));
    await expect(new Set(hrefs).size).toBe(hrefs.length);
    await expect([...hrefs].sort()).toEqual(DEMO_MESSAGES.map((m) => messageHref(m.id)).sort());

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
  render: () => <MailShell activePath="/inbox" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pane = canvasElement.querySelector('[data-slot="mail-reading-pane"]');
    await expect(pane).toBeVisible();
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
    // One live region per zone, carrying a real sentence.
    await expect(canvas.getByText("Loading messages…")).toBeInTheDocument();
    await expect(canvas.getByText("Loading the message…")).toBeInTheDocument();
    // Skeletons are layout-shaped AND decorative: the boxes live inside the
    // announcing region and are each `aria-hidden`, so AT hears the sentence
    // once instead of once per box. Counted from the region rather than from a
    // class name, so the assertion is about the announced region's contents.
    const listStatus = canvasElement.querySelector(
      '[data-slot="mail-list-column"] [role="status"]',
    ) as HTMLElement;
    // Asserted present FIRST: without this the next line reports a null-deref
    // rather than the missing live region, which reads like a broken test
    // instead of a real regression.
    await expect(listStatus).toBeInTheDocument();
    await expect(listStatus).toHaveAttribute("aria-live", "polite");
    await expect(listStatus.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(
      7,
    );
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

    // The escape hatch is not decoration: pressing it restores every row. Its
    // name is deliberately NOT "Clear search" — `SearchInput`'s own clear
    // button already owns that name in this same view.
    await userEvent.click(canvas.getByRole("button", { name: "Show every message" }));
    await waitFor(async () =>
      expect(canvasElement.querySelectorAll('[data-slot="mail-list-column"] li')).toHaveLength(
        DEMO_MESSAGES.length,
      ),
    );
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
  },
};

/**
 * #66 — chrome ink on chrome ground. Text sitting on the `bg-sidebar` frame must
 * reach for the SIDEBAR ink pair; the canvas pair measures ~2.3:1 there in
 * `light`. Asserted on the ratio the browser actually painted, not on a class
 * name, so a token retune that breaks it fails here too.
 */
export const SidebarInkContrast: Story = {
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
