import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { Building2 } from "lucide-react";
import SettingsShell from "@/components/sidebar-05/settings-shell";
import { areaHref, sectionHref, type SettingsArea } from "@/components/sidebar-05/nav-items";

/**
 * WCAG contrast ratio between two CSS color strings, computed by rasterizing
 * each through a 1×1 canvas (normalizes any color function — oklch(), rgb(),
 * etc. — to concrete sRGB the way the browser actually paints it) and applying
 * the WCAG 2.x relative-luminance + contrast formulas. Used by the token lock
 * below to assert the REAL rendered ratio, not just the class name.
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

/**
 * How far an element's content spills past the box that clips it. Every caller
 * asserts the element is VISIBLE and has real width FIRST: on an unpainted
 * element `scrollWidth` and `clientWidth` are both 0, so a spill assertion
 * against a `display: none` node passes trivially and proves nothing.
 */
function overflowX(el: HTMLElement): number {
  return el.scrollWidth - el.clientWidth;
}

/** The three zones, resolved by their stable slots rather than by DOM order. */
function zones(canvasElement: HTMLElement) {
  return {
    rail: canvasElement.querySelector('[data-slot="settings-icon-rail"]') as HTMLElement,
    panel: canvasElement.querySelector('[data-slot="sidebar-container"]') as HTMLElement,
    inset: canvasElement.querySelector('[data-slot="sidebar-inset"]') as HTMLElement,
  };
}

const SIGN_IN = sectionHref("access", "sign-in");

const meta = {
  title: "Layout/App Shell/Double-Sided",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The dual-rail settings console, and the shell that demonstrates the summoned right-hand `SideDock`. A permanent 56px icon rail picks the AREA, a collapsible second panel lists that area's SECTIONS, the floating inset holds the section itself, and a resizable dock slides in from the right with the change history. Reach for it when a screen has two independent navigation levels plus an occasional third surface that must not steal permanent width — settings, admin consoles, a policy editor. The icon rail is deliberately NOT a `Sidebar`: it is the one strip that has to survive every breakpoint, so on a phone the section panel becomes a sheet while the rail stays put. Below 1100px the dock stops being a column and becomes an overlay of its own.",
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
} satisfies Meta<typeof SettingsShell>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The console as it opens: rail, section panel, the sign-in screen, dock away.
 *
 * The locks here are the ones that have nothing to do with layout — the skip
 * link and its target, the two-channel attention mark, and the scroll port's
 * focus rung.
 */
export const Default: Story = {
  render: () => <SettingsShell activePath={SIGN_IN} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The premise every desktop claim below rests on. The runner's own frame is
    // ~1200px; nothing here pins it, so it is measured rather than assumed.
    await expect(window.innerWidth).toBeGreaterThanOrEqual(1100);

    // Landmarks + skip link. The target is resolved FROM the link, not from a
    // hard-coded id: a lock that queries `#main-content` directly passes just
    // as happily when the link and the target were deleted together, which is
    // exactly how a skip-link mutation stayed green on a sibling shell.
    const skip = canvas.getByRole("link", { name: "Skip to main content" });
    const targetId = (skip.getAttribute("href") ?? "").replace(/^#/, "");
    await expect(targetId).not.toBe("");
    const target = canvasElement.querySelector(`#${CSS.escape(targetId)}`) as HTMLElement;
    await expect(target).toBeVisible();
    // The link must land on the MAIN landmark, and the target must be able to
    // take focus. `tabindex` is read as an ATTRIBUTE on purpose: the IDL getter
    // answers -1 for any element that is not natively focusable, so it cannot
    // tell "tabIndex={-1} was set" from "nothing was set at all".
    await expect(target.tagName).toBe("MAIN");
    await expect(target).toHaveAttribute("tabindex", "-1");
    await expect(canvas.getByRole("main")).toBe(target);
    // Both navigation levels are named landmarks, so a screen-reader user can
    // jump between "which area" and "which section" without walking the rows.
    await expect(canvas.getByRole("navigation", { name: "Settings areas" })).toBeVisible();
    await expect(canvas.getByRole("navigation", { name: "Access settings" })).toBeVisible();

    // The document outline has a ROOT. This shell shipped with an <h2> as its
    // highest heading, which axe cannot catch: `page-has-heading-one` is a
    // best-practice rule outside the wcag2a/wcag2aa tag set the runner uses,
    // and `heading-order` passes on contiguous levels that simply start at 2.
    // So the level is asserted here by hand — and the LEVELS BELOW it are
    // asserted too, because moving the screen title to <h1> without moving the
    // card titles with it would leave an h1 -> h3 skip that IS a real
    // `heading-order` failure.
    const headings = Array.from(
      canvasElement.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
    );
    const levels = headings.map((h) => Number(h.tagName.slice(1)));
    await expect(levels.filter((level) => level === 1).length).toBe(1);
    await expect(Math.min(...levels)).toBe(1);
    // Contiguous: sorted unique levels are 1, 2, 3, … with no gap.
    const rungs = [...new Set(levels)].sort((a, b) => a - b);
    await expect(rungs).toEqual(rungs.map((_, index) => index + 1));

    // The attention mark carries TWO channels. The word first — colour alone
    // would be a 1.4.1 failure, and a bare dot is exactly that.
    const marks = canvas.getAllByText("Needs a decision");
    await expect(marks.length).toBeGreaterThan(0);
    await expect(marks[0]!).toBeVisible();

    // Token lock: the dot is a MARK, so it owes 3:1 on its own ground.
    // `bg-warning` is the status FILL rung, guaranteed >=3:1 against `--card`.
    // Swapping it for `bg-primary` looks plausible and measures ~1.4:1 on the
    // `light` reference theme — a real regression a class-name assertion waves
    // through, which is why this reads the painted pixel instead.
    const dot = canvasElement.querySelector('[data-slot="settings-attention-dot"]') as HTMLElement;
    await expect(dot).toBeVisible();
    const dotFill = getComputedStyle(dot).backgroundColor;
    const dotGround = resolvedBackgroundColor(dot.parentElement!);
    await expect(wcagContrast(dotFill, dotGround)).toBeGreaterThanOrEqual(3);

    // The scroll port is keyboard-operable, with the INSET focus rung.
    // `SidebarInset` clips with `overflow-hidden`, so both layers of the plain
    // `focus-ring` are drawn outside the box and never reach a pixel. The
    // second assertion is the one that matters: checking only that
    // `focus-ring-inset` is PRESENT still passes when both classes are on the
    // element, and then the clipped rung is the one that paints.
    const port = canvasElement.querySelector('[data-slot="settings-screen-scroll"]') as HTMLElement;
    await expect(port).toBeVisible();
    await expect(port).toHaveAttribute("tabindex", "0");
    await expect(port.classList.contains("focus-ring-inset")).toBe(true);
    await expect(port.classList.contains("focus-ring")).toBe(false);

    // The frame is FLUSH, read as a PAINTED property rather than as the prop
    // that set it or the class name that carries it. `variant="inset"` on the
    // provider would ground the whole WRAPPER on chrome (`bg-sidebar`) so the
    // content column could float above it as a rounded card; this family does
    // not do that, so the wrapper paints nothing of its own and the content
    // column meets the rail edge to edge.
    const wrapper = canvasElement.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement;
    await expect(wrapper).toBeVisible();
    await expect(getComputedStyle(wrapper).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    // The elevation hierarchy still reads, and it is carried by the ZONES
    // themselves rather than by a wrapper behind them: chrome (the icon rail)
    // is the recessed ground, the content canvas is the brighter one.
    const railZone = zones(canvasElement).rail;
    const insetZone = zones(canvasElement).inset;
    const railGround = getComputedStyle(railZone).backgroundColor;
    await expect(railGround).not.toBe("rgba(0, 0, 0, 0)");
    await expect(railGround).not.toBe(getComputedStyle(insetZone).backgroundColor);
    // And the content column carries no rounded corner — the tell of the
    // floating-card look this family rejected.
    await expect(
      parseFloat(getComputedStyle(insetZone).borderTopLeftRadius) > 0 ? "rounded" : "square",
    ).toBe("square");

    // The dock is a COLUMN at this width, even while closed: above
    // `overlayBreakpoint` the column branch is always mounted, below it the
    // overlay branch renders nothing until it opens. `JustAboveTheBreakpoint`
    // reads that same difference from the other side.
    await expect(canvasElement.querySelector('[data-slot="side-dock"]')).toBeInTheDocument();
  },
};

/**
 * The dual-rail geometry, measured — the one thing about this shell that cannot
 * be reasoned about from the source.
 *
 * A desktop `Sidebar`'s visible half is `position: fixed; left: 0`, so without
 * the panel's `ms-14` it is painted straight over the icon rail. None of that
 * shows up in a render check, a snapshot or a class assertion: the rail is
 * still in the DOM, still "visible", still the right size — just covered. So
 * this story asks the page the two questions a person would: where are the
 * three columns, and what is actually under the pointer at x=28.
 */
export const DualRailGeometry: Story = {
  /* A pure REGRESSION LOCK: its `render` is byte-identical to the story named
   * above it, so in the sidebar it was a second entry showing the same screen
   * under a different name. `!dev` keeps it out of the sidebar and the docs
   * page while leaving it in the test run — the assertions below are the whole
   * point of it, and they still run in CI. */
  tags: ["!dev"],
  render: () => <SettingsShell activePath={SIGN_IN} />,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBeGreaterThanOrEqual(1100);
    const { rail, panel, inset } = zones(canvasElement);
    // Painted FIRST, then measured. Every rectangle below is 0×0 on a
    // `display: none` element, so an unchecked geometry assertion is the
    // easiest vacuous pass in this file.
    await expect(rail).toBeVisible();
    await expect(panel).toBeVisible();
    await expect(inset).toBeVisible();

    const r = rail.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const i = inset.getBoundingClientRect();

    // Size: three full-height columns. Collapsing any zone to `max-h-0` leaves
    // it "visible", with a real width and no height at all.
    await expect(r.height).toBeGreaterThan(400);
    await expect(p.height).toBeGreaterThan(400);
    await expect(i.height).toBeGreaterThan(400);
    await expect(r.width).toBeGreaterThan(40);
    await expect(p.width).toBeGreaterThan(200);
    await expect(i.width).toBeGreaterThan(400);

    // Position: everything is on screen. A zone pushed off with a transform
    // keeps its size and its visibility and simply stops existing for a reader.
    await expect(r.left).toBe(0);
    await expect(p.left).toBeGreaterThanOrEqual(0);
    await expect(i.right).toBeLessThanOrEqual(window.innerWidth + 1);

    // Order: rail, then panel, then content — left to right, no overlap. This
    // is the claim `ms-14` exists to satisfy, and the one that fails the moment
    // the panel column is moved after the content pane in the JSX.
    await expect(Math.abs(p.left - r.right)).toBeLessThanOrEqual(1);
    await expect(p.right).toBeLessThanOrEqual(i.left + 1);

    // The independent read. `getBoundingClientRect` describes boxes; only
    // hit-testing answers "which element would a click land on", which is the
    // question a covered rail actually fails.
    await expect(rail.contains(document.elementFromPoint(28, 300))).toBe(true);
    const midPanel = Math.round(p.left + p.width / 2);
    await expect(panel.contains(document.elementFromPoint(midPanel, 300))).toBe(true);
  },
};

/**
 * The panel put away. The rail is the half that never goes anywhere, so the
 * claim is not "the panel is hidden" but "the panel is hidden AND the rail is
 * still the thing at x=28" — the failure
 * `group-data-[collapsible=offcanvas]:ms-0` prevents, where 56px of a
 * slid-away panel keeps covering the rail.
 */
export const PanelCollapsed: Story = {
  render: () => <SettingsShell activePath={SIGN_IN} defaultPanelOpen={false} />,
  play: async ({ canvasElement }) => {
    const { rail, panel } = zones(canvasElement);
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]') as HTMLElement;
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await expect(sidebar).toHaveAttribute("data-collapsible", "offcanvas");

    await expect(rail).toBeVisible();
    const r = rail.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    await expect(r.left).toBe(0);
    await expect(r.width).toBeGreaterThan(40);
    // Entirely to the LEFT of the rail, i.e. entirely off screen.
    await expect(p.right).toBeLessThanOrEqual(r.left + 1);
    await expect(rail.contains(document.elementFromPoint(28, 300))).toBe(true);

    // And it comes back. One `SidebarTrigger` in the top bar drives the one
    // provider — the whole reason the rail is not a second `Sidebar`.
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Toggle Sidebar" }));
    await waitFor(async () => {
      await expect(sidebar).toHaveAttribute("data-state", "expanded");
    });
    await waitFor(async () => {
      await expect(panel.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
    });
  },
};

/**
 * Switching AREAS from the icon rail, driven the way a person drives it.
 *
 * The rail is a switcher, not four links: a different area re-points the second
 * panel WITHOUT navigating, and re-clicking the area already showing closes the
 * panel. Both halves live in one handler in the shell, and neither is
 * observable from any prop this story passes — the only way to see them is to
 * click the rail and read what the panel became.
 */
export const AreaSwitching: Story = {
  render: () => <SettingsShell activePath={SIGN_IN} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sidebar = canvasElement.querySelector('[data-slot="sidebar"]') as HTMLElement;

    // It opens on the route's own area, with that area's rows under it.
    await expect(canvas.getByRole("navigation", { name: "Access settings" })).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Roles. What each role is allowed to do." }),
    ).toBeVisible();

    // The rail entries are BUTTONS; the breadcrumb above uses the same words as
    // links, so the role is what keeps these queries pointed at the rail.
    const dataButton = canvas.getByRole("button", { name: "Data" });
    const accessButton = canvas.getByRole("button", { name: "Access" });
    await expect(accessButton).toHaveAttribute("aria-expanded", "true");

    // 1. A DIFFERENT area re-points the panel.
    await userEvent.click(dataButton);
    await waitFor(async () => {
      await expect(canvas.getByRole("navigation", { name: "Data settings" })).toBeVisible();
    });
    // The landmark is not merely relabelled — the rows underneath are the new
    // area's, and the old area's are gone.
    await expect(
      canvas.getByRole("link", {
        name: "Audit log. What is recorded, and for how long. 1 setting waiting on a decision.",
      }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("link", { name: "Roles. What each role is allowed to do." }),
    ).toBeNull();
    await expect(canvas.queryByRole("navigation", { name: "Access settings" })).toBeNull();
    await expect(dataButton).toHaveAttribute("aria-expanded", "true");
    await expect(accessButton).toHaveAttribute("aria-expanded", "false");
    // …and it did NOT navigate. Browsing an area is not opening a section, so
    // the content pane still holds the route the shell was given.
    await expect(canvas.getByRole("heading", { level: 1, name: "Sign-in" })).toBeVisible();
    await expect(sidebar).toHaveAttribute("data-state", "expanded");

    // 2. Re-clicking the SAME area closes the panel. This is the switcher half
    // of the handler and has no other entry point in the UI.
    await userEvent.click(dataButton);
    await waitFor(async () => {
      await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    });
    await expect(dataButton).toHaveAttribute("aria-expanded", "false");
    // Closed means off screen, not merely re-flagged: the panel slides entirely
    // to the left of the rail, which is also the `ms-0` claim from
    // `PanelCollapsed` reached through a different control.
    await waitFor(async () => {
      const { rail, panel } = zones(canvasElement);
      await expect(panel.getBoundingClientRect().right).toBeLessThanOrEqual(
        rail.getBoundingClientRect().left + 1,
      );
    });

    // 3. …and clicking it once more brings it back.
    await userEvent.click(dataButton);
    await waitFor(async () => {
      await expect(sidebar).toHaveAttribute("data-state", "expanded");
    });
    await expect(dataButton).toHaveAttribute("aria-expanded", "true");
    await waitFor(async () => {
      await expect(zones(canvasElement).panel.getBoundingClientRect().left).toBeGreaterThanOrEqual(
        0,
      );
    });
  },
};

/**
 * Choosing a SECTION from the second panel.
 *
 * The row is a plain `<a href>` whose click is intercepted, so "it navigated"
 * cannot be read from the URL — it has to be read from the content pane. The
 * assertion is therefore what the detail pane now says, not which prop the
 * story passed in.
 */
export const SectionSelection: Story = {
  render: () => <SettingsShell activePath={SIGN_IN} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Where it starts: the sign-in screen, and the row that says so.
    await expect(canvas.getByRole("heading", { level: 1, name: "Sign-in" })).toBeVisible();
    await expect(canvas.getByText("Single sign-on")).toBeVisible();
    const signInRow = canvas.getByRole("link", {
      name: "Sign-in. How people prove who they are. 2 settings waiting on a decision.",
    });
    await expect(signInRow).toHaveAttribute("aria-current", "page");

    const rolesRow = canvas.getByRole("link", { name: "Roles. What each role is allowed to do." });
    await expect(rolesRow).not.toHaveAttribute("aria-current");

    await userEvent.click(rolesRow);

    // The DETAIL PANE really changed — heading, and the section's own content.
    await waitFor(async () => {
      await expect(canvas.getByRole("heading", { level: 1, name: "Roles" })).toBeVisible();
    });
    await expect(canvas.getByText("Role for new members")).toBeVisible();
    await expect(canvas.queryByText("Single sign-on")).toBeNull();
    await expect(canvas.queryByRole("heading", { level: 1, name: "Sign-in" })).toBeNull();
    // …and the panel moved its current marker with it.
    await expect(rolesRow).toHaveAttribute("aria-current", "page");
    await expect(signInRow).not.toHaveAttribute("aria-current");
  },
};

/**
 * The two halves of one resize gesture, recorded as they arrive. `SideDock`
 * streams `onWidthChange` on every keydown and commits `onWidthCommit` once on
 * keyup; the story reads the two lists to tell the seams apart, because with
 * both wired to one setter the DOM cannot.
 */
const dockWidthChanges: number[] = [];
const dockWidthCommits: number[] = [];

/**
 * The dock, summoned — the reason this shell exists.
 *
 * Three claims, and none is a presence check: the dock reaches assistive tech
 * as a NAMED `complementary` landmark, its resize handle is genuinely operable
 * from the keyboard, and the live stream and the end-of-gesture commit are two
 * separate seams. "Operable" is measured by pressing a key and watching
 * `aria-valuenow` move, because a handle that is focusable and inert passes
 * every attribute assertion anyone would think to write.
 */
export const DockOpen: Story = {
  render: () => (
    <SettingsShell
      activePath={SIGN_IN}
      defaultHistoryOpen
      onDockWidthChange={(width) => dockWidthChanges.push(width)}
      onDockWidthCommit={(width) => dockWidthCommits.push(width)}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // ONE `userEvent` session for the whole story. The bare `userEvent.keyboard`
    // helper builds a fresh keyboard state per call, so a `{Key>}` press in one
    // call and the matching `{/Key}` release in the next never meet: the second
    // call has nothing recorded as held and the keyup is simply not dispatched.
    // A held gesture therefore has to share one session.
    const user = userEvent.setup();
    // Module-scope lists survive a re-render, so the gesture below counts from
    // zero rather than from whatever mounting happened to do.
    dockWidthChanges.length = 0;
    dockWidthCommits.length = 0;
    // `SideDock`'s own breakpoint is 1100, so the column branch only exists
    // above it. Assert the premise before asserting the landmark.
    await expect(window.innerWidth).toBeGreaterThanOrEqual(1100);

    // Above `overlayBreakpoint` the dock is a column, so it is a landmark in
    // the page rather than a modal over it.
    const dock = canvas.getByRole("complementary", { name: "Change history" });
    await expect(dock).toBeVisible();
    await expect(dock.getBoundingClientRect().width).toBeGreaterThan(200);
    // Its content really rendered — a landmark around nothing is not a dock.
    await expect(canvas.getByText("Renamed the workspace to Northwind Analytics.")).toBeVisible();

    const handle = canvasElement.querySelector(
      '[data-slot="side-dock-resize-handle"]',
    ) as HTMLElement;
    await expect(handle).toBeVisible();
    await expect(handle).toHaveAttribute("role", "separator");
    await expect(handle).toHaveAttribute("aria-orientation", "vertical");
    // Attribute, not the IDL getter: `el.tabIndex` reads -1 for a
    // non-focusable element whether or not anyone set it, so the getter cannot
    // fail when the attribute is deleted.
    await expect(handle).toHaveAttribute("tabindex", "0");

    const before = Number(handle.getAttribute("aria-valuenow"));
    await expect(Number.isFinite(before)).toBe(true);
    const paintedBefore = dock.getBoundingClientRect().width;
    handle.focus();
    await expect(document.activeElement).toBe(handle);
    // On a right-hand dock ArrowLeft widens. Without the key handler the
    // element is still focusable, still a separator, still labelled — and the
    // dock can no longer be resized by anyone who does not use a mouse.
    //
    // The gesture is driven in two HALVES on purpose. `SideDock` fires two
    // different callbacks — `onWidthChange` on every keydown, `onWidthCommit`
    // once on keyup — and the shell wires both. Press-and-release in one call
    // therefore says nothing about WHICH of them moved the dock: with
    // `onWidthChange` gone the keyup commit still pushes the same number back
    // through `onWidthCommit`, so a single after-the-fact `aria-valuenow` read
    // is green either way. Only the DURING half distinguishes them.
    await user.keyboard("{ArrowLeft>}");
    await waitFor(async () => {
      await expect(Number(handle.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
    });
    const during = Number(handle.getAttribute("aria-valuenow"));
    // The live half must reach the PAINTED column, not just the attribute — the
    // width the dock is actually laid out at. `waitFor` because the container
    // tweens its width, so the new number arrives a frame or two after the
    // custom property does.
    await waitFor(async () => {
      await expect(dock.getBoundingClientRect().width).toBeGreaterThan(paintedBefore);
    });
    // The two seams, mid-gesture: the live stream has fired once, for the step
    // the keydown asked for, and the commit has not fired at all.
    await expect(dockWidthChanges.map((width) => Math.round(width))).toEqual([during]);
    await expect(dockWidthCommits).toEqual([]);

    await user.keyboard("{/ArrowLeft}");
    // Releasing settles on the width the gesture reached; it neither snaps back
    // nor takes a second step.
    await expect(Number(handle.getAttribute("aria-valuenow"))).toBe(during);
    // …and the commit fires exactly ONCE, with that same width, while the live
    // stream does not fire again. These two lists are the only place the two
    // seams are distinguishable: the shell wires both to one setter, so the
    // second write is a no-op and no rendered property moves for it.
    await expect(dockWidthCommits.map((width) => Math.round(width))).toEqual([during]);
    await expect(dockWidthChanges.map((width) => Math.round(width))).toEqual([during]);

    // The top bar control is a disclosure FOR this dock, and it reports the
    // state the story is in. Closing is exercised by `DockDismissed` below —
    // deliberately not here, because a story called `DockOpen` whose last act
    // is to close the dock leaves a screenshot, a docs page and a visual diff
    // showing the opposite of its name.
    const trigger = canvas.getByRole("button", { name: "Change history" });
    await expect(trigger.getAttribute("aria-expanded")).toBe("true");
  },
};

/**
 * The same dock, dismissed — the second half of the disclosure round trip.
 *
 * It is a story of its own rather than the tail of `DockOpen` so that each
 * one's FINAL PAINT matches its own name. A play function that opens a thing,
 * asserts it, then closes it again documents the CLOSED state under an OPEN
 * name — every screenshot, docs frame and visual diff taken from it shows the
 * state the story says it is not showing.
 */
export const DockDismissed: Story = {
  render: () => <SettingsShell activePath={SIGN_IN} defaultHistoryOpen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();
    await expect(window.innerWidth).toBeGreaterThanOrEqual(1100);

    // Read as a STRING: `toHaveAttribute("aria-expanded")` alone cannot tell an
    // absent attribute from a `"false"` one, which is the whole state this
    // story turns on.
    const trigger = canvas.getByRole("button", { name: "Change history" });
    await expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await expect(canvas.getByRole("complementary", { name: "Change history" })).toBeVisible();

    await user.click(trigger);
    await waitFor(async () => {
      await expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
    /* "Closed" here is NOT "unmounted". `SideDock`'s column branch keeps its
     * `<aside>` in the DOM for the closing transition, marks it `inert`, and
     * slides it off-screen while the in-flow SPACER collapses to zero. So the
     * dismissal is two separate facts and both are asserted:
     *   1. the panel is `inert` — what actually removes it from the tab order
     *      and the a11y tree (Testing Library's role query does not honour
     *      `inert`, so a `queryByRole(…)).toBeNull()` here would fail against
     *      correct code, and asserting it alone would prove nothing anyway);
     *   2. the spacer it occupies in the layout is gone — the content pane
     *      really did take the width back.
     */
    const panel = canvasElement.querySelector(
      'aside[data-slot="side-dock-container"]',
    ) as HTMLElement;
    const spacer = canvasElement.querySelector('[data-slot="side-dock-spacer"]') as HTMLElement;
    await waitFor(async () => {
      await expect(panel.hasAttribute("inert")).toBe(true);
    });
    // `waitFor` because the spacer tweens its width — the number lands a frame
    // or two after the attribute does.
    await waitFor(async () => {
      await expect(`spacer ${Math.round(spacer.getBoundingClientRect().width)}px`).toBe(
        "spacer 0px",
      );
    });
  },
};

/**
 * An area open with nothing selected in it — the route a rail click produces
 * before a section is picked. The content pane must say so rather than render
 * an empty frame.
 */
export const NoSelection: Story = {
  render: () => <SettingsShell activePath={areaHref("access")} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // `StatePanel` fades in, so the assertion waits for the paint rather than
    // racing it.
    await waitFor(async () => {
      await expect(canvas.getByText("No section selected")).toBeVisible();
    });
    // The panel still lists the sections — the screen is empty, the navigation
    // is not.
    await expect(canvas.getByRole("navigation", { name: "Access settings" })).toBeVisible();
  },
};

/**
 * Nothing has arrived yet. Both navigation and content render layout-shaped
 * skeletons, and the whole not-ready screen announces ONCE — one live region,
 * not one per box.
 */
export const Loading: Story = {
  render: () => <SettingsShell activePath={SIGN_IN} loading />,
  play: async ({ canvasElement }) => {
    const screen = canvasElement.querySelector('[data-slot="settings-screen"]') as HTMLElement;
    await expect(screen).toBeVisible();
    const live = screen.querySelectorAll('[role="status"]');
    await expect(live.length).toBe(1);
    await expect(live[0]!).toHaveAttribute("aria-live", "polite");
    // Layout-shaped, not a spinner: skeleton ROWS in the panel and skeleton
    // BLOCKS in the screen. `Skeleton` declares no `data-slot` of its own, so
    // the screen half is found by the `animate-pulse` utility the primitive
    // owns — the same property the loading-states rule requires it to carry.
    const panel = canvasElement.querySelector('[data-slot="sidebar-container"]') as HTMLElement;
    const menuSkeletons = panel.querySelectorAll('[data-slot="sidebar-menu-skeleton"]');
    await expect(menuSkeletons.length).toBeGreaterThan(0);
    // The nav placeholder is painted in CHROME ink on CHROME ground. `Skeleton`
    // defaults to `bg-muted`, a CANVAS token: in the light theme that is a
    // near-white on this panel's dark sidebar ground, so the thing standing in
    // for absent content became the loudest element on the screen (12.42:1
    // measured against `--sidebar`). MEASURED, not asserted from the class
    // name — and measured against the ground the browser actually resolves,
    // since the bar is painted on it.
    //
    // Honest scope: the ratio half of this lock BITES IN `light` ONLY. In dark
    // `--muted` sits at 1.25:1 on `--sidebar` and would satisfy it either way,
    // so the token half below is what carries the dark theme. CI runs `light`.
    for (const box of Array.from(menuSkeletons)) {
      const bars = box.querySelectorAll(".animate-pulse");
      await expect(bars.length).toBeGreaterThan(0);
      for (const bar of Array.from(bars)) {
        const fill = getComputedStyle(bar).backgroundColor;
        const ground = resolvedBackgroundColor(bar.parentElement ?? bar);
        // A placeholder is a quiet surface tone, not a graphical mark: it must
        // NOT clear the 3:1 mark bar against the chrome it sits on.
        await expect(wcagContrast(fill, ground)).toBeLessThan(3);
        await expect(bar.classList.contains("bg-sidebar-accent")).toBe(true);
        // `cn`'s tailwind-merge drops the losing `bg-*`, so the canvas token is
        // gone from the class string entirely rather than merely overridden.
        await expect(bar.classList.contains("bg-muted")).toBe(false);
      }
    }
    const boxes = screen.querySelectorAll(".animate-pulse");
    await expect(boxes.length).toBeGreaterThan(5);
    // Decorative, every one of them: a skeleton per box in the a11y tree would
    // flood AT, which is why the single live region above is the announcement.
    for (const box of Array.from(boxes)) {
      await expect(box).toHaveAttribute("aria-hidden", "true");
    }
    // And the space is really reserved — a collapsed skeleton is a spinner
    // with extra steps.
    const port = screen.querySelector('[data-slot="settings-screen-scroll"]') as HTMLElement;
    await expect(port).toBeVisible();
    await expect(port.getBoundingClientRect().height).toBeGreaterThan(200);
    // The port scrolls in this state too, so it owes the same focus treatment
    // the loaded branch carries — a keyboard user must be able to reach and
    // scroll a skeleton screen, not only a settled one. Attribute, not the IDL
    // getter: `el.tabIndex` answers -1 for any non-focusable element whether or
    // not anyone set it. And `focus-ring-inset` must be the ONLY rung: the
    // plain `focus-ring` draws both its layers outside the box `SidebarInset`
    // clips, so if both classes were present the clipped one would paint.
    await expect(port).toHaveAttribute("tabindex", "0");
    await expect(port.classList.contains("focus-ring-inset")).toBe(true);
    await expect(port.classList.contains("focus-ring")).toBe(false);
    // …and no settings rows are pretending to be real while it loads.
    await expect(screen.querySelectorAll('[data-slot="settings-row"]').length).toBe(0);
  },
};

/** An area with no sections at all — the panel says so in CHROME ink, on chrome ground. */
export const EmptyArea: Story = {
  render: () => {
    const areas: SettingsArea[] = [
      { id: "workspace", label: "Workspace", icon: Building2, sections: [] },
    ];
    return <SettingsShell areas={areas} activePath={areaHref("workspace")} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const empty = canvas.getByText(/Nothing to configure in Workspace yet/);
    await expect(empty).toBeVisible();
    // The empty row sits on `bg-sidebar`, which is DARK chrome in the `light`
    // reference theme. Canvas ink there is a real 1.4.3 failure, so the ratio
    // is measured rather than inferred from the class name.
    const ink = getComputedStyle(empty).color;
    await expect(wcagContrast(ink, resolvedBackgroundColor(empty))).toBeGreaterThanOrEqual(4.5);
  },
};

/**
 * Below the `md` boundary — 414px, a phone.
 *
 * The claim that makes this shell what it is: the icon rail is STILL on screen.
 * A `Sidebar` becomes a closed `Sheet` here, and a closed sheet cannot be the
 * thing you reopen the app from — which is why the rail is a plain column. The
 * section panel, which you genuinely can put away, is the sheet.
 */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
  render: () => <SettingsShell activePath={SIGN_IN} />,
  play: async ({ canvasElement }) => {
    // The premise, measured: a viewport global that silently stopped applying
    // would leave this asserting the desktop branch under a name that says
    // otherwise.
    await expect(window.innerWidth).toBeLessThan(768);
    await expect(window.matchMedia("(min-width: 48rem)").matches).toBe(false);

    const rail = canvasElement.querySelector('[data-slot="settings-icon-rail"]') as HTMLElement;
    await expect(rail).toBeVisible();
    await expect(rail.getBoundingClientRect().width).toBeGreaterThan(40);
    await expect(rail.getBoundingClientRect().left).toBe(0);
    // The panel is NOT a column here — the desktop container is not rendered.
    await expect(canvasElement.querySelector('[data-slot="sidebar-container"]')).toBeNull();

    // It is reachable as a sheet, from the one trigger that never stands down.
    // Radix portals both overlays to `document.body`, OUTSIDE the story root,
    // so they are queried from the document rather than from `canvasElement`.
    const canvas = within(canvasElement);
    const doc = within(document.body);
    await userEvent.click(canvas.getByRole("button", { name: "Toggle Sidebar" }));
    await expect(await doc.findByRole("dialog", { name: "Sidebar" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(async () => {
      await expect(doc.queryByRole("dialog", { name: "Sidebar" })).toBeNull();
    });

    // The dock is an OVERLAY at this width, not a column — asserted here as the
    // absence of the column branch, which is a property of the resting shell.
    // Opening it belongs to `NarrowDockOpen` below: the overlay covers roughly
    // three quarters of a 414px viewport, so a story called `Narrow` that ends
    // with it open documents the dock instead of the narrow shell it is named
    // for.
    await expect(document.querySelector('[data-slot="side-dock"]')).toBeNull();
    await expect(canvas.getByRole("button", { name: "Change history" })).toBeVisible();
  },
};

/**
 * The narrow shell with the change-history dock summoned.
 *
 * Split from `Narrow` so each story's FINAL PAINT is the one its name promises.
 * The claim is the branch itself: below `SideDock`'s own breakpoint there is no
 * resizable column anywhere in the document — what opens is a modal dialog over
 * the shell, and it is dismissible from the keyboard like any other.
 */
export const NarrowDockOpen: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
  render: () => <SettingsShell activePath={SIGN_IN} />,
  play: async ({ canvasElement }) => {
    // Premise first: this whole story is about the sub-breakpoint branch.
    await expect(window.innerWidth).toBeLessThan(768);
    const canvas = within(canvasElement);
    // Radix portals the overlay to `document.body`, OUTSIDE the story root.
    const doc = within(document.body);

    await expect(document.querySelector('[data-slot="side-dock"]')).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Change history" }));
    const overlay = await doc.findByRole("dialog", { name: "Change history" });
    await expect(overlay).toBeVisible();
    // A `dialog` here rather than the desktop `complementary` landmark, and no
    // resizable column mounted behind it.
    await expect(document.querySelector('[data-slot="side-dock-container"]')).toBeNull();
    // The dock's own content really rendered — an empty modal with the right
    // name would satisfy every assertion above.
    await expect(
      within(overlay).getByText("Renamed the workspace to Northwind Analytics."),
    ).toBeVisible();
  },
};

/**
 * Just above the `md` boundary — the width band nothing else in this file sees.
 * Every other desktop story renders at 1280px and `Narrow` at 414px: both far
 * from 768px, on opposite sides of it. Sliding the shell's layout breakpoint
 * one step, `md:` to `lg:`, would switch every reader between 768px and 1023px
 * to the phone layout and leave this file green.
 *
 * It also reads the OTHER breakpoint in this shell, which is not the same
 * number: `SideDock` swaps to an overlay below 1100px, so at 800px the section
 * panel is a column and the dock is not.
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
  render: () => <SettingsShell activePath={SIGN_IN} />,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBeGreaterThanOrEqual(768);
    await expect(window.innerWidth).toBeLessThan(1024);
    await expect(window.matchMedia("(min-width: 48rem)").matches).toBe(true);

    const { rail, panel, inset } = zones(canvasElement);
    await expect(rail).toBeVisible();
    await expect(panel).toBeVisible();
    await expect(inset).toBeVisible();
    // Real columns, not a phone layout wearing the desktop assertions.
    await expect(panel.getBoundingClientRect().width).toBeGreaterThan(120);
    await expect(inset.getBoundingClientRect().width).toBeGreaterThan(120);
    await expect(
      Math.abs(panel.getBoundingClientRect().left - rail.getBoundingClientRect().right),
    ).toBeLessThanOrEqual(1);
    // The mobile sheet is not what is painting the panel.
    await expect(canvasElement.querySelector('[data-mobile="true"]')).toBeNull();

    // The dock's own breakpoint is 1100, so at 800px its column branch is not
    // mounted at all — an independent read of a second, different number.
    await expect(canvasElement.querySelector('[data-slot="side-dock"]')).toBeNull();
  },
};

/**
 * The compact density dial, on the whole screen.
 *
 * `data-density` is set on a WRAPPER, never pinned on one container: a pinned
 * container desyncs from the width spacer its own layout depends on. The lock
 * measures a real computed `font-size` — 14px × 15/16 — which also holds the
 * screen to type-as-a-role: a raw Tailwind size utility reads Tailwind's own
 * scale key, which the dial never touches.
 */
export const CompactDensity: Story = {
  render: () => (
    <div data-density="compact" className="h-svh">
      <SettingsShell activePath={SIGN_IN} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText("Single sign-on");
    await expect(label).toBeVisible();
    const size = Number.parseFloat(getComputedStyle(label).fontSize);
    await expect(size).toBeGreaterThan(12.9);
    await expect(size).toBeLessThan(13.4);
  },
};

/**
 * Very long labels and summaries everywhere at once. A surface is designed for
 * short, average AND overflowing content; this is the third case, asserted
 * rather than eyeballed.
 */
export const OverflowingContent: Story = {
  render: () => {
    const areas: SettingsArea[] = [
      {
        id: "workspace",
        label: "Workspace identity, regions and retention defaults for the whole tenancy",
        icon: Building2,
        sections: [
          {
            id: "general",
            label: "General workspace configuration and organisation-wide naming defaults",
            summary:
              "Everything that decides how this workspace is named, addressed and presented across every product surface, every exported report and every invitation anyone will ever receive",
            attention: 12,
          },
          {
            id: "branding",
            label: "Branding, marks, accent colours and outbound email presentation",
            summary:
              "What people see before they read a single word of anything this workspace sends them",
          },
        ],
      },
    ];
    return <SettingsShell areas={areas} activePath={sectionHref("workspace", "general")} />;
  },
  play: async ({ canvasElement }) => {
    const { rail, panel, inset } = zones(canvasElement);
    // Visible FIRST, and only then measured — `scrollWidth === clientWidth === 0`
    // on an unpainted element, so an unguarded spill check passes on nothing.
    for (const zone of [rail, panel, inset]) {
      await expect(zone).toBeVisible();
      await expect(zone.clientWidth).toBeGreaterThan(0);
      await expect(overflowX(zone)).toBeLessThanOrEqual(1);
    }
    const port = canvasElement.querySelector('[data-slot="settings-screen-scroll"]') as HTMLElement;
    await expect(port).toBeVisible();
    await expect(port.clientWidth).toBeGreaterThan(0);
    await expect(overflowX(port)).toBeLessThanOrEqual(1);
    // Nothing escaped to the page itself.
    await expect(overflowX(document.body)).toBeLessThanOrEqual(1);
  },
};
