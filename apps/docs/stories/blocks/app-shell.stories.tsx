import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
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
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppShellPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The believable screen: four zones, a real operations console in the content
 * pane, the details rail resting collapsed the way an app ships it.
 */
export const Default: Story = {
  render: () => <AppShellPage activePath="/" />,
};

/** A nested route lights its parent nav entry; an unrelated one stays dark. */
export const ActivePathMatching: Story = {
  render: () => <AppShellPage activePath="/runs/42" />,
  play: async ({ canvasElement }) => {
    const runs = canvasElement.querySelector('a[href="/runs"]') as HTMLElement;
    const overview = canvasElement.querySelector('a[href="/"]') as HTMLElement;
    // A nested route keeps its parent lit; an unrelated one does not.
    await expect(runs).toHaveAttribute("data-active", "true");
    await expect(overview).toHaveAttribute("data-active", "false");
    // Depth 2, so the trail earns its row — one crumb would be a page title
    // wearing a separator.
    await expect(canvasElement.querySelector('nav[aria-label="breadcrumb"]')).toBeInTheDocument();
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
    await expect(canvasElement.querySelector('[data-slot="app-top-bar"]')).toBeInTheDocument();
    await expect(canvasElement.querySelector('nav[aria-label="Primary"]')).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot="app-list-column"]')).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot="context-rail"]')).toBeInTheDocument();
    // `emptyContent` hands the screen slot back to the consumer: the shell
    // still paints its own scroll port, but nothing is inside it.
    await expect(
      canvasElement.querySelector('[data-slot="app-shell-content"]'),
    ).toBeEmptyDOMElement();
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
      '[data-slot="app-nav-rail-collapsed-item"] a[href="/runs/active"]',
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
    // The attribute alone cannot fail while the shell defaults the rail open,
    // so the lock also demands the rail's own expanded body — its first
    // section's heading — which only exists once the rail is really mounted.
    await expect(
      canvasElement.querySelector('[data-slot="context-rail-heading"]'),
    ).toHaveTextContent("Details");
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
    // Announced once per region, not once per skeleton box.
    await expect(listStatus).toHaveTextContent("Loading pipelines…");
  },
};

/**
 * A first run, or a filter that matched nothing: each list answers for itself
 * with a real empty state — a title, one sentence, and no broken chrome.
 */
export const Empty: Story = {
  render: () => <AppShellPage activePath="/" pipelines={[]} metrics={[]} runs={[]} activity={[]} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No pipelines yet")).toBeInTheDocument();
    await expect(canvas.getByText("Nothing happened overnight")).toBeInTheDocument();
  },
};
