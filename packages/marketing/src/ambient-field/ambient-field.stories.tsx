import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { AmbientField } from "./ambient-field";

const meta = {
  title: "Marketing/AmbientField",
  component: AmbientField,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  render: (args) => (
    <div className="relative isolate flex min-h-96 items-center justify-center p-8">
      <AmbientField {...args} />
      <p className="text-body text-foreground">Content sits above the ambient field.</p>
    </div>
  ),
} satisfies Meta<typeof AmbientField>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Names a running animation so a failing reduced-motion play says what still moves. */
function describeAnimation(a: Animation) {
  const effect = a.effect as KeyframeEffect | null;
  const target = effect?.target as Element | null | undefined;
  const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.id;
  return `${name} on ${target?.getAttribute("data-slot") ?? target?.tagName ?? "?"}${effect?.pseudoElement ?? ""}`;
}

/** Default stops (primary, chart-2, surface-3) drifting on a 20 s loop. */
export const Default: Story = {};

export const Dark: Story = {
  parameters: { themes: { themeOverride: "dark" } },
};

/** The drafting ground and the ambient field together at full decoration. */
export const Decoration10: Story = {
  globals: { decoration: "10" },
};

/** `tint` (or `data-ambient-tint`) shifts the first stop; the change crossfades over `--t-base`. */
export const Tinted: Story = {
  args: { tint: "chart-4" },
};

export const Still: Story = {
  args: { drift: false, stops: ["chart-1", "chart-3"] },
};

/** Under reduced motion the drift is paused: no animation on the page is running. */
export const ReducedMotion: Story = {
  // The real gate on :root (Storybook motion toolbar) plus a subtree dial, because the toolbar
  // writes :root after the story has mounted.
  globals: { motionPref: "reduced" },
  render: (args) => (
    <div
      data-motion-pref="reduced"
      className="relative isolate flex min-h-96 items-center justify-center p-8"
    >
      <AmbientField {...args} />
      <p className="text-body text-foreground">The field is static under reduced motion.</p>
    </div>
  ),
  play: async () => {
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
