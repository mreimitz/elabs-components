/**
 * AudioVisualizer — a live mic-level / waveform meter (issue #21).
 *
 * Presentation-only (D5): it never calls `getUserMedia` or owns an
 * `AudioContext` — every story below feeds it a plain `levels` array, exactly
 * as a real consumer would from their own analyser loop (or the opt-in
 * `useAudioLevel` hook, which these stories deliberately do NOT use, since it
 * would require a live microphone).
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { useEffect, useState } from "react";

import { AudioVisualizer } from "./audio-visualizer";

const QUIET_LEVELS = Array.from({ length: 32 }, () => 0.02);
const SPEECH_LEVELS = Array.from({ length: 32 }, (_, i) =>
  Math.max(0.05, Math.abs(Math.sin(i / 2.3)) * 0.9),
);

const meta = {
  title: "AI/AudioVisualizer",
  component: AudioVisualizer,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'Canvas-drawn mic-level meter driven entirely by a `levels` prop — the component never touches the microphone itself. Level is readable from bar/wave HEIGHT, never colour alone; the canvas stays `aria-hidden` and a throttled `role="status"` text alternative reports the discretized state.',
      },
    },
  },
  args: { levels: SPEECH_LEVELS },
  tags: ["autodocs"],
} satisfies Meta<typeof AudioVisualizer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Bars fed a moderate, varying speech-like signal. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("status")).toHaveTextContent("Microphone active");
  },
};

/** The `"wave"` variant — a filled envelope through the current samples. */
export const Wave: Story = {
  args: { variant: "wave" },
};

/**
 * No stream connected yet — the not-ready state (`loading`). Renders the flat
 * idle baseline instead of `levels` and announces "Microphone not connected".
 */
export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("status")).toHaveTextContent("Microphone not connected");
  },
};

/** A connected mic picking up nothing above the noise floor. */
export const Silent: Story = {
  args: { levels: QUIET_LEVELS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("status")).toHaveTextContent("No input detected");
  },
};

/**
 * A surface that already renders its own live region elsewhere opts out with
 * `statusLabel={null}` so assistive tech is not told twice.
 */
export const NoStatusAnnouncement: Story = {
  args: { statusLabel: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};

/**
 * A single reduced-motion FRAME. Under `prefers-reduced-motion`,
 * `AudioVisualizer` skips its internal smoothing animation and paints
 * `levels` directly on every prop change — this is exactly that: one settled
 * frame, no interpolation, still fully legible. (A live OS/browser
 * reduced-motion toggle degrades every OTHER story to this same behavior;
 * this story documents what that degradation looks like without depending on
 * the test environment's motion setting.)
 */
export const ReducedMotionFrame: Story = {
  args: { levels: SPEECH_LEVELS },
  parameters: {
    docs: {
      description: {
        story:
          "What every story above renders once `prefers-reduced-motion` is on: the current levels, drawn once, with no interpolation between updates.",
      },
    },
  },
};

/**
 * A simulated live session — a local interval stands in for a parent's own
 * `requestAnimationFrame` + analyser loop, updating `levels` continuously.
 */
function LiveDemo() {
  const [levels, setLevels] = useState(SPEECH_LEVELS);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLevels((prev) => prev.map(() => Math.random() * 0.8 + 0.05));
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  return <AudioVisualizer levels={levels} />;
}

export const Live: Story = {
  render: () => <LiveDemo />,
};
