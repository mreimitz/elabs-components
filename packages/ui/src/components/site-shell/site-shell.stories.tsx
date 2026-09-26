import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { SiteShell, SiteShellFooter, SiteShellHeader, SiteShellMain } from "./site-shell";
import { Button } from "../button";
import { Heading, Text } from "../typography";

const FILLER =
  "Every ocean carrier sends an estimated arrival with the booking. It is updated, on average, 1.8 times over a 30-day voyage.";

function Nav() {
  return (
    <div className="mx-auto flex h-header w-full max-w-6xl items-center justify-between px-6">
      <span className="text-subtitle font-semibold">Harbourline</span>
      <nav aria-label="Primary" className="flex items-center gap-6 text-body">
        <a className="focus-ring rounded-sm" href="#product">
          Product
        </a>
        <a className="focus-ring rounded-sm" href="#pricing">
          Pricing
        </a>
        <Button size="sm">Start free</Button>
      </nav>
    </div>
  );
}

function Body({ sections = 8 }: { sections?: number }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12">
      {Array.from({ length: sections }, (_, i) => (
        <section className="flex flex-col gap-3" key={i}>
          <Heading level={2}>Section {i + 1}</Heading>
          <Text className="max-w-prose" tone="muted">
            {FILLER} {FILLER}
          </Text>
        </section>
      ))}
    </div>
  );
}

const meta = {
  title: "Layout/SiteShell",
  component: SiteShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SiteShell>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Header pinned while the document scrolls; the skip link is the first tab stop and lands on `<main>`. */
export const Default: Story = {
  render: () => (
    <SiteShell>
      <SiteShellHeader>
        <Nav />
      </SiteShellHeader>
      <SiteShellMain>
        <Body />
      </SiteShellMain>
      <SiteShellFooter className="border-t border-border-strong">
        <div className="mx-auto max-w-6xl px-6 py-8 text-meta text-muted-foreground">
          © Harbourline
        </div>
      </SiteShellFooter>
    </SiteShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvasElement.querySelector('[data-slot="site-shell-header"]') as HTMLElement;
    await expect(header).toHaveAttribute("data-sticky");
    await expect(getComputedStyle(header).position).toBe("sticky");

    window.scrollTo(0, 600);
    await waitFor(() => expect(header.getBoundingClientRect().top).toBe(0));
    window.scrollTo(0, 0);

    await userEvent.tab();
    const skip = canvas.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toHaveFocus();
    // Resolve the target FROM the link (a hash navigation would reload the
    // test frame, so the jump itself is exercised by focusing the target).
    const targetId = (skip.getAttribute("href") ?? "").replace(/^#/, "");
    const target = canvasElement.querySelector(`#${CSS.escape(targetId)}`) as HTMLElement;
    await expect(target).toBe(canvas.getByRole("main"));
    await expect(target).toHaveAttribute("tabindex", "-1");
    target.focus();
    await expect(target).toHaveFocus();
  },
};

/** `asChild`: a navbar that renders its own `<header>` becomes the sticky element, keeping its own surface. */
export const HeaderAsChild: Story = {
  render: () => (
    <SiteShell>
      <SiteShellHeader asChild>
        <header className="h-header border-b border-border-strong bg-background">
          <Nav />
        </header>
      </SiteShellHeader>
      <SiteShellMain>
        <Body sections={4} />
      </SiteShellMain>
    </SiteShell>
  ),
  play: async ({ canvasElement }) => {
    const headers = canvasElement.querySelectorAll("header");
    await expect(headers).toHaveLength(1);
    await expect(getComputedStyle(headers[0]).position).toBe("sticky");
  },
};

/** `sticky={false}`: the header scrolls with the page — an announcement-heavy landing, a print layout. */
export const StaticHeader: Story = {
  render: () => (
    <SiteShell>
      <SiteShellHeader sticky={false}>
        <Nav />
      </SiteShellHeader>
      <SiteShellMain>
        <Body sections={3} />
      </SiteShellMain>
    </SiteShell>
  ),
};
