import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Card, CardDescription, CardHeader, CardTitle } from "../card";
import { ParallaxPlane, type ParallaxPlaneKind } from "./parallax-plane";

const PLANES: { plane: ParallaxPlaneKind; title: string; description: string }[] = [
  { plane: "ground", title: "Ground plane", description: "Scrolls at 0.15× — it lags behind." },
  { plane: "content", title: "Content plane", description: "Scrolls with the page at 1×." },
  { plane: "float", title: "Float plane", description: "Scrolls at 1.2× — it runs ahead." },
];

function Planes() {
  return (
    <div className="min-h-screen p-8">
      <p className="text-body text-muted-foreground">
        Scroll the page: each card moves at its plane’s rate, never more than 60px from the content.
      </p>
      <div className="mt-40 grid gap-6 sm:grid-cols-3">
        {PLANES.map(({ plane, title, description }) => (
          <ParallaxPlane key={plane} plane={plane}>
            <Card>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </ParallaxPlane>
        ))}
      </div>
      <div className="min-h-screen" />
    </div>
  );
}

const meta = {
  title: "Display/ParallaxPlane",
  component: ParallaxPlane,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  render: () => <Planes />,
} satisfies Meta<typeof ParallaxPlane>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Names a running animation so a failing reduced-motion play says what still moves. */
function describeAnimation(a: Animation) {
  const effect = a.effect as KeyframeEffect | null;
  const target = effect?.target as Element | null | undefined;
  const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.id;
  return `${name} on ${target?.getAttribute("data-slot") ?? target?.tagName ?? "?"}${effect?.pseudoElement ?? ""}`;
}

export const Default: Story = {};

export const Dark: Story = {
  parameters: { themes: { themeOverride: "dark" } },
};

export const Decoration10: Story = {
  globals: { decoration: "10" },
};

/** Under reduced motion every plane scrolls at 1×: no animation, no transform. */
export const ReducedMotion: Story = {
  // The real gate on :root (Storybook motion toolbar) plus a subtree dial, because the toolbar
  // writes :root after the story has mounted.
  globals: { motionPref: "reduced" },
  render: () => (
    <div data-motion-pref="reduced">
      <Planes />
    </div>
  ),
  play: async ({ canvasElement }) => {
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
    for (const plane of canvasElement.querySelectorAll('[data-slot="parallax-plane"]')) {
      await expect(getComputedStyle(plane).transform).toBe("none");
    }
  },
};
