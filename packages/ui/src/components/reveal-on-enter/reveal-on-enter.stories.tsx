import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Card, CardDescription, CardHeader, CardTitle } from "../card";
import { RevealOnEnter } from "./reveal-on-enter";

const ITEMS = [
  {
    id: "once",
    title: "Once",
    description: "Content reveals the first time it enters, never again.",
  },
  { id: "visible", title: "Visible first", description: "The server HTML is fully visible." },
  { id: "gated", title: "Gated", description: "Reduced motion shows everything at once." },
];

function Reveals({ stagger = false }: { stagger?: boolean }) {
  return (
    <div className="p-8">
      <p className="text-body text-muted-foreground">Scroll down to reveal the cards.</p>
      <div className="min-h-screen" />
      <RevealOnEnter as="ul" stagger={stagger} className="grid gap-6 sm:grid-cols-3">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <Card>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </RevealOnEnter>
      <div className="min-h-96" />
    </div>
  );
}

const meta = {
  title: "Display/RevealOnEnter",
  component: RevealOnEnter,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  render: () => <Reveals />,
} satisfies Meta<typeof RevealOnEnter>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Names a running animation so a failing reduced-motion play says what still moves. */
function describeAnimation(a: Animation) {
  const effect = a.effect as KeyframeEffect | null;
  const target = effect?.target as Element | null | undefined;
  const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.id;
  return `${name} on ${target?.getAttribute("data-slot") ?? target?.tagName ?? "?"}${effect?.pseudoElement ?? ""}`;
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector<HTMLElement>('[data-slot="reveal-on-enter"]')!;
    el.scrollIntoView();
    await waitFor(() => expect(el.getAttribute("data-reveal")).not.toBe("hidden"));
  },
};

/** Each child reveals 60 ms × `--motion-factor` after the one before. */
export const Stagger: Story = {
  render: () => <Reveals stagger />,
};

export const Dark: Story = {
  parameters: { themes: { themeOverride: "dark" } },
};

export const Decoration10: Story = {
  globals: { decoration: "10" },
};

/** Under reduced motion nothing is ever hidden and nothing animates. */
export const ReducedMotion: Story = {
  // The real gate on :root (Storybook motion toolbar) plus a subtree dial, because the toolbar
  // writes :root after the story has mounted.
  globals: { motionPref: "reduced" },
  render: () => (
    <div data-motion-pref="reduced">
      <Reveals stagger />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-reveal]")).toBeNull();
    // Transitions the harness started before the gate applied (theme/decoration swaps between
    // stories) settle; a primitive that still animates under the gate never would.
    await waitFor(() =>
      expect(
        document
          .getAnimations()
          .filter((a) => a.playState === "running")
          .map(describeAnimation),
      ).toEqual([]),
    );
  },
};
