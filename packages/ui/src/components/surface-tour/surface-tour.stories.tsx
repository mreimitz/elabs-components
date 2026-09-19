import { lazy, type CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Skeleton } from "../skeleton";
import { SurfaceTour, SurfaceTourActions, type SurfaceTourTab } from "./surface-tour";

function Surface({ name }: { name: string }) {
  return (
    <div className="flex size-full flex-col gap-3 p-6">
      <p className="text-title text-foreground">{name}</p>
      <p className="text-body text-muted-foreground">A full-size surface fills the frame.</p>
      <button type="button" className="w-fit rounded-md border px-3 py-1 text-body focus-ring">
        Interact
      </button>
    </div>
  );
}

// A surface whose code arrives later — stands in for a `next/dynamic` / `React.lazy` chunk.
const LazyCanvas = lazy(
  () =>
    new Promise<{ default: () => React.JSX.Element }>((resolve) =>
      setTimeout(() => resolve({ default: () => <Surface name="Canvas (lazy)" /> }), 600),
    ),
);

const TABS: SurfaceTourTab[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    useCase: "KPIs, charts and records on one screen.",
    hint: "Drag a tile",
    render: () => <Surface name="Dashboard" />,
    actions: (
      <SurfaceTourActions
        storybookHref="?path=/docs/layout-surfacetour--docs"
        prompt={"Using brand-ui, build a dashboard.\nKPIs, charts and records on one screen."}
        command="npx -y @elabs-ai/components-cli create my-app --template dashboard"
      />
    ),
  },
  {
    id: "canvas",
    label: "Canvas",
    useCase: "Nodes and edges on a pannable canvas.",
    render: () => <LazyCanvas />,
    fallback: <Skeleton className="size-full min-h-96" />,
    actions: <SurfaceTourActions prompt={"Using brand-ui, build a node canvas."} />,
  },
  {
    id: "settings",
    label: "Settings",
    useCase: "Forms, sections and saved state.",
    render: () => <Surface name="Settings" />,
  },
];

const meta = {
  title: "Layout/SurfaceTour",
  component: SurfaceTour,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A tour of full-size surfaces behind a sticky tab strip: the frame stays put while surfaces crossfade, lazy surfaces show a Skeleton until their code arrives, a one-time corner hint nudges the first interaction, and an actions row sits under the frame. Set `--surface-tour-sticky-top` to your nav height.",
      },
    },
  },
  args: {
    tabs: TABS,
    title: "Seven surfaces, one system",
    description: "Pick a surface; the frame stays, the content changes.",
    frameClassName: "h-112",
  },
  beforeEach: () => {
    window.sessionStorage.clear();
  },
} satisfies Meta<typeof SurfaceTour>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three tabs, one lazy: the canvas shows a Skeleton until its code resolves; arrow keys move between tabs. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvasElement.querySelector<HTMLElement>('[data-slot="surface-tour-frame"]')!;
    const heightBefore = frame.getBoundingClientRect().height;
    await userEvent.click(canvas.getByRole("tab", { name: "Canvas" }));
    await waitFor(() => expect(canvas.getByText("Canvas (lazy)")).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(frame.getBoundingClientRect().height).toBe(heightBefore);
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(canvas.getByRole("tab", { name: "Settings" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  },
};

/** The tab strip sticks at `--surface-tour-sticky-top` while the tour scrolls under it. */
export const StickyTabs: Story = {
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="p-4" style={{ "--surface-tour-sticky-top": "16px" } as CSSProperties}>
        <Story />
        <div className="h-screen" />
      </div>
    ),
  ],
  args: { frameClassName: "h-screen" },
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector<HTMLElement>('[data-slot="surface-tour-tabs"]')!;
    const win = canvasElement.ownerDocument.defaultView!;
    win.scrollTo(0, 240);
    await waitFor(() => expect(Math.round(bar.getBoundingClientRect().top)).toBe(16));
    win.scrollTo(0, 400);
    await waitFor(() => expect(Math.round(bar.getBoundingClientRect().top)).toBe(16));
    win.scrollTo(0, 0);
  },
};

/** The corner hint appears after a beat, leaves on the first interaction and stays gone this session. */
export const AffordanceHintOnce: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hint = await waitFor(
      () => {
        const el = canvasElement.querySelector<HTMLElement>('[data-slot="affordance-hint"]');
        expect(el).toHaveAttribute("data-visible");
        return el!;
      },
      { timeout: 3000 },
    );
    expect(hint).toHaveAttribute("aria-hidden", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Interact" }));
    await waitFor(() => expect(hint).not.toHaveAttribute("data-visible"));
    await userEvent.click(canvas.getByRole("tab", { name: "Settings" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Dashboard" }));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const again = canvasElement.querySelector('[data-slot="affordance-hint"]');
    expect(again).not.toHaveAttribute("data-visible");
  },
};
